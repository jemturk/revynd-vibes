package com.jemturk.revynd.vibe_app.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jemturk.revynd.vibe_app.model.CheckIn;
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
        return spotRepository.findById(spotId).map(spot -> {
            CheckIn checkIn = new CheckIn();
            checkIn.setSpot(spot);
            
            // Logic: Every check-in boosts intensity by 5%
            spot.setIntensity(Math.min(1.0, spot.getIntensity() + 0.05));
            spotRepository.save(spot);
            
            return ResponseEntity.ok(checkInRepository.save(checkIn));
        }).orElse(ResponseEntity.notFound().build());
    }
}