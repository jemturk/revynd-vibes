package com.jemturk.revynd.backend.service;

import com.jemturk.revynd.backend.dto.RegisterRequest;
import com.jemturk.revynd.backend.model.User;
import com.jemturk.revynd.backend.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

@Service
public class AuthService {

    // 1. Establish structural logger to output details directly to Cloud Run
    // stdout/stderr
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final EmailService emailService;

    private static final Pattern UPPERCASE_PATTERN = Pattern.compile("[A-Z]");
    private static final Pattern SPECIAL_CHAR_PATTERN = Pattern.compile("[!@#$%^&*(),.?\":{}|<>]");

    public AuthService(UserRepository userRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public User registerNewUser(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        // 1. Declare the password variable right at the top of the scope block
        String password = request.getPassword();

        logger.info("⚡ Registration sequence initiated for email target: {}", email);

        // Validation 1: Verify unique email constraints
        try {
            if (userRepository.existsByEmail(email)) {
                logger.warn("⚠️ Registration rejected: Email {} already exists in the database.", email);
                throw new IllegalArgumentException("An account with this email address already exists.");
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.error("❌ Database connection failure during existsByEmail lookup: ", ex);
            throw new RuntimeException("Database lookups failed during account validation context.");
        }

        // Validation 2: Enforce password strength criteria (Variable now resolves
        // perfectly)
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long.");
        }
        if (!UPPERCASE_PATTERN.matcher(password).find()) {
            throw new IllegalArgumentException("Password requires at least one uppercase letter.");
        }
        if (!SPECIAL_CHAR_PATTERN.matcher(password).find()) {
            throw new IllegalArgumentException("Password requires at least one special character.");
        }

        // Processing: Hash credentials and compile user entity
        String securePasswordHash = passwordEncoder.encode(password);
        User newUser = new User(request.getName().trim(), email, securePasswordHash);

        // Execution: Force transactional write and immediate disk flush
        try {
            logger.info("💾 Saving entity to repository context...");
            User savedUser = userRepository.save(newUser);

            // Generate and send verification code (which will also flush changes)
            generateAndSendVerificationCode(savedUser);

            logger.info("🔊 Forcing immediate database engine synchronization flush...");
            userRepository.flush();
            entityManager.flush();

            logger.info("✅ Database forcefully committed. Assigned ID: {}", savedUser.getId());
            return savedUser;
        } catch (Exception ex) {
            logger.error("💥 CRITICAL: Database engine rejected the INSERT command during flush: ", ex);
            throw new RuntimeException(
                    "Data persistence engine failed to commit the new user profile structure: " + ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public User authenticateUser(String email, String rawPassword) {
        String normalizedEmail = email.trim().toLowerCase();
        logger.info("🔑 Authentication request processed for target: {}", normalizedEmail);

        User user;
        try {
            user = userRepository.findByEmail(normalizedEmail)
                    .orElseThrow(() -> new IllegalArgumentException("No account found matching this email address."));
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.error("❌ Database connection failure during findByEmail lookup: ", ex);
            throw new RuntimeException("Database error encountered during authentication retrieval mapping.");
        }

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            logger.warn("🔒 Failed login attempt: Incorrect password signature for address {}", normalizedEmail);
            throw new IllegalArgumentException("Invalid password credentials. Please try again.");
        }

        logger.info("🎯 Successful authentication match verified for user ID: {}", user.getId());
        return user;
    }

    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("No account found matching this email address."));
    }

    @Transactional
    public void deleteUserByEmail(String email) {
        String normalized = email.trim().toLowerCase();
        logger.info("🗑️ Deletion request for user: {}", normalized);

        try {
            if (!userRepository.existsByEmail(normalized)) {
                logger.warn("Deletion requested for non-existent email: {}", normalized);
                throw new IllegalArgumentException("No account found for the provided email address.");
            }

            userRepository.deleteByEmail(normalized);
            // Ensure flush to propagate immediately
            userRepository.flush();
            entityManager.flush();
            logger.info("✅ Deletion completed for email: {}", normalized);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.error("❌ Failed to delete user: ", ex);
            throw new RuntimeException("Failed to delete account: " + ex.getMessage());
        }
    }

    @Transactional
    public User updateProfilePicture(String email, String base64Image) {
        logger.info("Updating profile picture for email target: {}", email);
        User user = getUserByEmail(email);
        user.setProfilePicture(base64Image);
        
        try {
            User savedUser = userRepository.save(user);
            userRepository.flush();
            entityManager.flush();
            logger.info("Profile picture updated successfully for user ID: {}", savedUser.getId());
            return savedUser;
        } catch (Exception ex) {
            logger.error("Failed to persist updated profile picture: ", ex);
            throw new RuntimeException("Failed to save updated profile picture: " + ex.getMessage());
        }
    }

    @Transactional
    public void generateAndSendVerificationCode(User user) {
        String code = String.format("%06d", new java.util.Random().nextInt(1000000));
        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(java.time.LocalDateTime.now().plusMinutes(15));
        
        userRepository.save(user);
        userRepository.flush();
        entityManager.flush();
        
        emailService.sendVerificationCode(user.getEmail(), code);
    }

    @Transactional
    public User verifyEmail(String email, String code) {
        String normalizedEmail = email.trim().toLowerCase();
        logger.info("Verification code check initiated for email: {}", normalizedEmail);

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("No account found matching this email address."));

        if (user.isVerified()) {
            logger.info("User {} is already verified.", normalizedEmail);
            return user;
        }

        if (user.getVerificationCode() == null || !user.getVerificationCode().equals(code)) {
            throw new IllegalArgumentException("Invalid verification code. Please try again.");
        }

        if (user.getVerificationCodeExpiresAt() == null || 
            user.getVerificationCodeExpiresAt().isBefore(java.time.LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code has expired. Please request a new one.");
        }

        user.setVerified(true);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);

        User savedUser = userRepository.save(user);
        userRepository.flush();
        entityManager.flush();

        logger.info("✅ User {} successfully verified.", normalizedEmail);
        return savedUser;
    }

    @Transactional
    public void resendVerificationCode(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        logger.info("Resend verification code requested for email: {}", normalizedEmail);

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("No account found matching this email address."));

        if (user.isVerified()) {
            throw new IllegalArgumentException("This account is already verified.");
        }

        generateAndSendVerificationCode(user);
    }
}