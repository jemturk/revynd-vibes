package com.jemturk.revynd.vibe_app.controller;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
            LocalDateTime limit = LocalDateTime.now().minusHours(1);
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        // 3. Save the new check-in
        CheckIn checkIn = new CheckIn();
        checkIn.setSpot(spot);
        checkInRepository.save(checkIn);

        return ResponseEntity.ok("Check-in successful");
    }
}