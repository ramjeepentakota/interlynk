package com.enterprise.collab.service;

import com.enterprise.collab.dto.AuthDto;
import com.enterprise.collab.entity.RefreshToken;
import com.enterprise.collab.entity.Role;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.exception.UnauthorizedException;
import com.enterprise.collab.repository.RoleRepository;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenService refreshTokenService;
    
    @Value("${app.security.jwt.expiration}")
    private long jwtExpiration;
    
    @Transactional
    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ConflictException("Username already exists");
        }
        
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already exists");
        }
        
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName() != null ? request.getDisplayName() : request.getUsername())
                .status(User.UserStatus.ACTIVE)
                .presence(User.Presence.OFFLINE)
                .build();
        
        // Assign default EMPLOYEE role
        Role employeeRole = roleRepository.findByName("EMPLOYEE")
                .orElseThrow(() -> new BadRequestException("Role not found: EMPLOYEE"));
        
        Set<Role> roles = new HashSet<>();
        roles.add(employeeRole);
        user.setRoles(roles);
        
        user = userRepository.save(user);
        
        // Generate tokens
        String accessToken = tokenProvider.generateToken(user.getUsername(), user.getId());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername());
        
        return buildAuthResponse(user, accessToken, refreshToken.getToken());
    }
    
    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        log.debug("Login attempt for user: {}", request.getUsername());
        
        User userRecord = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername()).orElse(null));
        
        if (userRecord == null) {
            log.warn("User not found in database: {}", request.getUsername());
        } else {
            log.debug("User found: {}. Password hash in DB: {}", userRecord.getUsername(), userRecord.getPasswordHash());
            boolean matches = passwordEncoder.matches(request.getPassword(), userRecord.getPasswordHash());
            log.debug("Password matches encoder: {}", matches);
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", authentication.getName()));
        
        // Check if user is active
        if (user.getStatus() != User.UserStatus.ACTIVE) {
            throw new UnauthorizedException("Account is not active. Please contact administrator.");
        }
        
        // Update presence to online
        user.setPresence(User.Presence.ONLINE);
        user.setLastSeenAt(LocalDateTime.now());
        userRepository.save(user);
        
        // Get expiration based on rememberMe flag
        boolean rememberMe = request.isRememberMe();
        long tokenExpiration = tokenProvider.getExpirationForRememberMe(rememberMe);
        
        // Generate tokens with appropriate expiration
        String accessToken = tokenProvider.generateTokenWithExpiration(user.getUsername(), user.getId(), tokenExpiration);
        
        // If rememberMe is true, create a longer-lived refresh token
        RefreshToken refreshToken;
        if (rememberMe) {
            refreshToken = refreshTokenService.createRememberMeRefreshToken(user.getUsername());
        } else {
            refreshToken = refreshTokenService.createRefreshToken(user.getUsername());
        }
        
        log.info("User logged in: {} (rememberMe: {})", user.getUsername(), rememberMe);
        
        return buildAuthResponse(user, accessToken, refreshToken.getToken(), tokenExpiration);
    }
    
    public AuthDto.TokenRefreshResponse refreshToken(AuthDto.RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenService.verifyRefreshToken(request.getRefreshToken());
        
        User user = refreshToken.getUser();
        
        // Check if user is active
        if (user.getStatus() != User.UserStatus.ACTIVE) {
            throw new UnauthorizedException("Account is not active");
        }
        
        // Generate new access token
        String newAccessToken = tokenProvider.generateToken(user.getUsername(), user.getId());
        
        // Create new refresh token (rotation)
        RefreshToken newRefreshToken = refreshTokenService.createRefreshToken(user.getUsername());
        
        return AuthDto.TokenRefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken.getToken())
                .tokenType("Bearer")
                .expiresIn(jwtExpiration)
                .build();
    }
    
    @Transactional
    public void logout(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        user.setPresence(User.Presence.OFFLINE);
        user.setLastSeenAt(LocalDateTime.now());
        userRepository.save(user);
        
        // Revoke all refresh tokens
        refreshTokenService.revokeAllUserTokens(username);
        
        log.info("User logged out: {}", username);
    }
    
    public AuthDto.UserProfileDto getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        return mapToUserProfileDto(user);
    }
    
    @Transactional
    public AuthDto.UserProfileDto updateProfile(String username, AuthDto.UpdateProfileRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        if (request.getDisplayName() != null) {
            user.setDisplayName(request.getDisplayName());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        
        user = userRepository.save(user);
        
        log.info("User profile updated: {}", username);
        
        return mapToUserProfileDto(user);
    }
    
    @Transactional
    public void changePassword(String username, AuthDto.ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        
        // Check if new password is same as old password
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from current password");
        }
        
        // Update password
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        
        // Revoke all refresh tokens (force re-login)
        refreshTokenService.revokeAllUserTokens(username);
        
        log.info("User password changed: {}", username);
    }
    
    public List<AuthDto.UserDto> searchUsers(String query) {
        List<User> users = userRepository.searchUsersByUsernameOrDisplayName(query);
        
        return users.stream()
                .map(this::mapToUserDto)
                .collect(Collectors.toList());
    }
    
    private AuthDto.AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return buildAuthResponse(user, accessToken, refreshToken, jwtExpiration);
    }
    
    private AuthDto.AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken, long expiration) {
        return AuthDto.AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiration)
                .user(mapToUserDto(user))
                .build();
    }
    
    private AuthDto.UserDto mapToUserDto(User user) {
        return AuthDto.UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus().name())
                .presence(user.getPresence().name())
                .roles(user.getRoles().stream().map(Role::getName).collect(Collectors.toList()))
                .createdAt(user.getCreatedAt())
                .lastSeenAt(user.getLastSeenAt())
                .build();
    }
    
    private AuthDto.UserProfileDto mapToUserProfileDto(User user) {
        return AuthDto.UserProfileDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus().name())
                .presence(user.getPresence().name())
                .roles(user.getRoles().stream().map(Role::getName).collect(Collectors.toList()))
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .lastSeenAt(user.getLastSeenAt())
                .build();
    }
}
