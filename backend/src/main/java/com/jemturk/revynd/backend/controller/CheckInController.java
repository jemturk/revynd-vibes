package com.jemturk.revynd.backend.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jemturk.revynd.backend.dto.CheckInRecord;
import com.jemturk.revynd.backend.dto.CheckInRequestDTO;
import com.jemturk.revynd.backend.model.CheckIn;
import com.jemturk.revynd.backend.model.Spot;
import java.security.Principal;
import com.jemturk.revynd.backend.model.User;
import com.jemturk.revynd.backend.repository.UserRepository;
import com.jemturk.revynd.backend.repository.CheckInRepository;
import com.jemturk.revynd.backend.repository.SpotRepository;
import org.springframework.web.bind.annotation.RequestBody;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/checkins")
@RequiredArgsConstructor
public class CheckInController {

    private static final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    private final CheckInRepository checkInRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;

    @PostMapping("/{spotId}")
    public ResponseEntity<?> createCheckIn(@PathVariable Long spotId, Principal principal) {
        // 1. Find the spot
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new RuntimeException("Spot not found"));

        // Get currently authenticated user
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 2. 🛡️ Spam Protection: Check for recent check-ins belonging to this user
        CheckIn lastCheckIn = checkInRepository.findFirstBySpotIdAndUserIdOrderByCheckInTimeDesc(spotId, user.getId());

        if (lastCheckIn != null) {
            // LocalDateTime limit = LocalDateTime.now().minusHours(1);
            LocalDateTime limit = LocalDateTime.now().minusSeconds(1);
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        // Calculate actual intensity based on recent check-ins in the database (including this new one)
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        List<CheckIn> recentCheckIns = checkInRepository.findBySpotIdAndCheckInTimeAfter(spotId, oneHourAgo);
        long count = recentCheckIns.size() + 1; // recent check-ins + this new one
        double updatedIntensity = Math.min(1.0, count * 0.05);

        spot.setIntensity(updatedIntensity);
        spotRepository.save(spot); // Update the source

        // 3. Save the new check-in
        CheckIn checkIn = new CheckIn();
        checkIn.setSpot(spot);
        checkIn.setIntensityAtTime(spot.getIntensity());
        checkIn.setUser(user);
        checkInRepository.save(checkIn);

        return ResponseEntity.ok("Check-in successful");
    }

    @GetMapping("/history")
    public ResponseEntity<List<CheckInRecord>> getUserCheckInHistory(Principal principal) {
        // 🔒 Get currently authenticated user from Principal
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 🔒 The DB only returns the records belonging to the calling User ID
        List<CheckInRecord> history = checkInRepository.findHistoryByUserId(user.getId());
        return ResponseEntity.ok(history);
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<Void> deleteHistoryItem(@PathVariable Long id, Principal principal) {
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        CheckIn checkIn = checkInRepository.findById(id).orElse(null);
        if (checkIn == null) {
            return ResponseEntity.notFound().build();
        }

        if (!checkIn.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        checkInRepository.delete(checkIn);
        return ResponseEntity.noContent().build(); // Sends 204 Success
    }

    @PostMapping("/checkins")
    public ResponseEntity<?> checkIn(@RequestBody CheckInRequestDTO request, Principal principal) {
        // Get currently authenticated user
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Spot spot;
        if (request.getId().startsWith("transient-")) {
            double[] coords = request.getLocation();
            
            // Prevent duplicate creation due to concurrency or rapid taps: check if spot exists within 100m
            List<Spot> nearbyMatches = spotRepository.findNearby(coords[1], coords[0], 100.0);
            Spot existingSpot = nearbyMatches.stream()
                    .filter(s -> s.getName().equalsIgnoreCase(request.getName()))
                    .findFirst()
                    .orElse(null);
            
            if (existingSpot != null) {
                spot = existingSpot;
            } else {
                Point spatialPoint = geometryFactory.createPoint(new Coordinate(coords[0], coords[1]));

                spot = new Spot();
                spot.setName(request.getName());
                spot.setVibe(request.getVibe());
                spot.setLocation(spatialPoint);
                spot.setIntensity(0.0);

                spot = spotRepository.save(spot);
            }
        } else {
            spot = spotRepository.findById(Long.parseLong(request.getId()))
                    .orElseThrow(() -> new RuntimeException("Spot not found"));
        }

        // 🛡️ Spam Protection: Check for recent check-ins belonging to this user
        CheckIn lastCheckIn = checkInRepository.findFirstBySpotIdAndUserIdOrderByCheckInTimeDesc(spot.getId(),
                user.getId());

        if (lastCheckIn != null) {
            LocalDateTime limit = LocalDateTime.now().minusSeconds(1); // Same threshold as existing config
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        // Calculate actual intensity based on recent check-ins in the database (including this new one)
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        List<CheckIn> recentCheckIns = checkInRepository.findBySpotIdAndCheckInTimeAfter(spot.getId(), oneHourAgo);
        long count = recentCheckIns.size() + 1; // recent check-ins + this new one
        double updatedIntensity = Math.min(1.0, count * 0.05);

        spot.setIntensity(updatedIntensity);
        spotRepository.save(spot); // Update the source

        // Save the new check-in
        CheckIn checkIn = new CheckIn();
        checkIn.setSpot(spot);
        checkIn.setIntensityAtTime(spot.getIntensity());
        checkIn.setUser(user);
        checkInRepository.save(checkIn);

        return ResponseEntity.ok("Check-in successful");
    }
}