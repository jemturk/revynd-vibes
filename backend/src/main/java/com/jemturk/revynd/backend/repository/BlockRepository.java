package com.jemturk.revynd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.jemturk.revynd.backend.model.Block;
import java.util.Optional;
import java.util.List;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long> {
    Optional<Block> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);
    
    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    List<Block> findByBlockerId(Long blockerId);
}
