package com.jemturk.revynd.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class MapboxFeature {
    private MapboxProperties properties;
    private MapboxGeometry geometry;

    public MapboxProperties getProperties() {
        return properties;
    }

    public void setProperties(MapboxProperties properties) {
        this.properties = properties;
    }

    public MapboxGeometry getGeometry() {
        return geometry;
    }

    public void setGeometry(MapboxGeometry geometry) {
        this.geometry = geometry;
    }
}
