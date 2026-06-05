package com.jemturk.revynd.backend.controller;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.jemturk.revynd.backend.dto.RegisterRequest;
import com.jemturk.revynd.backend.model.User;
import com.jemturk.revynd.backend.service.AuthService;

import java.security.Principal;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Ensures your phone handset avoids localized browser CORS proxy drops
public class AuthController {

    // ⚠️ Must match the exact key string inside your JwtAuthenticationFilter configuration block
    private final String SECRET_KEY = "YOUR_SUPER_SECRET_COMPLEX_SIGNING_KEY_HERE";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @RequestMapping(path = "/delete", method = {RequestMethod.DELETE, RequestMethod.POST})
    public ResponseEntity<?> deleteCurrentUser(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required to delete an account."));
        }

        authService.deleteUserByEmail(email);
        return ResponseEntity.ok(Map.of("message", "Account deleted."));
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest request) {
        // 1. Pass the incoming DTO straight to the service layer to hit Supabase
        // If the email matches an existing entry, this explicitly throws an IllegalArgumentException
        User savedUser = authService.registerNewUser(request);

        // 2. Assemble the response indicating verification is required
        Map<String, Object> response = new HashMap<>();
        response.put("verified", false);
        response.put("email", savedUser.getEmail());
        response.put("message", "Registration successful. A verification code has been sent to your email.");

        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String rawPassword = request.get("password");

        // 1. Defend against blank submissions before touching the service layer
        if (email == null || rawPassword == null || email.trim().isEmpty() || rawPassword.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email and password are required."));
        }

        // 2. Invoke AuthService to execute the Supabase lookup and BCrypt password evaluation
        User authenticatedUser = authService.authenticateUser(email, rawPassword);

        // 3. Verify user has verified their email address
        if (!authenticatedUser.isVerified()) {
            authService.generateAndSendVerificationCode(authenticatedUser);
            Map<String, Object> response = new HashMap<>();
            response.put("verified", false);
            response.put("email", authenticatedUser.getEmail());
            response.put("message", "Your account is not verified. A new verification code has been sent to your email.");
            return ResponseEntity.ok(response);
        }

        // 4. Generate a fresh session security token on successful verification match
        String token = generateJwtToken(authenticatedUser.getEmail());

        // 5. Map down the exact success signature your React Native client expects
        Map<String, String> response = new HashMap<>();
        response.put("id", String.valueOf(authenticatedUser.getId()));
        response.put("name", authenticatedUser.getName());
        response.put("email", authenticatedUser.getEmail());
        response.put("token", token);
        response.put("profilePicture", authenticatedUser.getProfilePicture());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        if (email == null || code == null || email.trim().isEmpty() || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email and verification code are required."));
        }

        User verifiedUser = authService.verifyEmail(email, code);
        String token = generateJwtToken(verifiedUser.getEmail());

        Map<String, String> response = new HashMap<>();
        response.put("id", String.valueOf(verifiedUser.getId()));
        response.put("name", verifiedUser.getName());
        response.put("email", verifiedUser.getEmail());
        response.put("token", token);
        response.put("profilePicture", verifiedUser.getProfilePicture());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/resend-code")
    public ResponseEntity<?> resendCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required."));
        }

        authService.resendVerificationCode(email);
        return ResponseEntity.ok(Map.of("message", "Verification code resent successfully."));
    }

    @PutMapping("/profile-picture")
    public ResponseEntity<?> updateProfilePicture(@RequestBody Map<String, String> request, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "User is not authenticated."));
        }
        
        String email = principal.getName();
        String base64Image = request.get("profilePicture");
        
        if (base64Image == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "profilePicture payload is required."));
        }
        
        User updatedUser = authService.updateProfilePicture(email, base64Image);
        return ResponseEntity.ok(Map.of(
            "message", "Profile picture updated successfully",
            "profilePicture", updatedUser.getProfilePicture() != null ? updatedUser.getProfilePicture() : ""
        ));
    }

    private String generateJwtToken(String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(email) 
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + 864000000)) // 10 days duration boundary scale
                .signWith(Keys.hmacShaKeyFor(SECRET_KEY.getBytes()))
                .compact();
    }

    /**
     * 🎯 CATCHES THE DUPLICATE USER EXCEPTIONS BEFORE SECURITY CAN HIJACK THE RESPONSE
     * This forces the backend to send a structured JSON error body alongside an HTTP 400 Bad Request status code.
     */
    @ExceptionHandler({IllegalArgumentException.class, RuntimeException.class})
    public ResponseEntity<Map<String, String>> handleBusinessLogicExceptions(Exception ex) {
        // Extract the target exception message string
        String exceptionMessage = ex.getMessage();

        // Standardize the JSON object wrapper keys so the frontend handles parsing cleanly
        Map<String, String> errorResponse = Map.of(
                "error", "Bad Request",
                "message", exceptionMessage != null ? exceptionMessage : "An unexpected service error occurred."
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
}