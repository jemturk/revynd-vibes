package com.jemturk.revynd.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Keep disabled for stateless APIs
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll() // Login/Register stay public
                        .requestMatchers("/api/spots/**").permitAll() // 🗺️ Allow public spot exploration!
                        .requestMatchers("/api/checkins/**").authenticated() // 🔒 Locked back down!
                        .requestMatchers("/icon.png", "/privacy-policy.html", "/error").permitAll() // Allow public logo, privacy policy, and error page
                        .anyRequest().authenticated())
                // Inject our custom token validator into the standard security filter pipeline
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}