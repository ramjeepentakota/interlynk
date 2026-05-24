package com.enterprise.collab.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * RFC 6238 TOTP (Time-based One-Time Password).
 *
 * Implements HMAC-SHA1, 30-second time step, 6-digit codes — the universal
 * defaults that Authy, Google Authenticator, Microsoft Authenticator, 1Password,
 * Duo, FreeOTP and Bitwarden all consume. Verification accepts the current
 * step plus the adjacent steps on either side to tolerate ~30 seconds of clock
 * drift between server and the user's phone.
 *
 * Secrets are stored and shared as RFC 4648 base32 (the encoding every
 * authenticator app reads from a {@code otpauth://totp/...} URL).
 */
public final class Totp {

    private static final int CODE_DIGITS = 6;
    private static final int TIME_STEP_SECONDS = 30;
    private static final int CLOCK_SKEW_STEPS = 1;
    private static final String HMAC_ALGO = "HmacSHA1";
    private static final char[] BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {}

    /** Generate a {@code length}-character (20 = 100-bit) random base32 secret. */
    public static String generateBase32Secret(int length) {
        if (length < 16) length = 16;
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(BASE32[RANDOM.nextInt(BASE32.length)]);
        return sb.toString();
    }

    /**
     * Build the {@code otpauth://totp/...} URL that authenticator apps consume
     * (typically rendered as a QR code).
     *
     * @param issuer     human-readable product name (e.g. {@code "Narada"})
     * @param accountName usually the user's username or email
     * @param base32Secret the shared secret
     */
    public static String otpAuthUrl(String issuer, String accountName, String base32Secret) {
        String safeIssuer = URLEncoder.encode(issuer, StandardCharsets.UTF_8);
        String safeAccount = URLEncoder.encode(accountName, StandardCharsets.UTF_8);
        // Standard label format is "issuer:account" so Authy + Google Authenticator
        // group entries cleanly even if the issuer query param is dropped.
        return "otpauth://totp/" + safeIssuer + ":" + safeAccount
                + "?secret=" + base32Secret
                + "&issuer=" + safeIssuer
                + "&algorithm=SHA1&digits=" + CODE_DIGITS
                + "&period=" + TIME_STEP_SECONDS;
    }

    /**
     * Verify a 6-digit code against {@code base32Secret} using the current Unix
     * time. Accepts the current step plus the steps immediately before/after
     * (so a ±30s clock drift still authenticates).
     */
    public static boolean verify(String base32Secret, String code) {
        if (base32Secret == null || code == null) return false;
        String normalized = code.trim().replaceAll("\\s+", "");
        if (normalized.length() != CODE_DIGITS) return false;
        int submitted;
        try { submitted = Integer.parseInt(normalized); }
        catch (NumberFormatException e) { return false; }

        byte[] key;
        try { key = base32Decode(base32Secret); }
        catch (IllegalArgumentException e) { return false; }

        long step = System.currentTimeMillis() / 1000L / TIME_STEP_SECONDS;
        for (int delta = -CLOCK_SKEW_STEPS; delta <= CLOCK_SKEW_STEPS; delta++) {
            int candidate = generateAtStep(key, step + delta);
            if (constantTimeEquals(candidate, submitted)) return true;
        }
        return false;
    }

    private static int generateAtStep(byte[] key, long step) {
        byte[] data = ByteBuffer.allocate(8).putLong(step).array();
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(new SecretKeySpec(key, HMAC_ALGO));
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int mod = 1;
            for (int i = 0; i < CODE_DIGITS; i++) mod *= 10;
            return binary % mod;
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA1 not available", e);
        }
    }

    private static boolean constantTimeEquals(int a, int b) {
        // Always inspect every digit so we don't leak which position differed.
        int diff = a ^ b;
        return diff == 0;
    }

    /** RFC 4648 base32 decode (uppercase, no padding required). */
    private static byte[] base32Decode(String input) {
        String s = input.trim().toUpperCase().replace("=", "").replaceAll("\\s+", "");
        if (s.isEmpty()) throw new IllegalArgumentException("empty secret");
        int outLen = s.length() * 5 / 8;
        byte[] out = new byte[outLen];
        int buf = 0, bits = 0, outIdx = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int v = indexOf(c);
            if (v < 0) throw new IllegalArgumentException("invalid base32 char: " + c);
            buf = (buf << 5) | v;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                out[outIdx++] = (byte) ((buf >> bits) & 0xFF);
            }
        }
        return out;
    }

    private static int indexOf(char c) {
        for (int i = 0; i < BASE32.length; i++) if (BASE32[i] == c) return i;
        return -1;
    }
}
