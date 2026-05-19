package com.enterprise.collab.service;

import com.enterprise.collab.entity.*;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final LicenseKeyRepository licenseKeyRepository;
    private final AuditLogRepository auditLogRepository;
    private final CallRoomRepository callRoomRepository;
    private final CodeRepositoryRepository codeRepositoryRepository;
    private final PasswordEncoder passwordEncoder;
    
    @Value("${app.storage.base-path}")
    private String storageBasePath;
    
    // ============ User Management ============
    
    @Transactional
    public User createUser(String username, String email, String password, String displayName, List<String> roles) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new RuntimeException("Username already exists");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already exists");
        }
        
        User user = User.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .displayName(displayName)
                .status(User.UserStatus.ACTIVE)
                .presence(User.Presence.OFFLINE)
                .build();
        
        user = userRepository.save(user);
        
        // Assign roles
        User finalUser = user;
        for (String roleName : roles) {
            roleRepository.findByName(roleName).ifPresent(role -> {
                finalUser.getRoles().add(role);
            });
        }
        
        user = userRepository.save(finalUser);
        
        // Create storage directory for user
        try {
            Files.createDirectories(Paths.get(storageBasePath, "user-workspaces", user.getId().toString()));
        } catch (IOException e) {
            log.error("Failed to create user storage directory", e);
        }
        
        logAuditLog(null, "CREATE_USER", "User", user.getId(), 
                "Created user: " + username, null, null);
        
        return user;
    }
    
    @Transactional
    public User updateUser(Long userId, String displayName, String avatarUrl, User.UserStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (displayName != null) user.setDisplayName(displayName);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        if (status != null) user.setStatus(status);
        
        return userRepository.save(user);
    }
    
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
    
    public Page<User> getUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }
    
    // ============ Team Management ============
    
    @Transactional
    public Team createTeam(String name, String description, Long createdById) {
        User createdBy = userRepository.findById(createdById)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Team team = Team.builder()
                .name(name)
                .description(description)
                .createdBy(createdBy)
                .build();
        
        team = teamRepository.save(team);
        
        // Add creator as team lead
        TeamMember member = TeamMember.builder()
                .team(team)
                .user(createdBy)
                .roleInTeam(TeamMember.TeamRole.LEAD)
                .build();
        teamMemberRepository.save(member);
        
        logAuditLog(createdById, "CREATE_TEAM", "Team", team.getId(), 
                "Created team: " + name, null, null);
        
        return team;
    }
    
    @Transactional
    public TeamMember addUserToTeam(Long teamId, Long userId, TeamMember.TeamRole role) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Team not found"));
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (teamMemberRepository.findByTeamIdAndUserId(teamId, userId).isPresent()) {
            throw new RuntimeException("User is already a member of this team");
        }
        
        TeamMember member = TeamMember.builder()
                .team(team)
                .user(user)
                .roleInTeam(role)
                .build();
        
        return teamMemberRepository.save(member);
    }
    
    public List<Team> getAllTeams() {
        return teamRepository.findAll();
    }
    
    // ============ License Management ============
    
    @Transactional
    public LicenseKey generateLicenseKey(Integer maxUsers, String issuedTo, LocalDateTime expiresAt) {
        String licenseKey = "ENT-" + UUID.randomUUID().toString().toUpperCase().replace("-", "").substring(0, 16);
        
        LicenseKey license = LicenseKey.builder()
                .licenseKey(licenseKey)
                .maxUsers(maxUsers)
                .issuedTo(issuedTo)
                .expiresAt(expiresAt)
                .isActive(true)
                .build();
        
        return licenseKeyRepository.save(license);
    }
    
    public List<LicenseKey> getAllLicenseKeys() {
        return licenseKeyRepository.findAll();
    }
    
    // ============ System Monitoring ============
    
    public long getActiveUserCount() {
        return userRepository.count() - userRepository.findByStatus(User.UserStatus.INACTIVE).size();
    }
    
    public long getActiveCallCount() {
        return callRoomRepository.findByIsActiveTrue().size();
    }
    
    public long getRepositoryCount() {
        return codeRepositoryRepository.count();
    }
    
    public long getTotalStorageUsed() {
        try {
            Path storagePath = Paths.get(storageBasePath);
            if (Files.exists(storagePath)) {
                return Files.walk(storagePath)
                        .filter(Files::isRegularFile)
                        .mapToLong(this::getFileSize)
                        .sum();
            }
        } catch (IOException e) {
            log.error("Failed to calculate storage usage", e);
        }
        return 0;
    }
    
    private long getFileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException e) {
            return 0;
        }
    }
    
    // ============ Audit Logs ============
    
    public Page<AuditLog> getAuditLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }
    
    public List<AuditLog> getUserAuditLogs(Long userId) {
        return auditLogRepository.findByUserId(userId);
    }
    
    @Transactional
    public void logAuditLog(Long userId, String action, String entityType, Long entityId, 
            String details, String ipAddress, String userAgent) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
        
        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();
        
        auditLogRepository.save(auditLog);
    }
}
