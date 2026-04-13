package com.jemturk.revynd.vibe_app.controller;

import org.springframework.web.bind.annotation.*;

import com.jemturk.revynd.vibe_app.dto.SpotRecord;
import com.jemturk.revynd.vibe_app.model.Spot;
import com.jemturk.revynd.vibe_app.repository.CheckInRepository;
import com.jemturk.revynd.vibe_app.repository.SpotRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/spots")
@CrossOrigin(origins = "*") // Allows your mobile app to talk to the backend
public class SpotController {

    private final SpotRepository spotRepository;
    private final CheckInRepository checkInRepository;

    public SpotController(SpotRepository spotRepository, CheckInRepository checkInRepository) {
        this.spotRepository = spotRepository;
        this.checkInRepository = checkInRepository;
    }

    @GetMapping("/nearby")
    public List<Spot> getNearby(@RequestParam double lat, @RequestParam double lng,
            @RequestParam(defaultValue = "1000") double radius) {
        return spotRepository.findNearby(lat, lng, radius);
    }

    @GetMapping
    public List<SpotRecord> getAllSpots() {
        // 1. Define the "Recent" window (1 hour)
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);

        // 2. Fetch all spots from DB
        List<Spot> allSpots = spotRepository.findAll();

        // 3. Fetch check-in counts in ONE query using the optimized GROUP BY method
        List<Object[]> countResults = checkInRepository.findRecentCheckInCounts(oneHourAgo);

        // 4. Map the results into a quick-lookup Map: {spotId -> count}
        Map<Long, Long> countsMap = countResults.stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]));

        // 5. Convert entities to Records (DTOs) with the calculated intensity
        return allSpots.stream().map(spot -> {
            long count = countsMap.getOrDefault(spot.getId(), 0L);

            // Logic: 5 check-ins in the last hour = 1.0 (max glow)
            // Each check-in adds 0.2 to the intensity
            double intensity = Math.min(1.0, count * 0.05);

            return new SpotRecord(
                    spot.getId(),
                    spot.getName(),
                    spot.getVibe(),
                    spot.getLocation(),
                    intensity);
        }).collect(Collectors.toList());
    }
}