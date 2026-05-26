package com.jemturk.revynd.backend.service;

import java.util.List;
import java.util.Set;
import java.util.ArrayList;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.jemturk.revynd.backend.model.Spot;
import com.jemturk.revynd.backend.dto.SpotResponseDTO;
import com.jemturk.revynd.backend.dto.MapboxSearchResponse;
import com.jemturk.revynd.backend.dto.MapboxFeature;
import com.jemturk.revynd.backend.repository.SpotRepository;

@Service
public class SpotDiscoveryService {

    @Value("${mapbox.access.token:}")
    private String mapboxToken;

    @Autowired
    private SpotRepository spotRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<SpotResponseDTO> getUnifiedSpots(double lat, double lng, String categories) {
        // 1. Fetch spots that ALREADY exist in your database within a loose bounding box or radius
        List<Spot> savedSpots = spotRepository.findNearbySpots(lat, lng);

        // Map saved spots to your response DTO structure
        List<SpotResponseDTO> unifiedList = savedSpots.stream()
                .map(spot -> new SpotResponseDTO(spot, true)) // true = saved in DB
                .collect(Collectors.toCollection(ArrayList::new));

        // Set up a quick lookup set of IDs or Coordinates to prevent duplicate listings
        Set<String> existingNames = savedSpots.stream()
                .map(Spot::getName)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        // 2. Query Mapbox Search API for external POIs in the area
        String mapboxUrl = String.format(
                "https://api.mapbox.com/search/searchbox/v1/category/%s?access_token=%s&proximity=%f,%f&limit=25",
                categories, mapboxToken, lng, lat);

        try {
            MapboxSearchResponse response = restTemplate.getForObject(mapboxUrl, MapboxSearchResponse.class);

            if (response != null && response.getFeatures() != null) {
                for (MapboxFeature feature : response.getFeatures()) {
                    String name = feature.getProperties().getName();

                    // Skip if the venue is already active and tracked in our database
                    if (existingNames.contains(name.toLowerCase())) {
                        continue;
                    }

                    // Create a transient (unsaved) DTO with an intensity of 0.0
                    SpotResponseDTO transientSpot = new SpotResponseDTO();
                    transientSpot.setId("transient-" + feature.getProperties().getMapboxId());
                    transientSpot.setName(name);
                    transientSpot.setCategory(feature.getProperties().getCategoryString());
                    transientSpot.setVibe("");
                    transientSpot.setIntensity(0.0); // No check-ins yet = dead vibe glow
                    transientSpot.setLocation(feature.getGeometry().getCoordinates()); // [Lng, Lat]
                    transientSpot.setSaved(false);

                    unifiedList.add(transientSpot);
                }
            }
        } catch (Exception e) {
            // Fallback gracefully if Mapbox rate limits or drops out so your app doesn't crash
            System.err.println("Mapbox external POI lookup failed: " + e.getMessage());
        }

        return unifiedList;
    }
}
