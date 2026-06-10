package com.jemturk.revynd.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.jemturk.revynd.backend.model.User;
import com.jemturk.revynd.backend.model.Friendship;
import com.jemturk.revynd.backend.repository.UserRepository;
import com.jemturk.revynd.backend.repository.FriendshipRepository;
import java.security.Principal;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

import com.jemturk.revynd.backend.service.ExpoPushNotificationService;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FriendshipController {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final ExpoPushNotificationService expoPushNotificationService;

    @PostMapping("/request/{targetUserId}")
    @Transactional
    public ResponseEntity<?> sendFriendRequest(@PathVariable Long targetUserId, Principal principal) {
        String email = principal.getName();
        User requester = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (requester.getId().equals(targetUserId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "You cannot send a friend request to yourself."));
        }

        User receiver = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        Optional<Friendship> existing = friendshipRepository.findAnyRelationship(requester.getId(), targetUserId);
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Friend request already exists or you are already friends."));
        }

        Friendship friendship = new Friendship();
        friendship.setRequester(requester);
        friendship.setReceiver(receiver);
        friendship.setStatus("PENDING");
        friendshipRepository.save(friendship);

        // Send push notification if target user has social alerts enabled and a push token is registered
        if (receiver.getPushToken() != null && receiver.isNotifSocial()) {
            String title = "New Friend Request! 👥";
            String body = requester.getName() + " sent you a friend request on REVYND.";
            Map<String, Object> notifData = Map.of(
                "type", "friend_request",
                "requesterId", String.valueOf(requester.getId())
            );
            expoPushNotificationService.sendPushNotification(receiver.getPushToken(), title, body, notifData);
        }

        return ResponseEntity.ok(Map.of("message", "Friend request sent successfully"));
    }

    @PostMapping("/accept/{requestId}")
    @Transactional
    public ResponseEntity<?> acceptFriendRequest(@PathVariable Long requestId, Principal principal) {
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Friendship friendship = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!friendship.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "You cannot accept this request."));
        }

        friendship.setStatus("ACCEPTED");
        friendshipRepository.save(friendship);

        // Send push notification to original requester if they have social alerts enabled and a push token registered
        User requester = friendship.getRequester();
        if (requester.getPushToken() != null && requester.isNotifSocial()) {
            String title = "Friend Request Accepted! 🎉";
            String body = currentUser.getName() + " accepted your friend request on REVYND.";
            Map<String, Object> notifData = Map.of(
                "type", "friend_accepted",
                "friendId", String.valueOf(currentUser.getId())
            );
            expoPushNotificationService.sendPushNotification(requester.getPushToken(), title, body, notifData);
        }

        return ResponseEntity.ok(Map.of("message", "Friend request accepted successfully"));
    }

    @GetMapping
    public ResponseEntity<?> getFriends(Principal principal) {
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Friendship> friendships = friendshipRepository.findAcceptedFriendships(currentUser.getId());
        List<Map<String, Object>> friends = new ArrayList<>();

        for (Friendship f : friendships) {
            User friend = f.getRequester().getId().equals(currentUser.getId()) ? f.getReceiver() : f.getRequester();
            friends.add(Map.of(
                "id", friend.getId(),
                "name", friend.getName(),
                "email", friend.getEmail(),
                "profilePicture", friend.getProfilePicture() != null ? friend.getProfilePicture() : ""
            ));
        }

        return ResponseEntity.ok(friends);
    }

    @GetMapping("/pending")
    public ResponseEntity<?> getPendingRequests(Principal principal) {
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Friendship> incoming = friendshipRepository.findByReceiverIdAndStatus(currentUser.getId(), "PENDING");
        List<Map<String, Object>> requests = new ArrayList<>();

        for (Friendship f : incoming) {
            User requester = f.getRequester();
            requests.add(Map.of(
                "requestId", f.getId(),
                "userId", requester.getId(),
                "name", requester.getName(),
                "email", requester.getEmail(),
                "profilePicture", requester.getProfilePicture() != null ? requester.getProfilePicture() : ""
            ));
        }

        return ResponseEntity.ok(requests);
    }

    @PostMapping("/sync")
    public ResponseEntity<?> syncContacts(@RequestBody List<String> contactHashes, Principal principal) {
        if (contactHashes == null || contactHashes.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<User> allUsers = userRepository.findAll();
        List<Map<String, Object>> matches = new ArrayList<>();

        Set<String> hashSet = new HashSet<>(contactHashes);

        for (User u : allUsers) {
            if (u.getId().equals(currentUser.getId())) {
                continue;
            }

            boolean isMatch = false;

            // Check email hash
            if (u.getEmail() != null) {
                String emailHash = sha256(u.getEmail().trim().toLowerCase());
                if (hashSet.contains(emailHash)) {
                    isMatch = true;
                }
            }

            // Check phone hash
            if (!isMatch && u.getPhoneNumber() != null) {
                String cleanPhone = u.getPhoneNumber().replaceAll("\\D", "");
                String phoneHash = sha256(cleanPhone);
                if (hashSet.contains(phoneHash)) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                Optional<Friendship> rel = friendshipRepository.findAnyRelationship(currentUser.getId(), u.getId());
                String relationshipStatus = "NONE";
                Long friendshipId = null;

                if (rel.isPresent()) {
                    relationshipStatus = rel.get().getStatus();
                    friendshipId = rel.get().getId();
                }

                Map<String, Object> match = new HashMap<>();
                match.put("id", u.getId());
                match.put("name", u.getName());
                match.put("profilePicture", u.getProfilePicture() != null ? u.getProfilePicture() : "");
                match.put("relationship", relationshipStatus);
                match.put("friendshipId", friendshipId != null ? String.valueOf(friendshipId) : "");
                matches.add(match);
            }
        }

        return ResponseEntity.ok(matches);
    }

    private String sha256(String input) {
        if (input == null) return null;
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
