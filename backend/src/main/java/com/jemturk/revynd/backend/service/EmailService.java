package com.jemturk.revynd.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:onboarding@resend.dev}")
    private String fromEmail;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendVerificationCode(String toEmail, String code) {
        logger.info("📧 ========================================");
        logger.info("📧 [EMAIL MOCK] Verification Code for {}: {}", toEmail, code);
        logger.info("📧 ========================================");
        
        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(toEmail);
                message.setSubject("REVYND Email Verification");
                message.setText("Welcome to REVYND!\n\nYour email verification code is: " + code + "\n\nThis code will expire in 15 minutes.");
                mailSender.send(message);
                logger.info("✅ Verification email sent to {}", toEmail);
            } catch (Exception e) {
                logger.error("❌ Failed to send email to {} via JavaMailSender: {}", toEmail, e.getMessage());
            }
        } else {
            logger.info("ℹ️ JavaMailSender is not configured. Email not sent, code logged to console.");
        }
    }
}
