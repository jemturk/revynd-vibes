package com.jemturk.revynd.vibe_app.controller;

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
import org.springframework.web.bind.annotation.RestController;

import com.jemturk.revynd.vibe_app.dto.CheckInRecord;
import com.jemturk.revynd.vibe_app.model.CheckIn;
import com.jemturk.revynd.vibe_app.model.Spot;
import com.jemturk.revynd.vibe_app.repository.CheckInRepository;
import com.jemturk.revynd.vibe_app.repository.SpotRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/checkins")
@RequiredArgsConstructor
public class CheckInController {

    private final CheckInRepository checkInRepository;
    private final SpotRepository spotRepository;

    @PostMapping("/{spotId}")
    public ResponseEntity<?> createCheckIn(@PathVariable Long spotId) {
        // 1. Find the spot
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new RuntimeException("Spot not found"));

        // 2. 🛡️ Spam Protection: Check for recent check-ins
        // (In the future, add: "AND userId = :currentUserId")
        CheckIn lastCheckIn = checkInRepository.findFirstBySpotIdOrderByCheckInTimeDesc(spotId);

        if (lastCheckIn != null) {
            // LocalDateTime limit = LocalDateTime.now().minusHours(1);
            LocalDateTime limit = LocalDateTime.now().minusSeconds(1);
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        double currentIntensity = spot.getIntensity() != null ? spot.getIntensity() : 0.0;
        // Add 10% for every new check-in, capping at 1.0 (100%)
        double updatedIntensity = Math.min(1.0, currentIntensity + 0.1);
        
        spot.setIntensity(updatedIntensity);
        spotRepository.save(spot); // Update the source

        // 3. Save the new check-in
        CheckIn checkIn = new CheckIn();
        checkIn.setSpot(spot);
        checkIn.setIntensityAtTime(spot.getIntensity());
        checkInRepository.save(checkIn);

        return ResponseEntity.ok("Check-in successful");
    }

    @GetMapping("/history")
    public List<CheckInRecord> getHistory() {
        return checkInRepository.findAllByOrderByCheckInTimeDesc()
                .stream()
                .map(ci -> new CheckInRecord(
                        ci.getId(),
                        ci.getSpot().getName(),
                        ci.getSpot().getVibe(),
                        ci.getCheckInTime(),
                        // Return the intensity that was saved at check-in time, not current
                        ci.getIntensityAtTime()))
                .toList();
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<Void> deleteHistoryItem(@PathVariable Long id) {
        try {
            checkInRepository.deleteById(id);
            return ResponseEntity.noContent().build(); // Sends 204 Success
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.notFound().build(); // Sends 404 if ID is wrong
        }
    }
}