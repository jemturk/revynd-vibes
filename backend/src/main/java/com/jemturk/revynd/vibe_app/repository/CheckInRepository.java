package com.jemturk.revynd.vibe_app.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.jemturk.revynd.vibe_app.model.CheckIn;

import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CheckInRepository extends JpaRepository<CheckIn, Long> {

    /**
     * Optimized query to get all active check-in counts in a single database hit.
     * * Returns a List of Object arrays where:
     * row[0] = Long (spot_id)
     * row[1] = Long (count of check-ins)
     */
    @Query("SELECT c.spot.id, COUNT(c) FROM CheckIn c " +
           "WHERE c.checkInTime > :oneHourAgo " +
           "GROUP BY c.spot.id")
    List<Object[]> findRecentCheckInCounts(@Param("oneHourAgo") LocalDateTime oneHourAgo);

    /**
     * Utility method if you ever need to find check-ins for a specific spot 
     * without the GROUP BY optimization.
     */
    List<CheckIn> findBySpotIdAndCheckInTimeAfter(Long spotId, LocalDateTime time);

    CheckIn findFirstBySpotIdOrderByCheckInTimeDesc(Long spotId);
    
    List<CheckIn> findAllByOrderByCheckInTimeDesc();

    /**
     * Find all check-ins after a specific time.
     * Used by IntensityDecayService to identify spots that need intensity decay.
     */
    List<CheckIn> findByCheckInTimeAfter(LocalDateTime time);
}