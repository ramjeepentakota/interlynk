package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AuthDto;
import com.enterprise.collab.service.AuthService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Auth controller for non-v1 API paths (kept for backward compatibility)
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthCompatController {
    
    private final AuthService authService;
    
    @PostMapping("/register")
    public ResponseEntity<AuthDto.AuthResponse> register(@Valid @RequestBody AuthDto.RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }
    
    @PostMapping("/login")
    public ResponseEntity<AuthDto.AuthResponse> login(@Valid @RequestBody AuthDto.LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
    
    @PostMapping("/refresh")
    public ResponseEntity<AuthDto.TokenRefreshResponse> refreshToken(
            @Valid @RequestBody AuthDto.RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request));
    }
    
    @PostMapping("/logout")
    public ResponseEntity<AuthDto.MessageResponse> logout(Authentication authentication) {
        authService.logout(authentication.getName());
        return ResponseEntity.ok(AuthDto.MessageResponse.builder()
                .message("Logged out successfully")
                .success(true)
                .build());
    }
    
    @GetMapping("/me")
    public ResponseEntity<AuthDto.UserProfileDto> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(authService.getCurrentUser(authentication.getName()));
    }
    
    @PutMapping("/profile")
    public ResponseEntity<AuthDto.UserProfileDto> updateProfile(
            Authentication authentication,
            @Valid @RequestBody AuthDto.UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(authentication.getName(), request));
    }
    
    @PostMapping("/change-password")
    public ResponseEntity<AuthDto.MessageResponse> changePassword(
            Authentication authentication,
            @Valid @RequestBody AuthDto.ChangePasswordRequest request) {
        authService.changePassword(authentication.getName(), request);
        return ResponseEntity.ok(AuthDto.MessageResponse.builder()
                .message("Password changed successfully")
                .success(true)
                .build());
    }
    
    @GetMapping("/users/search")
    public ResponseEntity<List<AuthDto.UserDto>> searchUsers(@RequestParam String query) {
        return ResponseEntity.ok(authService.searchUsers(query));
    }
}
