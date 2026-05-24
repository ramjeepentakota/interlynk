package com.enterprise.collab.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class AuthDto {
    
    // ============ Request Classes ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        @NotBlank(message = "Username is required")
        private String username;
        
        @NotBlank(message = "Password is required")
        private String password;
        
        private boolean rememberMe;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisterRequest {
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "Username can only contain letters, numbers, underscores and hyphens")
        private String username;
        
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;
        
        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$", 
                message = "Password must contain at least one uppercase letter, one lowercase letter, one digit and one special character")
        private String password;
        
        @Size(max = 100, message = "Display name must not exceed 100 characters")
        private String displayName;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RefreshTokenRequest {
        @NotBlank(message = "Refresh token is required")
        private String refreshToken;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PasswordResetRequest {
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PasswordResetConfirmRequest {
        @NotBlank(message = "Token is required")
        private String token;
        
        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$", 
                message = "Password must contain at least one uppercase letter, one lowercase letter, one digit and one special character")
        private String newPassword;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChangePasswordRequest {
        @NotBlank(message = "Current password is required")
        private String currentPassword;
        
        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$", 
                message = "Password must contain at least one uppercase letter, one lowercase letter, one digit and one special character")
        private String newPassword;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateProfileRequest {
        @Size(max = 100, message = "Display name must not exceed 100 characters")
        private String displayName;
        
        @Size(max = 500, message = "Avatar URL must not exceed 500 characters")
        private String avatarUrl;
    }
    
    // ============ Response Classes ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuthResponse {
        private String accessToken;
        private String refreshToken;
        private String tokenType;
        private Long expiresIn;
        private UserDto user;

        /**
         * When {@code true}, the password was correct but MFA is enabled on
         * this account: {@link #accessToken} / {@link #refreshToken} are
         * absent and the client must POST {@link #mfaChallenge} together with
         * a 6-digit TOTP code (or backup code) to {@code /api/v1/auth/login/mfa}
         * to receive real tokens.
         */
        private Boolean mfaRequired;
        private String mfaChallenge;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MfaLoginRequest {
        @NotBlank(message = "MFA challenge is required")
        private String mfaChallenge;

        @NotBlank(message = "Code is required")
        @Size(min = 6, max = 16, message = "Enter the 6-digit code from your authenticator app or a backup code")
        private String code;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDto {
        private Long id;
        private String username;
        private String email;
        private String displayName;
        private String avatarUrl;
        private String status;
        private String presence;
        private List<String> roles;
        private LocalDateTime createdAt;
        private LocalDateTime lastSeenAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserProfileDto {
        private Long id;
        private String username;
        private String email;
        private String displayName;
        private String avatarUrl;
        private String status;
        private String presence;
        private List<String> roles;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime lastSeenAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private String message;
        private boolean success;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TokenRefreshResponse {
        private String accessToken;
        private String refreshToken;
        private String tokenType;
        private Long expiresIn;
    }
}
