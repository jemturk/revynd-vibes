package com.jemturk.revynd.backend.dto;

import org.locationtech.jts.geom.Point;
import com.jemturk.revynd.backend.model.Spot;

public class SpotResponseDTO {
    private String id;
    private String name;
    private String vibe;
    private double intensity;
    private double[] location; // [Longitude, Latitude]
    private boolean isSaved;

    public SpotResponseDTO() {
    }

    public SpotResponseDTO(Spot spot, boolean isSaved) {
        this.id = String.valueOf(spot.getId());
        this.name = spot.getName();
        this.vibe = spot.getVibe();
        this.intensity = spot.getIntensity() != null ? spot.getIntensity() : 0.0;
        this.isSaved = isSaved;

        if (spot.getLocation() != null) {
            Point point = spot.getLocation();
            this.location = new double[] { point.getX(), point.getY() };
        }
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVibe() {
        return vibe;
    }

    public void setVibe(String vibe) {
        this.vibe = vibe;
    }

    public double getIntensity() {
        return intensity;
    }

    public void setIntensity(double intensity) {
        this.intensity = intensity;
    }

    public double[] getLocation() {
        return location;
    }

    public void setLocation(double[] location) {
        this.location = location;
    }

    public boolean isSaved() {
        return isSaved;
    }

    public void setSaved(boolean saved) {
        isSaved = saved;
    }
}
