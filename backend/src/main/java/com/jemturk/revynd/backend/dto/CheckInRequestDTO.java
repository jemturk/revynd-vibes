package com.jemturk.revynd.backend.dto;

public class CheckInRequestDTO {
    private String id;
    private String name;
    private String vibe;
    private double[] location;

    public CheckInRequestDTO() {
    }

    public CheckInRequestDTO(String id, String name, String vibe, double[] location) {
        this.id = id;
        this.name = name;
        this.vibe = vibe;
        this.location = location;
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

    public double[] getLocation() {
        return location;
    }

    public void setLocation(double[] location) {
        this.location = location;
    }
}
