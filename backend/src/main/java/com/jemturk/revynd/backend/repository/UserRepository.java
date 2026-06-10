package com.jemturk.revynd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.jemturk.revynd.backend.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Look up users uniquely by email address
    Optional<User> findByEmail(String email);
    
    // Quick boolean check to guard against duplicate signups
    boolean existsByEmail(String email);
    
    // Remove a user by email
    void deleteByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.pushToken IS NOT NULL AND u.lastLatitude BETWEEN :minLat AND :maxLat AND u.lastLongitude BETWEEN :minLng AND :maxLng")
    List<User> findUsersWithPushTokenInBoundingBox(
        @Param("minLat") Double minLat,
        @Param("maxLat") Double maxLat,
        @Param("minLng") Double minLng,
        @Param("maxLng") Double maxLng
    );
}