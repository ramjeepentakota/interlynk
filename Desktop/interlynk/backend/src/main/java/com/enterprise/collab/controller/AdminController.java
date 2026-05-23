package com.enterprise.collab.controller;

import com.enterprise.collab.entity.*;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final ChannelRepository channelRepository;
    private final TeamRepository teamRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final PasswordEncoder passwordEncoder;
    
    // User management
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (User user : users) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("email", user.getEmail());
            userMap.put("displayName", user.getDisplayName());
            userMap.put("status", user.getStatus().name());
            userMap.put("presence", user.getPresence().name());
            userMap.put("roles", user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()));
            userMap.put("createdAt", user.getCreatedAt());
            result.add(userMap);
        }
        
        return ResponseEntity.ok(result);
    }
    
    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, String> payload) {
        if (userRepository.existsByUsername(payload.get("username"))) {
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", "Username already exists");
            return ResponseEntity.badRequest().body(errorMap);
        }
        
        if (userRepository.existsByEmail(payload.get("email"))) {
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", "Email already exists");
            return ResponseEntity.badRequest().body(errorMap);
        }
        
        User user = User.builder()
                .username(payload.get("username"))
                .email(payload.get("email"))
                .passwordHash(passwordEncoder.encode(payload.get("password")))
                .displayName(payload.getOrDefault("displayName", payload.get("username")))
                .status(User.UserStatus.ACTIVE)
                .presence(User.Presence.OFFLINE)
                .build();
        
        // Assign default role
        Role employeeRole = roleRepository.findByName("EMPLOYEE")
                .orElseThrow(() -> new RuntimeException("Role not found"));
        user.getRoles().add(employeeRole);
        
        user = userRepository.save(user);
        
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
        userMap.put("username", user.getUsername());
        userMap.put("email", user.getEmail());
        
        return ResponseEntity.ok(userMap);
    }
    
    @PutMapping("/users/{userId}/roles")
    public ResponseEntity<Map<String, Object>> updateUserRoles(
            @PathVariable Long userId,
            @RequestBody Map<String, List<String>> payload) {
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Set<Role> newRoles = new HashSet<>();
        for (String roleName : payload.get("roles")) {
            roleRepository.findByName(roleName).ifPresent(newRoles::add);
        }
        
        user.setRoles(newRoles);
        userRepository.save(user);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "Roles updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    @PutMapping("/users/{userId}/status")
    public ResponseEntity<Map<String, String>> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody Map<String, String> payload) {
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setStatus(User.UserStatus.valueOf(payload.get("status")));
        userRepository.save(user);
        
        Map<String, String> msgMap = new HashMap<>();
        msgMap.put("message", "Status updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        userRepository.deleteById(userId);
        return ResponseEntity.ok().build();
    }
    
    // License key management
    @PostMapping("/license-keys")
    public ResponseEntity<Map<String, Object>> generateLicenseKey(@RequestBody Map<String, Object> payload) {
        String licenseKey = UUID.randomUUID().toString().toUpperCase();
        
        Map<String, Object> licenseMap = new HashMap<>();
        licenseMap.put("licenseKey", licenseKey);
        licenseMap.put("maxUsers", payload.getOrDefault("maxUsers", 100));
        licenseMap.put("issuedTo", payload.getOrDefault("issuedTo", ""));
        
        return ResponseEntity.ok(licenseMap);
    }
    
    // System statistics
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getSystemStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.findOnlineUsers().size();
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("activeUsers", activeUsers);
        stats.put("timestamp", new Date());
        
        return ResponseEntity.ok(stats);
    }
    
    // ============ Channel Access Management (UAM) ============
    
    @GetMapping("/channels")
    public ResponseEntity<List<Map<String, Object>>> getAllChannels() {
        List<Channel> channels = channelRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (Channel channel : channels) {
            Map<String, Object> channelMap = new HashMap<>();
            channelMap.put("id", channel.getId());
            channelMap.put("name", channel.getName());
            channelMap.put("description", channel.getDescription());
            channelMap.put("type", channel.getType().name());
            channelMap.put("category", channel.getCategory());
            channelMap.put("isActive", channel.getIsActive());
            channelMap.put("isLocked", channel.getIsLocked());
            channelMap.put("maxParticipants", channel.getMaxParticipants());
            channelMap.put("createdAt", channel.getCreatedAt());
            
            // Get member count
            channelMap.put("memberCount", channel.getMembers() != null ? channel.getMembers().size() : 0);
            
            // Get member list
            if (channel.getMembers() != null) {
                List<Map<String, Object>> members = new ArrayList<>();
                for (User member : channel.getMembers()) {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", member.getId());
                    memberMap.put("username", member.getUsername());
                    memberMap.put("displayName", member.getDisplayName());
                    members.add(memberMap);
                }
                channelMap.put("members", members);
            }
            
            result.add(channelMap);
        }
        
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/channels/{channelId}")
    public ResponseEntity<Map<String, Object>> getChannel(@PathVariable Long channelId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new RuntimeException("Channel not found"));
        
        Map<String, Object> channelMap = new HashMap<>();
        channelMap.put("id", channel.getId());
        channelMap.put("name", channel.getName());
        channelMap.put("description", channel.getDescription());
        channelMap.put("type", channel.getType().name());
        channelMap.put("category", channel.getCategory());
        channelMap.put("isActive", channel.getIsActive());
        channelMap.put("isLocked", channel.getIsLocked());
        channelMap.put("maxParticipants", channel.getMaxParticipants());
        channelMap.put("createdAt", channel.getCreatedAt());
        channelMap.put("memberCount", channel.getMembers() != null ? channel.getMembers().size() : 0);
        
        if (channel.getMembers() != null) {
            List<Map<String, Object>> members = new ArrayList<>();
            for (User member : channel.getMembers()) {
                Map<String, Object> memberMap = new HashMap<>();
                memberMap.put("id", member.getId());
                memberMap.put("username", member.getUsername());
                memberMap.put("displayName", member.getDisplayName());
                memberMap.put("email", member.getEmail());
                members.add(memberMap);
            }
            channelMap.put("members", members);
        }
        
        return ResponseEntity.ok(channelMap);
    }
    
    @PostMapping("/channels/{channelId}/members/{userId}")
    public ResponseEntity<Map<String, Object>> addChannelMember(
            @PathVariable Long channelId,
            @PathVariable Long userId) {
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new RuntimeException("Channel not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        channel.getMembers().add(user);
        channelRepository.save(channel);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "User added to channel successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    @DeleteMapping("/channels/{channelId}/members/{userId}")
    public ResponseEntity<Map<String, Object>> removeChannelMember(
            @PathVariable Long channelId,
            @PathVariable Long userId) {
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new RuntimeException("Channel not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        channel.getMembers().remove(user);
        channelRepository.save(channel);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "User removed from channel successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    @PutMapping("/channels/{channelId}")
    public ResponseEntity<Map<String, Object>> updateChannel(
            @PathVariable Long channelId,
            @RequestBody Map<String, Object> payload) {
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new RuntimeException("Channel not found"));
        
        if (payload.get("name") != null) {
            channel.setName((String) payload.get("name"));
        }
        if (payload.get("description") != null) {
            channel.setDescription((String) payload.get("description"));
        }
        if (payload.get("category") != null) {
            channel.setCategory((String) payload.get("category"));
        }
        if (payload.get("isActive") != null) {
            channel.setIsActive((Boolean) payload.get("isActive"));
        }
        if (payload.get("isLocked") != null) {
            channel.setIsLocked((Boolean) payload.get("isLocked"));
        }
        if (payload.get("maxParticipants") != null) {
            channel.setMaxParticipants((Integer) payload.get("maxParticipants"));
        }
        
        channelRepository.save(channel);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "Channel updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    // ============ System Settings Management ============
    
    @GetMapping("/settings")
    public ResponseEntity<List<Map<String, Object>>> getSystemSettings() {
        List<SystemSetting> settings = systemSettingRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (SystemSetting setting : settings) {
            Map<String, Object> settingMap = new HashMap<>();
            settingMap.put("id", setting.getKeyName());
            settingMap.put("key", setting.getKey());
            settingMap.put("value", setting.getValue());
            settingMap.put("description", setting.getDescription());
            settingMap.put("updatedAt", setting.getUpdatedAt());
            result.add(settingMap);
        }
        
        return ResponseEntity.ok(result);
    }
    
    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSystemSettings(
            @RequestBody List<Map<String, String>> settings) {
        
        for (Map<String, String> settingData : settings) {
            String keyName = settingData.get("key");
            String value = settingData.get("value");
            
            SystemSetting setting = systemSettingRepository.findByKeyName(keyName)
                    .orElse(SystemSetting.builder()
                            .keyName(keyName)
                            .key(keyName)
                            .value(value)
                            .build());
            
            setting.setValue(value);
            systemSettingRepository.save(setting);
        }
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "Settings updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    @GetMapping("/settings/{key}")
    public ResponseEntity<Map<String, Object>> getSetting(@PathVariable String key) {
        SystemSetting setting = systemSettingRepository.findByKeyName(key)
                .orElseThrow(() -> new RuntimeException("Setting not found"));
        
        Map<String, Object> settingMap = new HashMap<>();
        settingMap.put("key", setting.getKey());
        settingMap.put("value", setting.getValue());
        settingMap.put("description", setting.getDescription());
        
        return ResponseEntity.ok(settingMap);
    }
    
    @PutMapping("/settings/{key}")
    public ResponseEntity<Map<String, Object>> updateSetting(
            @PathVariable String key,
            @RequestBody Map<String, String> payload) {
        
        SystemSetting setting = systemSettingRepository.findByKeyName(key)
                .orElse(SystemSetting.builder()
                        .keyName(key)
                        .key(key)
                        .build());
        
        setting.setValue(payload.get("value"));
        if (payload.get("description") != null) {
            setting.setDescription(payload.get("description"));
        }
        
        systemSettingRepository.save(setting);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "Setting updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    // ============ User Access Management ============
    
    @GetMapping("/users/{userId}/access")
    public ResponseEntity<Map<String, Object>> getUserAccess(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Map<String, Object> accessMap = new HashMap<>();
        
        // User basic info
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("displayName", user.getDisplayName());
        userInfo.put("email", user.getEmail());
        userInfo.put("status", user.getStatus().name());
        userInfo.put("roles", user.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList()));
        accessMap.put("user", userInfo);
        
        // Channel access
        List<Map<String, Object>> channelAccess = new ArrayList<>();
        List<Channel> allChannels = channelRepository.findAll();
        for (Channel channel : allChannels) {
            if (channel.getMembers() != null && channel.getMembers().contains(user)) {
                Map<String, Object> channelMap = new HashMap<>();
                channelMap.put("id", channel.getId());
                channelMap.put("name", channel.getName());
                channelMap.put("type", channel.getType().name());
                channelAccess.add(channelMap);
            }
        }
        accessMap.put("channels", channelAccess);
        
        // Voice channel access
        List<Map<String, Object>> voiceAccess = new ArrayList<>();
        for (Channel channel : allChannels) {
            if (channel.getType() == Channel.ChannelType.VOICE && 
                channel.getMembers() != null && 
                channel.getMembers().contains(user)) {
                Map<String, Object> channelMap = new HashMap<>();
                channelMap.put("id", channel.getId());
                channelMap.put("name", channel.getName());
                channelMap.put("maxParticipants", channel.getMaxParticipants());
                channelMap.put("isLocked", channel.getIsLocked());
                voiceAccess.add(channelMap);
            }
        }
        accessMap.put("voiceChannels", voiceAccess);
        
        return ResponseEntity.ok(accessMap);
    }
    
    @PutMapping("/users/{userId}/access")
    public ResponseEntity<Map<String, Object>> updateUserAccess(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> payload) {
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Update roles
        if (payload.get("roles") != null) {
            List<String> roleNames = (List<String>) payload.get("roles");
            Set<Role> newRoles = new HashSet<>();
            for (String roleName : roleNames) {
                roleRepository.findByName(roleName).ifPresent(newRoles::add);
            }
            user.setRoles(newRoles);
        }
        
        // Update channel access - add user to channels
        if (payload.get("channelIds") != null) {
            List<Long> channelIds = (List<Long>) payload.get("channelIds");
            List<Channel> channels = channelRepository.findAllById(channelIds);
            for (Channel channel : channels) {
                if (!channel.getMembers().contains(user)) {
                    channel.getMembers().add(user);
                    channelRepository.save(channel);
                }
            }
        }
        
        userRepository.save(user);
        
        Map<String, Object> msgMap = new HashMap<>();
        msgMap.put("message", "User access updated successfully");
        return ResponseEntity.ok(msgMap);
    }
    
    // ============ Roles Management ============
    
    @GetMapping("/roles")
    public ResponseEntity<List<Map<String, Object>>> getAllRoles() {
        List<Role> roles = roleRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (Role role : roles) {
            Map<String, Object> roleMap = new HashMap<>();
            roleMap.put("id", role.getId());
            roleMap.put("name", role.getName());
            roleMap.put("description", role.getDescription());
            roleMap.put("permissions", role.getPermissions());
            result.add(roleMap);
        }
        
        return ResponseEntity.ok(result);
    }
    
    @PostMapping("/roles")
    public ResponseEntity<Map<String, Object>> createRole(@RequestBody Map<String, String> payload) {
        if (roleRepository.findByName(payload.get("name")).isPresent()) {
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", "Role already exists");
            return ResponseEntity.badRequest().body(errorMap);
        }
        
        Role role = Role.builder()
                .name(payload.get("name"))
                .description(payload.get("description"))
                .permissions(payload.get("permissions"))
                .build();
        
        role = roleRepository.save(role);
        
        Map<String, Object> roleMap = new HashMap<>();
        roleMap.put("id", role.getId());
        roleMap.put("name", role.getName());
        roleMap.put("message", "Role created successfully");
        
        return ResponseEntity.ok(roleMap);
    }
    
    @DeleteMapping("/roles/{roleId}")
    public ResponseEntity<Map<String, String>> deleteRole(@PathVariable Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found"));
        
        roleRepository.delete(role);
        
        Map<String, String> msgMap = new HashMap<>();
        msgMap.put("message", "Role deleted successfully");
        return ResponseEntity.ok(msgMap);
    }
}
