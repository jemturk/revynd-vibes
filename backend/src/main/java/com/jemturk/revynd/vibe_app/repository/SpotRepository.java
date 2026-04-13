package com.jemturk.revynd.vibe_app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.jemturk.revynd.vibe_app.model.Spot;

import java.util.List;

public interface SpotRepository extends JpaRepository<Spot, Long> {

    // Find spots within 'distance' meters of a point
    @Query(value = """
            SELECT * FROM spots
            WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :distance)
            """, nativeQuery = true)
    List<Spot> findNearby(@Param("lat") double lat, @Param("lng") double lng, @Param("distance") double distance);
}