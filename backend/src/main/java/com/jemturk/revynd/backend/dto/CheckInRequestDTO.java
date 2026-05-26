package com.jemturk.revynd.backend.dto;

public class CheckInRequestDTO {
    private String id;
    private String name;
    private String vibeTag;
    private String category;
    private double[] location;

    public CheckInRequestDTO() {
    }

    public CheckInRequestDTO(String id, String name, String vibeTag, String category, double[] location) {
        this.id = id;
        this.name = name;
        this.vibeTag = vibeTag;
        this.category = category;
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

    public String getVibeTag() {
        return vibeTag;
    }

    public void setVibeTag(String vibeTag) {
        this.vibeTag = vibeTag;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public double[] getLocation() {
        return location;
    }

    public void setLocation(double[] location) {
        this.location = location;
    }
}
