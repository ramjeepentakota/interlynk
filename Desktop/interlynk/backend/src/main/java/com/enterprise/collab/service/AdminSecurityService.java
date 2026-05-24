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
import com.enterprise.collab.security.Totp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final PasswordEncoder passwordEncoder;

    @Value("${app.security.mfa.issuer:Narada}")
    private String mfaIssuer;

    private static final SecureRandom RANDOM = new SecureRandom();
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
        return toStatus(u);
    }

    /**
     * Toggle the {@code required} flag, or revoke an enrollment by passing
     * {@code enabled=false}. The admin can never activate MFA from here — the
     * user must complete the {@link #enrollMfa} → {@link #confirmMfa} flow so
     * we know they actually scanned the QR into an authenticator app.
     */
    @Transactional
    public MfaStatusResponse setMfa(Long userId, MfaSetRequest req, String actor) {
        User u = requireUser(userId);
        if (req.getRequired() != null) u.setMfaRequired(req.getRequired());
        if (req.getEnabled() != null) {
            if (!req.getEnabled()) {
                clearEnrollment(u);
            } else {
                throw new BadRequestException(
                        "MFA can only be activated by completing the enroll → confirm flow, " +
                        "not by toggling 'enabled' directly.");
            }
        }
        userRepository.save(u);
        audit(actor, "SET_MFA", userId,
                "MFA: enabled=" + u.isMfaEnabled() + " required=" + u.isMfaRequired());
        return toStatus(u);
    }

    /**
     * Stage 1 of enrollment. Generates a fresh TOTP secret and one-time backup
     * codes. The user must scan the {@code otpauthUrl} (or the QR rendered from
     * it) into Authy / Google Authenticator / Microsoft Authenticator / 1Password
     * and then call {@link #confirmMfa} with their first 6-digit code before
     * MFA becomes active.
     */
    @Transactional
    public MfaEnrollResponse enrollMfa(Long userId, String actor) {
        User u = requireUser(userId);
        String secret = Totp.generateBase32Secret(32);
        u.setMfaSecret(secret);
        u.setMfaEnabled(false);
        u.setMfaEnrolledAt(null);

        // Generate plain backup codes (shown to admin ONCE) and persist bcrypt
        // hashes so we can validate them at login without exposing them again.
        List<String> plainCodes = new ArrayList<>();
        List<String> hashed = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            String code = generateBackupCode();
            plainCodes.add(code);
            hashed.add(passwordEncoder.encode(code));
        }
        u.setMfaBackupCodes(String.join(",", hashed));
        userRepository.save(u);

        String otpauth = Totp.otpAuthUrl(mfaIssuer, u.getUsername(), secret);
        audit(actor, "ENROLL_MFA", userId,
                "Started MFA enrollment for " + u.getUsername() + " — awaiting code confirmation");
        return MfaEnrollResponse.builder()
                .secret(secret).otpauthUrl(otpauth).backupCodes(plainCodes).build();
    }

    /**
     * Stage 2 of enrollment. Verify the first TOTP code from the authenticator
     * app before we trust the secret and mark MFA active. Required to prevent
     * a user being "MFA-enabled" with a secret they never actually scanned.
     */
    @Transactional
    public MfaStatusResponse confirmMfa(Long userId, String code, String actor) {
        User u = requireUser(userId);
        if (u.getMfaSecret() == null) {
            throw new BadRequestException("No pending enrollment — call /enroll first.");
        }
        if (!Totp.verify(u.getMfaSecret(), code)) {
            throw new BadRequestException("Invalid verification code. Make sure your device clock is correct.");
        }
        u.setMfaEnabled(true);
        u.setMfaEnrolledAt(LocalDateTime.now());
        userRepository.save(u);
        audit(actor, "CONFIRM_MFA", userId, "MFA confirmed and activated for " + u.getUsername());
        return toStatus(u);
    }

    /**
     * Internal helper used by the login flow. Accepts either a 6-digit TOTP
     * code (verified against {@link User#getMfaSecret()}) or one of the
     * user's bcrypt-hashed backup codes. A consumed backup code is removed.
     */
    @Transactional
    public boolean verifyMfaForLogin(User user, String code) {
        if (user == null || user.getMfaSecret() == null || code == null) return false;
        String trimmed = code.trim().replaceAll("\\s+", "");
        if (trimmed.isEmpty()) return false;

        if (Totp.verify(user.getMfaSecret(), trimmed)) return true;

        // Try backup codes — match against each remaining bcrypt hash and
        // remove the consumed entry so it can't be reused.
        String stored = user.getMfaBackupCodes();
        if (stored == null || stored.isBlank()) return false;
        List<String> hashes = new ArrayList<>(Arrays.asList(stored.split(",")));
        for (int i = 0; i < hashes.size(); i++) {
            String h = hashes.get(i);
            if (h.isBlank()) continue;
            if (passwordEncoder.matches(trimmed, h)) {
                hashes.remove(i);
                user.setMfaBackupCodes(String.join(",", hashes));
                userRepository.save(user);
                audit(user.getUsername(), "MFA_BACKUP_USED", user.getId(),
                        "Consumed a one-time backup code at login");
                return true;
            }
        }
        return false;
    }

    private void clearEnrollment(User u) {
        u.setMfaEnabled(false);
        u.setMfaSecret(null);
        u.setMfaEnrolledAt(null);
        u.setMfaBackupCodes(null);
    }

    private MfaStatusResponse toStatus(User u) {
        int remaining = 0;
        if (u.getMfaBackupCodes() != null && !u.getMfaBackupCodes().isBlank()) {
            for (String h : u.getMfaBackupCodes().split(",")) if (!h.isBlank()) remaining++;
        }
        return MfaStatusResponse.builder()
                .userId(u.getId()).username(u.getUsername())
                .enabled(u.isMfaEnabled()).required(u.isMfaRequired())
                .pendingConfirmation(u.getMfaSecret() != null && !u.isMfaEnabled())
                .backupCodesRemaining(remaining)
                .enrolledAt(u.getMfaEnrolledAt())
                .build();
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
