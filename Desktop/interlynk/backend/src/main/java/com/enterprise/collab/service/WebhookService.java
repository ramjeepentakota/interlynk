package com.enterprise.collab.service;

import com.enterprise.collab.entity.Webhook;
import com.enterprise.collab.entity.WebhookDelivery;
import com.enterprise.collab.repository.WebhookDeliveryRepository;
import com.enterprise.collab.repository.WebhookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Outbound webhook fan-out. {@link #emit(String, Object)} enqueues a delivery
 * row for every active webhook that subscribes to the event; the polling
 * dispatcher walks PENDING rows and POSTs them with exponential back-off.
 *
 * Why a queue rather than direct POST: outbound HTTP calls must NEVER block a
 * user-visible request — they're slow, unreliable, and out of our control.
 * Buffering through a table also gives us at-least-once delivery semantics
 * across restarts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebhookService {

    private final WebhookRepository webhookRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final ObjectMapper objectMapper;

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /**
     * Enqueue a webhook event. Subscribers whose {@code events} CSV contains
     * {@code eventType} get a PENDING delivery row. Returns immediately; the
     * actual POST happens on the dispatcher tick.
     */
    @Async
    @Transactional
    public void emit(String eventType, Object payload) {
        try {
            List<Webhook> subscribers = webhookRepository.findByActiveTrue();
            if (subscribers.isEmpty()) return;
            String body = objectMapper.writeValueAsString(Map.of(
                    "event", eventType,
                    "ts", LocalDateTime.now().toString(),
                    "data", payload
            ));
            for (Webhook w : subscribers) {
                if (!subscribes(w, eventType)) continue;
                WebhookDelivery d = WebhookDelivery.builder()
                        .webhook(w)
                        .eventType(eventType)
                        .payload(body)
                        .status(WebhookDelivery.Status.PENDING)
                        .build();
                deliveryRepository.save(d);
            }
        } catch (Exception e) {
            log.warn("webhook emit failed event={}: {}", eventType, e.getMessage());
        }
    }

    private boolean subscribes(Webhook w, String event) {
        String events = w.getEvents();
        if (events == null) return false;
        for (String e : events.split(",")) {
            String norm = e.trim();
            if (norm.equals(event) || norm.equals("*")) return true;
            // "message.*" matches "message.created", "message.updated", ...
            if (norm.endsWith(".*") && event.startsWith(norm.substring(0, norm.length() - 1))) return true;
        }
        return false;
    }

    /** Poll & dispatch every 10s. Each delivery is its own transaction. */
    @Scheduled(fixedDelay = 10_000, initialDelay = 20_000)
    public void dispatchTick() {
        List<WebhookDelivery> due;
        try {
            due = deliveryRepository.findDue(LocalDateTime.now());
        } catch (Exception e) {
            log.warn("webhook poll failed: {}", e.getMessage());
            return;
        }
        for (WebhookDelivery d : due) {
            try {
                dispatchOne(d.getId());
            } catch (Exception e) {
                log.warn("webhook dispatch crashed id={}: {}", d.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public void dispatchOne(Long deliveryId) {
        WebhookDelivery d = deliveryRepository.findById(deliveryId).orElse(null);
        if (d == null || d.getStatus() != WebhookDelivery.Status.PENDING) return;

        d.setAttempts(d.getAttempts() + 1);
        try {
            HttpRequest.Builder req = HttpRequest.newBuilder()
                    .uri(URI.create(d.getWebhook().getUrl()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("X-Interlynk-Event", d.getEventType())
                    .header("X-Interlynk-Delivery", String.valueOf(d.getId()));

            String secret = d.getWebhook().getSecret();
            if (secret != null && !secret.isEmpty()) {
                req.header("X-Interlynk-Signature", "sha256=" + hmac(secret, d.getPayload()));
            }

            HttpResponse<String> resp = HTTP.send(
                    req.POST(HttpRequest.BodyPublishers.ofString(d.getPayload(), StandardCharsets.UTF_8)).build(),
                    HttpResponse.BodyHandlers.ofString());

            d.setLastResponseCode(resp.statusCode());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                d.setStatus(WebhookDelivery.Status.SUCCESS);
                d.setLastError(null);
            } else {
                failOrRetry(d, "HTTP " + resp.statusCode());
            }
        } catch (Exception e) {
            failOrRetry(d, e.getClass().getSimpleName() + ": " + Objects.toString(e.getMessage(), ""));
        }
        deliveryRepository.save(d);
    }

    private void failOrRetry(WebhookDelivery d, String reason) {
        if (reason.length() > 500) reason = reason.substring(0, 500);
        d.setLastError(reason);
        if (d.getAttempts() >= d.getMaxAttempts()) {
            d.setStatus(WebhookDelivery.Status.GIVEN_UP);
        } else {
            // Exponential back-off: 30s, 2m, 8m, 32m, 2h.
            long delaySec = (long) (30 * Math.pow(4, Math.max(0, d.getAttempts() - 1)));
            d.setNextAttemptAt(LocalDateTime.now().plusSeconds(delaySec));
        }
    }

    private static String hmac(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return toHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return "";
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
