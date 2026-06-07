package com.jemturk.revynd.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.MimeMessageHelper;

@Service
public class EmailService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:onboarding@resend.dev}")
    private String fromEmail;

    @Value("${app.mail.from-name:REVYND}")
    private String fromName;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendVerificationCode(String toEmail, String code) {
        logger.info("📧 ========================================");
        logger.info("📧 [EMAIL MOCK] Verification Code for {}: {}", toEmail, code);
        logger.info("📧 ========================================");
        
        if (mailSender != null) {
            try {
                MimeMessage mimeMessage = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
                
                helper.setFrom(fromName + " <" + fromEmail + ">");
                helper.setTo(toEmail);
                helper.setSubject("Verify your REVYND session");
                
                String textContent = "Welcome to REVYND!\n\nUse the verification code below to confirm your session:\n\n" + code + "\n\nThis code will expire in 15 minutes.";
                
                String htmlContent = 
                    "<div style=\"background-color: #0B0F19; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; color: #F3F4F6;\">" +
                    "  <div style=\"max-width: 480px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 20px; padding: 40px 30px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);\">" +
                    "    <h1 style=\"font-size: 36px; font-weight: 900; color: #FB923C; margin: 0 0 10px 0; letter-spacing: 4px; text-transform: uppercase;\">REVYND</h1>" +
                    "    <p style=\"font-size: 16px; color: #9CA3AF; margin: 0 0 30px 0;\">Confirm your session to track the vibe</p>" +
                    "    <div style=\"height: 1px; background-color: #1F2937; margin-bottom: 30px;\"></div>" +
                    "    <p style=\"font-size: 16px; line-height: 24px; color: #E5E7EB; margin-bottom: 25px; text-align: left;\">Welcome to REVYND! Use the 6-digit verification code below to verify your email address and authorize your session:</p>" +
                    "    <div style=\"background-color: #1F2937; border: 1px solid #374151; border-radius: 12px; padding: 18px 0; margin-bottom: 30px; letter-spacing: 6px; font-size: 32px; font-weight: bold; color: #FFFFFF; font-family: monospace;\">" + code + "</div>" +
                    "    <p style=\"font-size: 14px; color: #9CA3AF; margin-bottom: 30px; text-align: left;\">⏱️ This verification code is active for <strong>15 minutes</strong>. If expired, please trigger a new request from the mobile application.</p>" +
                    "    <div style=\"height: 1px; background-color: #1F2937; margin-bottom: 25px;\"></div>" +
                    "    <p style=\"font-size: 12px; color: #6B7280; line-height: 18px; margin: 0; text-align: left;\">If you did not request this verification code, please ignore this email or contact support if you suspect unauthorized access.</p>" +
                    "  </div>" +
                    "</div>";
                
                helper.setText(textContent, htmlContent);
                mailSender.send(mimeMessage);
                logger.info("✅ Verification email sent to {}", toEmail);
            } catch (Exception e) {
                logger.error("❌ Failed to send email to {} via JavaMailSender: {}", toEmail, e.getMessage());
            }
        }
    }

    public void sendPasswordResetCode(String toEmail, String code) {
        logger.info("📧 ========================================");
        logger.info("📧 [EMAIL MOCK] Password Reset Code for {}: {}", toEmail, code);
        logger.info("📧 ========================================");
        
        if (mailSender != null) {
            try {
                MimeMessage mimeMessage = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
                
                helper.setFrom(fromName + " <" + fromEmail + ">");
                helper.setTo(toEmail);
                helper.setSubject("Reset your REVYND Password");
                
                String textContent = "Reset your REVYND Password!\n\nUse the verification code below to authorize your password reset:\n\n" + code + "\n\nThis code will expire in 15 minutes.";
                
                String htmlContent = 
                    "<div style=\"background-color: #0B0F19; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; color: #F3F4F6;\">" +
                    "  <div style=\"max-width: 480px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 20px; padding: 40px 30px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);\">" +
                    "    <h1 style=\"font-size: 36px; font-weight: 900; color: #FB923C; margin: 0 0 10px 0; letter-spacing: 4px; text-transform: uppercase;\">REVYND</h1>" +
                    "    <p style=\"font-size: 16px; color: #9CA3AF; margin: 0 0 30px 0;\">Password Reset Request</p>" +
                    "    <div style=\"height: 1px; background-color: #1F2937; margin-bottom: 30px;\"></div>" +
                    "    <p style=\"font-size: 16px; line-height: 24px; color: #E5E7EB; margin-bottom: 25px; text-align: left;\">You requested a password reset for your REVYND account. Use the 6-digit code below to authorize this change:</p>" +
                    "    <div style=\"background-color: #1F2937; border: 1px solid #374151; border-radius: 12px; padding: 18px 0; margin-bottom: 30px; letter-spacing: 6px; font-size: 32px; font-weight: bold; color: #FFFFFF; font-family: monospace;\">" + code + "</div>" +
                    "    <p style=\"font-size: 14px; color: #9CA3AF; margin-bottom: 30px; text-align: left;\">⏱️ This authorization code is active for <strong>15 minutes</strong>. If expired, please trigger a new request from the mobile application.</p>" +
                    "    <div style=\"height: 1px; background-color: #1F2937; margin-bottom: 25px;\"></div>" +
                    "    <p style=\"font-size: 12px; color: #6B7280; line-height: 18px; margin: 0; text-align: left;\">If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized access.</p>" +
                    "  </div>" +
                    "</div>";
                
                helper.setText(textContent, htmlContent);
                mailSender.send(mimeMessage);
                logger.info("✅ Password reset email sent to {}", toEmail);
            } catch (Exception e) {
                logger.error("❌ Failed to send password reset email to {} via JavaMailSender: {}", toEmail, e.getMessage());
            }
        } else {
            logger.info("ℹ️ JavaMailSender is not configured. Email not sent, code logged to console.");
        }
    }
}
