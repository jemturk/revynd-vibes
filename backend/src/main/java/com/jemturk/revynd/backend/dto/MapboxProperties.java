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
            String categories = String.join(" ", poiCategory).toLowerCase();
            if (categories.contains("skate") || categories.contains("skateboard")) {
                return "Skate Spot";
            } else if (categories.contains("coffee") || categories.contains("cafe")) {
                return "Cafe";
            } else if (categories.contains("bar") || categories.contains("nightlife") || categories.contains("club") || categories.contains("pub")) {
                return "Bar";
            } else if (categories.contains("restaurant") || categories.contains("food")) {
                return "Restaurant";
            } else if (categories.contains("tennis")) {
                return "Tennis";
            }
            String category = poiCategory.get(0);
            return category.substring(0, 1).toUpperCase() + category.substring(1);
        }
        return "Spot";
    }
}
