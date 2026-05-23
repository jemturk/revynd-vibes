package com.jemturk.revynd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.jemturk.revynd.backend.model.User;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Look up users uniquely by email address
    Optional<User> findByEmail(String email);
    
    // Quick boolean check to guard against duplicate signups
    boolean existsByEmail(String email);
    
    // Remove a user by email
    void deleteByEmail(String email);
}