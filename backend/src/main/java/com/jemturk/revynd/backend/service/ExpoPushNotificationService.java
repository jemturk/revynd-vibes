package com.jemturk.revynd.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

@Service
public class ExpoPushNotificationService {
    private static final Logger logger = LoggerFactory.getLogger(ExpoPushNotificationService.class);
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void sendPushNotification(String pushToken, String title, String body, Map<String, Object> data) {
        if (pushToken == null || (!pushToken.startsWith("ExponentPushToken") && !pushToken.startsWith("ExpoPushToken"))) {
            logger.warn("Invalid push token format: {}", pushToken);
            return;
        }

        try {
            Map<String, Object> payload = Map.of(
                "to", pushToken,
                "title", title,
                "body", body,
                "sound", "default",
                "data", data != null ? data : Map.of()
            );

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://exp.host/--/api/v2/push/send"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() == 200) {
                        logger.info("Push notification sent successfully to token: {}", pushToken);
                    } else {
                        logger.error("Failed to send push notification. Status: {}, Response: {}", 
                            response.statusCode(), response.body());
                    }
                })
                .exceptionally(ex -> {
                    logger.error("Error occurred while sending push notification: ", ex);
                    return null;
                });

        } catch (Exception e) {
            logger.error("Error writing push notification payload: ", e);
        }
    }
}
