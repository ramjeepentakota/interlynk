package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.entity.AuditLog;
import com.enterprise.collab.entity.Role;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.AuditLogRepository;
import com.enterprise.collab.repository.RoleRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * MFA enrollment + role/permission management (RBAC).
 * The permission catalog is curated: services should check permission
 * keys via {@link Role#getPermissions()} (comma-separated) at the point
 * of action authorization.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSecurityService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AuditLogRepository auditLogRepository;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final Set<String> SYSTEM_ROLES = Set.of("ADMIN", "MANAGER", "EMPLOYEE", "MODERATOR");

    /** Curated catalog of permission keys exposed to custom admin roles. */
    private static final List<PermissionCatalogEntry> CATALOG = List.of(
            new PermissionCatalogEntry("users.read",      "Users",      "View user directory and profiles"),
            new PermissionCatalogEntry("users.write",     "Users",      "Create, edit, suspend, block, delete users"),
            new PermissionCatalogEntry("users.password",  "Users",      "Reset passwords and force re-enrollment"),
            new PermissionCatalogEntry("users.mfa",       "Users",      "Require / disable MFA for users"),
            new PermissionCatalogEntry("teams.read",      "Teams",      "View teams and members"),
            new PermissionCatalogEntry("teams.write",     "Teams",      "Create, edit, archive, delete teams; manage members"),
            new PermissionCatalogEntry("channels.read",   "Channels",   "View channels and configuration"),
            new PermissionCatalogEntry("channels.write",  "Channels",   "Create, edit, archive, delete channels"),
            new PermissionCatalogEntry("policies.messaging", "Policies","Manage messaging policies"),
            new PermissionCatalogEntry("policies.meetings",  "Policies","Manage meeting / webinar policies"),
            new PermissionCatalogEntry("calling.read",    "Calling",    "View phone numbers, queues, attendants"),
            new PermissionCatalogEntry("calling.write",   "Calling",    "Manage phone numbers, queues, attendants"),
            new PermissionCatalogEntry("security.policies","Security",  "Manage conditional access, DLP, labels, barriers"),
            new PermissionCatalogEntry("security.audit",  "Security",   "Read full audit log"),
            new PermissionCatalogEntry("security.ediscovery","Security","Search messages across the org (eDiscovery)"),
            new PermissionCatalogEntry("rbac.roles",      "Security",   "Create / edit custom admin roles"),
            new PermissionCatalogEntry("reports.read",    "Reports",    "View usage, adoption, and quality reports")
    );

    /* ── MFA ─────────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public MfaStatusResponse mfaStatus(Long userId) {
        User u = requireUser(userId);
        return MfaStatusResponse.builder()
                .userId(u.getId()).username(u.getUsername())
                .enabled(u.isMfaEnabled()).required(u.isMfaRequired())
                .enrolledAt(u.getMfaEnrolledAt())
                .build();
    }

    @Transactional
    public MfaStatusResponse setMfa(Long userId, MfaSetRequest req, String actor) {
        User u = requireUser(userId);
        if (req.getRequired() != null) u.setMfaRequired(req.getRequired());
        if (req.getEnabled() != null) {
            if (!req.getEnabled()) {
                u.setMfaEnabled(false);
                u.setMfaSecret(null);
                u.setMfaEnrolledAt(null);
            } else {
                if (u.getMfaSecret() == null) {
                    throw new BadRequestException("Cannot enable MFA without enrollment. Call /enroll first.");
                }
                u.setMfaEnabled(true);
                if (u.getMfaEnrolledAt() == null) u.setMfaEnrolledAt(LocalDateTime.now());
            }
        }
        userRepository.save(u);
        audit(actor, "SET_MFA", userId, "Set MFA: enabled=" + u.isMfaEnabled() + " required=" + u.isMfaRequired());
        return mfaStatus(userId);
    }

    @Transactional
    public MfaEnrollResponse enrollMfa(Long userId, String actor) {
        User u = requireUser(userId);
        String secret = generateBase32Secret(32);
        u.setMfaSecret(secret);
        u.setMfaEnabled(true);
        u.setMfaEnrolledAt(LocalDateTime.now());
        userRepository.save(u);
        List<String> backup = new ArrayList<>();
        for (int i = 0; i < 8; i++) backup.add(generateBackupCode());
        String label = URLEncoder.encode("InterLynk:" + u.getUsername(), StandardCharsets.UTF_8);
        String otpauth = "otpauth://totp/" + label + "?secret=" + secret + "&issuer=InterLynk";
        audit(actor, "ENROLL_MFA", userId, "Enrolled MFA for " + u.getUsername());
        return MfaEnrollResponse.builder()
                .secret(secret).otpauthUrl(otpauth).backupCodes(backup).build();
    }

    /* ── RBAC ────────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public List<PermissionCatalogEntry> permissionCatalog() {
        return CATALOG;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getName))
                .map(this::toRoleResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest req, String actor) {
        String name = req.getName().trim().toUpperCase();
        if (roleRepository.findByName(name).isPresent()) {
            throw new ConflictException("Role '" + name + "' already exists");
        }
        validatePermissions(req.getPermissions());
        Role r = Role.builder()
                .name(name)
                .description(req.getDescription())
                .permissions(joinPermissions(req.getPermissions()))
                .build();
        Role saved = roleRepository.save(r);
        audit(actor, "CREATE_ROLE", saved.getId(), "Created role " + name);
        return toRoleResponse(saved);
    }

    @Transactional
    public RoleResponse updateRole(Long roleId, UpdateRoleRequest req, String actor) {
        Role r = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        if (SYSTEM_ROLES.contains(r.getName()) && req.getPermissions() != null
                && r.getName().equals("ADMIN")
                && !req.getPermissions().contains("rbac.roles")) {
            // keep ADMIN safe — never remove rbac.roles silently from itself
            req.getPermissions().add("rbac.roles");
        }
        if (req.getDescription() != null) r.setDescription(req.getDescription());
        if (req.getPermissions() != null) {
            validatePermissions(req.getPermissions());
            r.setPermissions(joinPermissions(req.getPermissions()));
        }
        Role saved = roleRepository.save(r);
        audit(actor, "UPDATE_ROLE", saved.getId(), "Updated role " + r.getName());
        return toRoleResponse(saved);
    }

    @Transactional
    public void deleteRole(Long roleId, String actor) {
        Role r = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        if (SYSTEM_ROLES.contains(r.getName())) {
            throw new BadRequestException("Cannot delete system role " + r.getName());
        }
        roleRepository.delete(r);
        audit(actor, "DELETE_ROLE", roleId, "Deleted role " + r.getName());
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private void validatePermissions(List<String> perms) {
        if (perms == null) return;
        Set<String> valid = CATALOG.stream().map(PermissionCatalogEntry::getKey).collect(Collectors.toSet());
        for (String p : perms) {
            if (p != null && !p.isBlank() && !valid.contains(p)) {
                throw new BadRequestException("Unknown permission: " + p);
            }
        }
    }

    private String joinPermissions(List<String> perms) {
        if (perms == null || perms.isEmpty()) return "";
        return perms.stream().filter(s -> s != null && !s.isBlank())
                .distinct().collect(Collectors.joining(","));
    }

    private List<String> splitPermissions(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private RoleResponse toRoleResponse(Role r) {
        return RoleResponse.builder()
                .id(r.getId()).name(r.getName()).description(r.getDescription())
                .permissions(splitPermissions(r.getPermissions()))
                .createdAt(r.getCreatedAt()).updatedAt(r.getUpdatedAt())
                .systemRole(SYSTEM_ROLES.contains(r.getName()))
                .build();
    }

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    private String generateBase32Secret(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(BASE32.charAt(RANDOM.nextInt(BASE32.length())));
        return sb.toString();
    }

    private String generateBackupCode() {
        StringBuilder sb = new StringBuilder(11);
        for (int i = 0; i < 11; i++) {
            if (i == 5) { sb.append('-'); continue; }
            sb.append("0123456789".charAt(RANDOM.nextInt(10)));
        }
        return sb.toString();
    }

    private void audit(String actor, String action, Long entityId, String details) {
        try {
            User u = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
            auditLogRepository.save(AuditLog.builder()
                    .user(u).action(action).entityType("Security").entityId(entityId).details(details).build());
        } catch (Exception e) { log.warn("audit failed", e); }
    }
}
