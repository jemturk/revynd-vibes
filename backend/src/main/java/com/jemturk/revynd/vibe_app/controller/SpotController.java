package com.jemturk.revynd.vibe_app.controller;

import org.springframework.web.bind.annotation.*;

import com.jemturk.revynd.vibe_app.model.Spot;
import com.jemturk.revynd.vibe_app.repository.SpotRepository;

import java.util.List;

@RestController
@RequestMapping("/api/spots")
@CrossOrigin(origins = "*") // Allows your mobile app to talk to the backend
public class SpotController {

    private final SpotRepository spotRepository;

    public SpotController(SpotRepository spotRepository) {
        this.spotRepository = spotRepository;
    }

    @GetMapping
    public List<Spot> getAllSpots() {
        return spotRepository.findAll();
    }

    @GetMapping("/nearby")
    public List<Spot> getNearby(@RequestParam double lat, @RequestParam double lng, @RequestParam(defaultValue = "1000") double radius) {
        return spotRepository.findNearby(lat, lng, radius);
    }
}