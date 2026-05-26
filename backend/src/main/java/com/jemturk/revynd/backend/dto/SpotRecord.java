package com.jemturk.revynd.backend.dto;

import org.locationtech.jts.geom.Point;

public record SpotRecord(Long id, String name, String vibe, String category, Double[] location, double intensity) {

    public SpotRecord(Long id, String name, String vibe, String category, Point location, double intensity) {
        this(id, name, vibe, category, new Double[] { location.getX(), location.getY() }, intensity);
    }
}