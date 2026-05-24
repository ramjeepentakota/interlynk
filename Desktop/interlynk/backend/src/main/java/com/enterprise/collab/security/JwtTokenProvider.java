package com.enterprise.collab.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {
    
    @Value("${app.security.jwt.secret}")
    private String jwtSecret;
    
    @Value("${app.security.jwt.expiration}")
    private long jwtExpiration;
    
    @Value("${app.security.jwt.remember-me-expiration}")
    private long rememberMeExpiration;
    
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
    
    public String generateToken(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);
        
        return Jwts.builder()
                .setSubject(userDetails.getUsername())
                .claim("userId", ((com.enterprise.collab.entity.User) userDetails).getId())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }
    
    public String generateToken(String username, Long userId) {
        return generateTokenWithExpiration(username, userId, jwtExpiration);
    }
    
    public String generateTokenWithExpiration(String username, Long userId, long expiration) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);
        
        return Jwts.builder()
                .setSubject(username)
                .claim("userId", userId)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }
    
    public String getUsernameFromToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
        
        return claims.getSubject();
    }
    
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
    
    public long getExpirationTime() {
        return jwtExpiration;
    }
    
    public long getRememberMeExpiration() {
        return rememberMeExpiration;
    }
    
    public long getExpirationForRememberMe(boolean rememberMe) {
        return rememberMe ? rememberMeExpiration : jwtExpiration;
    }
    
    public Long getUserIdFromToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();

        return claims.get("userId", Long.class);
    }

    /**
     * Short-lived bearer-grade token issued AFTER password validation but
     * BEFORE the second-factor TOTP step. It carries {@code typ=mfa-challenge}
     * so {@link #validateMfaChallenge} can refuse access tokens being submitted
     * to the MFA endpoint and vice-versa. Five-minute TTL is enough for the
     * user to fish their phone out and read a code.
     */
    public String generateMfaChallenge(String username, Long userId, boolean rememberMe) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 5 * 60 * 1000L);
        return Jwts.builder()
                .setSubject(username)
                .claim("userId", userId)
                .claim("typ", "mfa-challenge")
                .claim("rememberMe", rememberMe)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Parse and validate a challenge token. Returns the claims if valid
     * (signed by our key, not expired, typed correctly); returns {@code null}
     * otherwise so the caller can fail closed.
     */
    public Claims validateMfaChallenge(String token) {
        try {
            Claims c = Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            if (!"mfa-challenge".equals(c.get("typ", String.class))) return null;
            return c;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
    
    public String getTokenFromRequest(javax.servlet.http.HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
