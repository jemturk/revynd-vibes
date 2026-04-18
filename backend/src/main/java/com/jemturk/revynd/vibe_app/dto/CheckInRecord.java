package com.jemturk.revynd.vibe_app.dto;

import java.time.LocalDateTime;

public record CheckInRecord(
    Long id,
    String spotName,
    String vibe,
    LocalDateTime checkInTime,
    Double intensityAtTime
) {}