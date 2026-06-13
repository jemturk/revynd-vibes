package com.jemturk.revynd.backend.controller;

import java.time.LocalDateTime;
import java.util.List;
import com.jemturk.revynd.backend.service.ExpoPushNotificationService;

import java.util.Map;
import java.util.stream.Collectors;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.transaction.annotation.Transactional;

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
    private final ExpoPushNotificationService expoPushNotificationService;

    private static final java.util.concurrent.ConcurrentHashMap<Long, LocalDateTime> lastPeakAlertTime = new java.util.concurrent.ConcurrentHashMap<>();

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
            LocalDateTime limit = LocalDateTime.now().minusSeconds(5);
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        // Calculate actual intensity based on recent check-ins in the database
        // (including this new one)
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
    public ResponseEntity<List<CheckInRecord>> getUserCheckInHistory(
            @RequestParam(required = false, defaultValue = "false") boolean archived,
            Principal principal) {
        // 🔒 Get currently authenticated user from Principal
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 🔒 The DB only returns the records belonging to the calling User ID
        List<CheckInRecord> history = archived
                ? checkInRepository.findArchivedHistoryByUserId(user.getId())
                : checkInRepository.findHistoryByUserId(user.getId());
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

    @PutMapping("/history/{id}/archive")
    @Transactional
    public ResponseEntity<Void> archiveHistoryItem(@PathVariable Long id, Principal principal) {
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

        checkIn.setArchived(true);
        checkInRepository.save(checkIn);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/history/{id}/unarchive")
    @Transactional
    public ResponseEntity<Void> unarchiveHistoryItem(@PathVariable Long id, Principal principal) {
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

        checkIn.setArchived(false);
        checkInRepository.save(checkIn);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/history/batch-archive")
    @Transactional
    public ResponseEntity<Void> batchArchiveHistory(@RequestBody List<Long> ids, Principal principal) {
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<CheckIn> checkIns = checkInRepository.findAllById(ids);
        for (CheckIn c : checkIns) {
            if (c.getUser().getId().equals(user.getId())) {
                c.setArchived(true);
            }
        }
        checkInRepository.saveAll(checkIns);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/history/batch-unarchive")
    @Transactional
    public ResponseEntity<Void> batchUnarchiveHistory(@RequestBody List<Long> ids, Principal principal) {
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<CheckIn> checkIns = checkInRepository.findAllById(ids);
        for (CheckIn c : checkIns) {
            if (c.getUser().getId().equals(user.getId())) {
                c.setArchived(false);
            }
        }
        checkInRepository.saveAll(checkIns);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/history/batch-delete")
    @Transactional
    public ResponseEntity<Void> batchDeleteHistory(@RequestBody List<Long> ids, Principal principal) {
        String email = principal.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<CheckIn> checkIns = checkInRepository.findAllById(ids);
        List<CheckIn> toDelete = checkIns.stream()
                .filter(c -> c.getUser().getId().equals(user.getId()))
                .collect(Collectors.toList());

        checkInRepository.deleteAll(toDelete);
        return ResponseEntity.noContent().build();
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

            // Prevent duplicate creation due to concurrency or rapid taps: check if spot
            // exists within 100m
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
                spot.setCategory(request.getCategory());
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
            LocalDateTime limit = LocalDateTime.now().minusSeconds(6); // Same threshold as existing config
            if (lastCheckIn.getCheckInTime().isAfter(limit)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Slow down! You can only boost the vibe once per hour.");
            }
        }

        // Calculate actual intensity based on recent check-ins in the database
        // (including this new one)
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        List<CheckIn> recentCheckIns = checkInRepository.findBySpotIdAndCheckInTimeAfter(spot.getId(), oneHourAgo);
        long count = recentCheckIns.size() + 1; // recent check-ins + this new one
        double updatedIntensity = Math.min(1.0, count * 0.05);

        spot.setIntensity(updatedIntensity);
        spotRepository.save(spot); // Update the source

        // Save the new check-in
        CheckIn checkIn = new CheckIn();
        checkIn.setSpot(spot);
        checkIn.setVibeTag(request.getVibeTag());
        checkIn.setIntensityAtTime(spot.getIntensity());
        checkIn.setUser(user);
        checkInRepository.save(checkIn);

        // Include this check-in in the recent list for mode calculation
        recentCheckIns.add(checkIn);

        // Calculate the most popular vibe tag in the last hour
        String mostCommonVibe = recentCheckIns.stream()
                .map(CheckIn::getVibeTag)
                .filter(v -> v != null && !v.trim().isEmpty())
                .collect(Collectors.groupingBy(v -> v, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(spot.getVibe());

        spot.setVibe(mostCommonVibe);
        spotRepository.save(spot); // Update the spot with new vibe and intensity

        // VIBE PEAK ALERT TRIGGER CHECK
        double intensity = spot.getIntensity();
        if (intensity >= 0.25) {
            triggerVibePeakAlert(spot);
        }

        return ResponseEntity.ok("Check-in successful");
    }

    private void triggerVibePeakAlert(Spot spot) {
        Long spotId = spot.getId();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime lastAlert = lastPeakAlertTime.get(spotId);

        // 1-hour cooldown per spot to prevent notification spamming
        if (lastAlert != null && lastAlert.isAfter(now.minusHours(1))) {
            return;
        }

        lastPeakAlertTime.put(spotId, now);

        // Coordinates of the peaking spot
        double spotLat = spot.getLocation().getY();
        double spotLng = spot.getLocation().getX();

        // Bounding box for approximately 5 miles (0.0725 deg latitude, 0.0947 deg
        // longitude)
        double minLat = spotLat - 0.0725;
        double maxLat = spotLat + 0.0725;
        double minLng = spotLng - 0.0947;
        double maxLng = spotLng + 0.0947;

        List<User> candidateUsers = userRepository.findUsersWithPushTokenInBoundingBox(minLat, maxLat, minLng, maxLng);

        for (User u : candidateUsers) {
            if (u.getLastLatitude() == null || u.getLastLongitude() == null || u.getPushToken() == null) {
                continue;
            }
            if (!u.isNotifVibePeak()) {
                continue; // Skip if user disabled vibe peak alerts
            }

            // Haversine formula for exact 5-mile (8046.72 meters) circle verification
            double distance = calculateDistanceInMeters(spotLat, spotLng, u.getLastLatitude(), u.getLastLongitude());
            if (distance <= 8046.72) {
                String title = "Vibe Peak Alert! 🔥";
                String body = "The vibe at " + spot.getName() + " is peaking right now! (Intensity: "
                        + String.format("%.0f%%", spot.getIntensity() * 100) + "). Check it out!";
                Map<String, Object> data = Map.of(
                        "spotId", String.valueOf(spot.getId()),
                        "type", "vibe_peak");

                expoPushNotificationService.sendPushNotification(u.getPushToken(), title, body, data);
            }
        }
    }

    // Helper method for Haversine distance in meters
    private double calculateDistanceInMeters(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371000; // Earth's radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}