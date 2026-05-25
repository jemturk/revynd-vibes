package com.jemturk.revynd.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class MapboxProperties {
    private String name;
    
    @JsonProperty("mapbox_id")
    private String mapboxId;
    
    @JsonProperty("poi_category")
    private List<String> poiCategory;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMapboxId() {
        return mapboxId;
    }

    public void setMapboxId(String mapboxId) {
        this.mapboxId = mapboxId;
    }

    public List<String> getPoiCategory() {
        return poiCategory;
    }

    public void setPoiCategory(List<String> poiCategory) {
        this.poiCategory = poiCategory;
    }

    public String getCategoryString() {
        if (poiCategory != null && !poiCategory.isEmpty()) {
            // Map the API categories cleanly to short vibe names
            String category = poiCategory.get(0);
            if (category.contains("skate") || category.contains("park")) {
                return "Skate Spot";
            } else if (category.contains("coffee") || category.contains("cafe")) {
                return "Cafe";
            } else if (category.contains("bar") || category.contains("nightlife") || category.contains("club") || category.contains("pub")) {
                return "Bar";
            }
            return category;
        }
        return "Spot";
    }
}
