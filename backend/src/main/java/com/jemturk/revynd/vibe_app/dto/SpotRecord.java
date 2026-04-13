package com.jemturk.revynd.vibe_app.dto;

import org.locationtech.jts.geom.Point;

public record SpotRecord(Long id, String name, String vibe, Double[] location, double intensity) {

    public SpotRecord(Long id, String name, String vibe, Point location, double intensity) {
        this(id, name, vibe, new Double[] { location.getX(), location.getY() }, intensity);
    }
}