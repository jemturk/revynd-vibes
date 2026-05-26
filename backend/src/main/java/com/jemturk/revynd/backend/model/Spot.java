package com.jemturk.revynd.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "spots")
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String vibe;
    private String category;
    private Double intensity;

    @Column(columnDefinition = "geometry(Point, 4326)")
    @JsonIgnore // Tells Jackson: "Don't try to serialize this complex object"
    private Point location;

    // This is what the React Native frontend will actually see
    @JsonProperty("location")
    public double[] getJsonLocation() {
        if (location == null) return null;
        return new double[] { location.getY(), location.getX() }; // [Lat, Lng]
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
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

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Double getIntensity() {
        return intensity;
    }

    public void setIntensity(Double intensity) {
        this.intensity = intensity;
    }

    public Point getLocation() {
        return location;
    }

    public void setLocation(Point location) {
        this.location = location;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Spot)) return false;
        Spot spot = (Spot) o;
        return id != null && id.equals(spot.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }
}