package com.enterprise.collab.service;

import com.enterprise.collab.entity.RefreshToken;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.UnauthorizedException;
import com.enterprise.collab.repository.RefreshTokenRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {
    
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    
    @Value("${app.security.jwt.refresh-expiration:604800000}") // 7 days in milliseconds
    private long refreshTokenExpiration;
    
    @Value("${app.security.jwt.remember-me-refresh-expiration:5184000000}") // 60 days in milliseconds
    private long rememberMeRefreshTokenExpiration;
    
    @Transactional
    public RefreshToken createRefreshToken(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("User not found"));
        
        // Revoke all existing tokens for this user
        refreshTokenRepository.revokeAllUserTokens(user);
        
        RefreshToken refreshToken = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .expiresAt(LocalDateTime.now().plusNanos(refreshTokenExpiration * 1_000_000L))
                .isRevoked(false)
                .build();
        
        return refreshTokenRepository.save(refreshToken);
    }
    
    @Transactional
    public RefreshToken createRememberMeRefreshToken(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("User not found"));
        
        // Revoke all existing tokens for this user
        refreshTokenRepository.revokeAllUserTokens(user);
        
        RefreshToken refreshToken = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .expiresAt(LocalDateTime.now().plusNanos(rememberMeRefreshTokenExpiration * 1_000_000L))
                .isRevoked(false)
                .build();
        
        return refreshTokenRepository.save(refreshToken);
    }
    
    public RefreshToken verifyRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        
        if (!refreshToken.isValid()) {
            throw new UnauthorizedException("Refresh token is expired or revoked");
        }
        
        return refreshToken;
    }
    
    @Transactional
    public void revokeToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new BadRequestException("Token not found"));
        
        refreshToken.setIsRevoked(true);
        refreshTokenRepository.save(refreshToken);
    }
    
    @Transactional
    public void revokeAllUserTokens(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("User not found"));
        
        refreshTokenRepository.revokeAllUserTokens(user);
    }
    
    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }
}
