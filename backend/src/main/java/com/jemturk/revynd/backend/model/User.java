package com.jemturk.revynd.backend.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "users", uniqueConstraints = {
    @UniqueConstraint(columnNames = "email") // Guarantees database-level uniqueness for emails
})
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Name is required")
    @Size(min = 3, message = "Name must be at least 3 characters")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    @Column(nullable = false, unique = true)
    private String email;

    @NotBlank(message = "Password is required")
    @Column(nullable = false)
    private String password; // This will hold the secure BCrypt hash, never plain text

    @Column(name = "profile_picture", columnDefinition = "TEXT")
    private String profilePicture;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "push_token")
    private String pushToken;

    @Column(name = "last_latitude")
    private Double lastLatitude;

    @Column(name = "last_longitude")
    private Double lastLongitude;

    @Column(name = "notif_vibe_peak", nullable = false, columnDefinition = "boolean default true")
    private boolean notifVibePeak = true;

    @Column(name = "notif_proximity", nullable = false, columnDefinition = "boolean default true")
    private boolean notifProximity = true;

    @Column(name = "notif_social", nullable = false, columnDefinition = "boolean default true")
    private boolean notifSocial = true;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "verification_code")
    private String verificationCode;

    @Column(name = "verification_code_expires_at")
    private java.time.LocalDateTime verificationCodeExpiresAt;

    @Column(name = "reset_password_code")
    private String resetPasswordCode;

    @Column(name = "reset_password_code_expires_at")
    private java.time.LocalDateTime resetPasswordCodeExpiresAt;

    // Constructors
    public User() {}

    public User(String name, String email, String password) {
        this.name = name;
        this.email = email;
        this.password = password;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getPushToken() { return pushToken; }
    public void setPushToken(String pushToken) { this.pushToken = pushToken; }
    public Double getLastLatitude() { return lastLatitude; }
    public void setLastLatitude(Double lastLatitude) { this.lastLatitude = lastLatitude; }
    public Double getLastLongitude() { return lastLongitude; }
    public void setLastLongitude(Double lastLongitude) { this.lastLongitude = lastLongitude; }

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public String getVerificationCode() { return verificationCode; }
    public void setVerificationCode(String verificationCode) { this.verificationCode = verificationCode; }
    public java.time.LocalDateTime getVerificationCodeExpiresAt() { return verificationCodeExpiresAt; }
    public void setVerificationCodeExpiresAt(java.time.LocalDateTime verificationCodeExpiresAt) { this.verificationCodeExpiresAt = verificationCodeExpiresAt; }

    public String getResetPasswordCode() { return resetPasswordCode; }
    public void setResetPasswordCode(String resetPasswordCode) { this.resetPasswordCode = resetPasswordCode; }
    public java.time.LocalDateTime getResetPasswordCodeExpiresAt() { return resetPasswordCodeExpiresAt; }
    public void setResetPasswordCodeExpiresAt(java.time.LocalDateTime resetPasswordCodeExpiresAt) { this.resetPasswordCodeExpiresAt = resetPasswordCodeExpiresAt; }

    public boolean isNotifVibePeak() { return notifVibePeak; }
    public void setNotifVibePeak(boolean notifVibePeak) { this.notifVibePeak = notifVibePeak; }
    public boolean isNotifProximity() { return notifProximity; }
    public void setNotifProximity(boolean notifProximity) { this.notifProximity = notifProximity; }
    public boolean isNotifSocial() { return notifSocial; }
    public void setNotifSocial(boolean notifSocial) { this.notifSocial = notifSocial; }
}