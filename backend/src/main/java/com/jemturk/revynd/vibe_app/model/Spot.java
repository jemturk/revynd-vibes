package com.jemturk.revynd.vibe_app.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "spots")
@Data
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String vibe;
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
}