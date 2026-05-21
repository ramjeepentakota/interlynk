package com.enterprise.collab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mints LiveKit access tokens so the browser SDK can join an SFU media room.
 *
 * <p>LiveKit access tokens are standard HS256 JWTs signed with the project API
 * secret. We build the JWS by hand (header.payload.signature) to avoid any
 * minimum-key-length enforcement in the JWT library and keep zero extra
 * dependencies.</p>
 *
 * <p>Configure via {@code application.yml} / environment:
 * <pre>
 *   livekit.url=wss://your-project.livekit.cloud   (LIVEKIT_URL)
 *   livekit.api-key=APIxxxxxxxx                     (LIVEKIT_API_KEY)
 *   livekit.api-secret=xxxxxxxxxxxxxxxx             (LIVEKIT_API_SECRET)
 * </pre>
 * When any value is blank, {@link #isConfigured()} is false and the calling
 * controller tells the client that media is unavailable — calls still show the
 * participant roster, they just carry no audio/video.</p>
 */
@Service
@Slf4j
public class LiveKitService {

    private final String url;
    private final String apiKey;
    private final String apiSecret;
    private final long tokenTtlSeconds;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LiveKitService(
            @Value("${livekit.url:${LIVEKIT_URL:}}") String url,
            @Value("${livekit.api-key:${LIVEKIT_API_KEY:}}") String apiKey,
            @Value("${livekit.api-secret:${LIVEKIT_API_SECRET:}}") String apiSecret,
            @Value("${livekit.token-ttl-seconds:21600}") long tokenTtlSeconds) {
        this.url = trim(url);
        this.apiKey = trim(apiKey);
        this.apiSecret = trim(apiSecret);
        this.tokenTtlSeconds = tokenTtlSeconds > 0 ? tokenTtlSeconds : 21600L;
        if (!isConfigured()) {
            log.warn("LiveKit is not configured — calls will show participants but carry no live media. "
                    + "Set livekit.url, livekit.api-key and livekit.api-secret to enable audio/video.");
        }
    }

    public boolean isConfigured() {
        return notBlank(url) && notBlank(apiKey) && notBlank(apiSecret);
    }

    public String getUrl() {
        return url;
    }

    /**
     * Build a join token for {@code identity} in {@code room}.
     *
     * @param canPublish whether this participant may publish mic/camera/screen
     * @return signed JWT, or {@code null} if LiveKit is not configured
     */
    public String createToken(String room, String identity, String displayName, boolean canPublish) {
        if (!isConfigured()) {
            return null;
        }
        long now = System.currentTimeMillis() / 1000L;

        Map<String, Object> grant = new LinkedHashMap<>();
        grant.put("roomJoin", true);
        grant.put("room", room);
        grant.put("canPublish", canPublish);
        grant.put("canSubscribe", true);
        grant.put("canPublishData", true);

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", apiKey);
        claims.put("sub", identity);
        claims.put("nbf", now);
        claims.put("iat", now);
        claims.put("exp", now + tokenTtlSeconds);
        claims.put("jti", identity + "-" + now);
        if (notBlank(displayName)) {
            claims.put("name", displayName);
        }
        claims.put("video", grant);

        return signJws(claims);
    }

    // ── JWS (HS256) signing ──────────────────────────────────

    private String signJws(Map<String, Object> claims) {
        try {
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            String encodedHeader = base64Url(objectMapper.writeValueAsBytes(header));
            String encodedPayload = base64Url(objectMapper.writeValueAsBytes(claims));
            String signingInput = encodedHeader + "." + encodedPayload;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));

            return signingInput + "." + base64Url(signature);
        } catch (Exception e) {
            log.error("Failed to mint LiveKit token", e);
            throw new IllegalStateException("Could not generate media token", e);
        }
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
