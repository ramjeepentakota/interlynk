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
 * Mints join tokens for the self-hosted mediasoup SFU. Spring is the authority
 * on who may enter which call room; the SFU trusts only a valid token.
 *
 * <p>Tokens are HS256 JWTs whose signature is built by hand (header.payload.sig)
 * so we can use any-length shared secret and stay byte-compatible with the
 * Node SFU's {@code jsonwebtoken} verification — no extra Java dependency and no
 * minimum-key-length enforcement. This mirrors {@link LiveKitService}.</p>
 *
 * <p>Configure via {@code application.yml} / environment:
 * <pre>
 *   sfu.url=https://your-host:4443      (SFU_URL — Socket.IO origin the browser connects to)
 *   sfu.jwt-secret=...                  (SFU_JWT_SECRET — MUST equal the SFU service's secret)
 * </pre>
 * When either is blank, {@link #isConfigured()} is false and group calling is
 * reported unavailable to the client.</p>
 */
@Service
@Slf4j
public class SfuService {

    private final String url;
    private final String jwtSecret;
    private final long tokenTtlSeconds;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SfuService(
            @Value("${sfu.url:}") String url,
            @Value("${sfu.jwt-secret:}") String jwtSecret,
            @Value("${sfu.token-ttl-seconds:21600}") long tokenTtlSeconds) {
        this.url = trim(url);
        this.jwtSecret = trim(jwtSecret);
        this.tokenTtlSeconds = tokenTtlSeconds > 0 ? tokenTtlSeconds : 21600L;
        if (!isConfigured()) {
            log.warn("SFU is not configured — group calling is disabled. "
                    + "Set sfu.url and sfu.jwt-secret (matching the SFU service) to enable it.");
        }
    }

    public boolean isConfigured() {
        return notBlank(url) && notBlank(jwtSecret);
    }

    public String getUrl() {
        return url;
    }

    /**
     * Build a join token for {@code identity} in {@code room}.
     *
     * @param canPublish whether this participant may publish mic/camera/screen
     * @return signed JWT, or {@code null} if the SFU is not configured
     */
    public String createToken(String room, String identity, String displayName, boolean canPublish) {
        if (!isConfigured()) {
            return null;
        }
        long now = System.currentTimeMillis() / 1000L;

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("sub", identity);
        claims.put("room", room);
        if (notBlank(displayName)) {
            claims.put("name", displayName);
        }
        claims.put("canPublish", canPublish);
        claims.put("iat", now);
        claims.put("nbf", now);
        claims.put("exp", now + tokenTtlSeconds);

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
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));

            return signingInput + "." + base64Url(signature);
        } catch (Exception e) {
            log.error("Failed to mint SFU token", e);
            throw new IllegalStateException("Could not generate SFU token", e);
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
