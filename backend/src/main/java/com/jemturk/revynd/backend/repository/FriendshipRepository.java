package com.jemturk.revynd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.jemturk.revynd.backend.model.Friendship;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    Optional<Friendship> findByRequesterIdAndReceiverId(Long requesterId, Long receiverId);

    List<Friendship> findByReceiverIdAndStatus(Long receiverId, String status);

    List<Friendship> findByRequesterIdAndStatus(Long requesterId, String status);

    @Query("SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' AND (f.requester.id = :userId OR f.receiver.id = :userId)")
    List<Friendship> findAcceptedFriendships(@Param("userId") Long userId);

    @Query("SELECT f FROM Friendship f WHERE (f.requester.id = :user1Id AND f.receiver.id = :user2Id) OR (f.requester.id = :user2Id AND f.receiver.id = :user1Id)")
    Optional<Friendship> findAnyRelationship(@Param("user1Id") Long user1Id, @Param("user2Id") Long user2Id);
}
