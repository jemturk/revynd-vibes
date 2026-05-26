package com.jemturk.revynd.backend.dto;

import java.time.LocalDateTime;

public record CheckInRecord(
    Long id,
    String spotName,
    String vibeTag,
    LocalDateTime checkInTime,
    Double intensityAtTime
) {}