package com.jemturk.revynd.backend.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.jemturk.revynd.backend.dto.CheckInRecord;
import com.jemturk.revynd.backend.model.CheckIn;

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

       CheckIn findFirstBySpotIdAndUserIdOrderByCheckInTimeDesc(Long spotId, Long userId);

       List<CheckIn> findAllByOrderByCheckInTimeDesc();

       @Query("SELECT new com.jemturk.revynd.backend.dto.CheckInRecord(c.id, c.spot.name, c.vibeTag, c.checkInTime, c.intensityAtTime) "
                     +
                     "FROM CheckIn c " +
                     "WHERE c.user.id = :userId AND c.archived = false " +
                     "ORDER BY c.checkInTime DESC")
       List<CheckInRecord> findHistoryByUserId(@Param("userId") Long userId);

       @Query("SELECT new com.jemturk.revynd.backend.dto.CheckInRecord(c.id, c.spot.name, c.vibeTag, c.checkInTime, c.intensityAtTime) "
                     +
                     "FROM CheckIn c " +
                     "WHERE c.user.id = :userId AND c.archived = true " +
                     "ORDER BY c.checkInTime DESC")
       List<CheckInRecord> findArchivedHistoryByUserId(@Param("userId") Long userId);

       /**
        * Find all check-ins after a specific time.
        * Used by IntensityDecayService to identify spots that need intensity decay.
        */
       List<CheckIn> findByCheckInTimeAfter(LocalDateTime time);

       @Modifying
       @Query("DELETE FROM CheckIn c WHERE c.user.id = :userId")
       void deleteByUserId(@Param("userId") Long userId);
}