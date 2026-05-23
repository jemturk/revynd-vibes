package com.jemturk.revynd.backend.controller;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.jemturk.revynd.backend.dto.RegisterRequest;
import com.jemturk.revynd.backend.model.User;
import com.jemturk.revynd.backend.service.AuthService;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // ⚠️ Must match the exact key string inside your JwtAuthenticationFilter
    private final String SECRET_KEY = "YOUR_SUPER_SECRET_COMPLEX_SIGNING_KEY_HERE";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest request) {

        // 2. Pass the incoming DTO straight to the service layer to hit Supabase
        User savedUser = authService.registerNewUser(request);

        // 3. Generate your JWT security token using the validated email
        String token = generateJwtToken(savedUser.getEmail());

        // 4. Assemble the exact clean payload response your phone app expects
        Map<String, String> response = new HashMap<>();
        response.put("id", String.valueOf(savedUser.getId()));
        response.put("name", savedUser.getName());
        response.put("email", savedUser.getEmail());
        response.put("token", token);

        return ResponseEntity.ok(response);
    }

@PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String rawPassword = request.get("password");

        // 1. Defend against blank submissions before touching the service layer
        if (email == null || rawPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email and password are required."));
        }

        // 2. Invoke AuthService to execute the Supabase lookup and BCrypt password evaluation
        // This will automatically throw an IllegalArgumentException if credentials fail
        User authenticatedUser = authService.authenticateUser(email, rawPassword);

        // 3. Generate a fresh session security token on successful verification match
        String token = generateJwtToken(authenticatedUser.getEmail());

        // 4. Map down the exact success signature your React Native client expects
        Map<String, String> response = new HashMap<>();
        response.put("id", String.valueOf(authenticatedUser.getId()));
        response.put("name", authenticatedUser.getName());
        response.put("email", authenticatedUser.getEmail());
        response.put("token", token);

        return ResponseEntity.ok(response);
    }

    private String generateJwtToken(String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(email) // 👈 Direct setter, no sub-builder required
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + 864000000)) // 10 days
                .signWith(Keys.hmacShaKeyFor(SECRET_KEY.getBytes()))
                .compact();
    }
}