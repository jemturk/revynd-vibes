package com.jemturk.revynd.vibe_app.dto;

import java.time.LocalDateTime;

public record CheckInRecord(
    String spotName,
    String vibe,
    LocalDateTime checkInTime,
    double intensityAtTime
) {}