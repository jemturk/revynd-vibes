package com.jemturk.revynd.vibe_app.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jemturk.revynd.vibe_app.model.CheckIn;
import com.jemturk.revynd.vibe_app.model.Spot;
import com.jemturk.revynd.vibe_app.repository.CheckInRepository;
import com.jemturk.revynd.vibe_app.repository.SpotRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class IntensityDecayService {

    private final CheckInRepository checkInRepository;
    private final SpotRepository spotRepository;

    /**
     * Scheduled task that runs every hour to update spot intensity based on check-in count.
     * Intensity = min(1.0, checkInCount * 0.1) for check-ins in the last hour.
     * 1 check-in = 0.1, 9 check-ins = 0.9, 10+ check-ins = 1.0
     * Spots with no check-ins in the last hour have intensity set to 0.
     */
    @Scheduled(fixedRate = 3600000) // 60 minutes in milliseconds
    @Transactional
    public void updateIntensityFromCheckIns() {
        log.info("Starting intensity update task");
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime oneHourAgo = now.minusHours(1);
        
        // Get all spots in the system
        List<Spot> allSpots = spotRepository.findAll();
        
        // Get all check-ins from the past hour
        List<CheckIn> recentCheckIns = checkInRepository.findByCheckInTimeAfter(oneHourAgo);
        
        // Group check-ins by spot and count them
        Map<Spot, Long> checkInCountBySpot = recentCheckIns.stream()
                .collect(Collectors.groupingBy(
                        CheckIn::getSpot,
                        Collectors.counting()
                ));
        
        // Update intensity for all spots
        allSpots.forEach(spot -> {
            double newIntensity;
            
            if (checkInCountBySpot.containsKey(spot)) {
                // Spot has recent check-ins: intensity = min(1.0, count * 0.1)
                long count = checkInCountBySpot.get(spot);
                newIntensity = Math.min(1.0, count * 0.1);
                log.debug("Updated spot {} intensity to {} based on {} check-ins",
                        spot.getId(), 
                        newIntensity,
                        count);
            } else {
                // No recent check-ins: intensity = 0
                newIntensity = 0.0;
                log.debug("Set spot {} intensity to 0 (no recent check-ins)", spot.getId());
            }
            
            spot.setIntensity(newIntensity);
            spotRepository.save(spot);
        });
        
        log.info("Intensity update task completed. Processed {} spots", allSpots.size());
    }
}
