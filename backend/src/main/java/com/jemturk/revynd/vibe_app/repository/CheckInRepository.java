package com.jemturk.revynd.vibe_app.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jemturk.revynd.vibe_app.model.CheckIn;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
}