package com.jemturk.revynd.backend.dto;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class MapboxSearchResponse {
    private List<MapboxFeature> features;

    public List<MapboxFeature> getFeatures() {
        return features;
    }

    public void setFeatures(List<MapboxFeature> features) {
        this.features = features;
    }
}
