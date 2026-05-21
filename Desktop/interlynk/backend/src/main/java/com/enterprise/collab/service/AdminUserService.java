package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminMgmtDto.*;
import com.enterprise.collab.entity.*;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Production user-management operations for the admin console:
 * search, lifecycle (suspend/block), credentials, bulk import/export,
 * guest invitation, and per-user audit + login history.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final ChannelRepository channelRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserLoginHistoryRepository loginHistoryRepository;
    private final PasswordEncoder passwordEncoder;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PW_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

    /* ── Search / list ───────────────────────────────────── */

    @Transactional(readOnly = true)
    public PagedUsersResponse search(String q, String status, Boolean guest,
                                     String department, int page, int size,
                                     String sortBy, String sortDir) {
        String safeSort = normalizeSortField(sortBy);
        Sort sort = Sort.by("desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC, safeSort);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), sort);

        User.UserStatus statusEnum = parseStatus(status);
        String qNorm = (q == null || q.isBlank()) ? null : q.trim();
        String deptNorm = (department == null || department.isBlank()) ? null : department.trim();

        Page<User> result = userRepository.adminSearch(qNorm, statusEnum, guest, deptNorm, pageable);

        return PagedUsersResponse.builder()
                .content(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .first(result.isFirst())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getOne(Long userId) {
        return toResponse(requireUser(userId));
    }

    @Transactional(readOnly = true)
    public List<String> departments() {
        return userRepository.findDistinctDepartments();
    }

    /* ── Update / lifecycle ──────────────────────────────── */

    @Transactional
    public AdminUserResponse update(Long userId, UpdateUserRequest req, String actor) {
        User user = requireUser(userId);
        if (req.getDisplayName() != null) user.setDisplayName(req.getDisplayName());
        if (req.getAvatarUrl() != null)   user.setAvatarUrl(req.getAvatarUrl());
        if (req.getJobTitle() != null)    user.setJobTitle(req.getJobTitle());
        if (req.getDepartment() != null)  user.setDepartment(req.getDepartment());
        if (req.getPhoneNumber() != null) user.setPhoneNumber(req.getPhoneNumber());

        if (req.getStatus() != null) {
            User.UserStatus newStatus = parseStatus(req.getStatus());
            if (newStatus == null) throw new BadRequestException("Invalid status: " + req.getStatus());
            applyStatus(user, newStatus, null);
        }
        if (req.getRoles() != null) {
            user.setRoles(resolveRoles(req.getRoles()));
        }
        user = userRepository.save(user);
        audit(actor, "UPDATE_USER", userId, "Updated profile for " + user.getUsername());
        return toResponse(user);
    }

    @Transactional
    public AdminUserResponse suspend(Long userId, String reason, String actor) {
        User user = requireUser(userId);
        applyStatus(user, User.UserStatus.SUSPENDED, reason);
        userRepository.save(user);
        audit(actor, "SUSPEND_USER", userId, "Suspended " + user.getUsername() + ": " + reason);
        return toResponse(user);
    }

    @Transactional
    public AdminUserResponse unsuspend(Long userId, String actor) {
        User user = requireUser(userId);
        applyStatus(user, User.UserStatus.ACTIVE, null);
        userRepository.save(user);
        audit(actor, "UNSUSPEND_USER", userId, "Reactivated " + user.getUsername());
        return toResponse(user);
    }

    @Transactional
    public AdminUserResponse block(Long userId, boolean blocked, String actor) {
        User user = requireUser(userId);
        applyStatus(user, blocked ? User.UserStatus.BLOCKED : User.UserStatus.ACTIVE,
                blocked ? "Sign-in blocked by administrator" : null);
        userRepository.save(user);
        audit(actor, blocked ? "BLOCK_USER" : "UNBLOCK_USER", userId,
                (blocked ? "Blocked " : "Unblocked ") + user.getUsername());
        return toResponse(user);
    }

    @Transactional
    public ResetPasswordResponse resetPassword(Long userId, String newPassword, String actor) {
        User user = requireUser(userId);
        boolean generated = (newPassword == null || newPassword.isBlank());
        String effective = generated ? generatePassword() : newPassword;
        if (effective.length() < 8) throw new BadRequestException("Password must be at least 8 characters");

        user.setPasswordHash(passwordEncoder.encode(effective));
        userRepository.save(user);
        audit(actor, "RESET_PASSWORD", userId, "Reset password for " + user.getUsername());

        return ResetPasswordResponse.builder()
                .success(true)
                .temporaryPassword(generated ? effective : null)
                .message(generated
                        ? "A temporary password was generated. Share it securely; the user should change it on next sign-in."
                        : "Password updated successfully.")
                .build();
    }

    @Transactional
    public void delete(Long userId, String actor) {
        User user = requireUser(userId);
        String uname = user.getUsername();
        userRepository.delete(user);
        audit(actor, "DELETE_USER", userId, "Deleted user " + uname);
    }

    /* ── Guest invitation ────────────────────────────────── */

    @Transactional
    public ResetPasswordResponse inviteGuest(InviteGuestRequest req, String actor) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new ConflictException("A user with that email already exists");
        }
        String username = req.getEmail().split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "")
                + "-g" + (RANDOM.nextInt(9000) + 1000);
        String tempPassword = generatePassword();

        User guest = User.builder()
                .username(username)
                .email(req.getEmail())
                .displayName(req.getDisplayName() != null && !req.getDisplayName().isBlank()
                        ? req.getDisplayName() : req.getEmail())
                .passwordHash(passwordEncoder.encode(tempPassword))
                .status(User.UserStatus.ACTIVE)
                .presence(User.Presence.OFFLINE)
                .guest(true)
                .build();
        roleRepository.findByName("EMPLOYEE").ifPresent(r -> guest.getRoles().add(r));
        User saved = userRepository.save(guest);

        if (req.getChannelIds() != null) {
            for (Long cid : req.getChannelIds()) {
                channelRepository.findById(cid).ifPresent(ch -> {
                    ch.getMembers().add(saved);
                    channelRepository.save(ch);
                });
            }
        }
        audit(actor, "INVITE_GUEST", saved.getId(), "Invited guest " + req.getEmail());
        return ResetPasswordResponse.builder()
                .success(true)
                .temporaryPassword(tempPassword)
                .message("Guest account created for " + req.getEmail()
                        + ". Username: " + username)
                .build();
    }

    /* ── Bulk import / export ────────────────────────────── */

    @Transactional
    public BulkImportResult bulkImport(String csv, String actor) {
        List<String> errors = new ArrayList<>();
        List<String> creds = new ArrayList<>();
        int created = 0, skipped = 0, total = 0;

        String[] lines = csv.replace("\r", "").split("\n");
        int start = (lines.length > 0 && lines[0].toLowerCase().contains("username")) ? 1 : 0;

        for (int i = start; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) continue;
            total++;
            String[] c = line.split(",", -1);
            try {
                String username = val(c, 0);
                String email = val(c, 1);
                if (username.isEmpty() || email.isEmpty()) {
                    errors.add("Row " + (i + 1) + ": username and email are required");
                    skipped++; continue;
                }
                if (userRepository.existsByUsername(username) || userRepository.existsByEmail(email)) {
                    errors.add("Row " + (i + 1) + ": user '" + username + "' already exists");
                    skipped++; continue;
                }
                String temp = generatePassword();
                User u = User.builder()
                        .username(username)
                        .email(email)
                        .displayName(val(c, 2).isEmpty() ? username : val(c, 2))
                        .department(val(c, 3))
                        .jobTitle(val(c, 4))
                        .passwordHash(passwordEncoder.encode(temp))
                        .status(User.UserStatus.ACTIVE)
                        .presence(User.Presence.OFFLINE)
                        .build();
                String roleName = val(c, 5).isEmpty() ? "EMPLOYEE" : val(c, 5).toUpperCase();
                roleRepository.findByName(roleName)
                        .or(() -> roleRepository.findByName("EMPLOYEE"))
                        .ifPresent(r -> u.getRoles().add(r));
                userRepository.save(u);
                creds.add(username + ":" + temp);
                created++;
            } catch (Exception e) {
                errors.add("Row " + (i + 1) + ": " + e.getMessage());
                skipped++;
            }
        }
        audit(actor, "BULK_IMPORT_USERS", null,
                "Imported " + created + " users (" + skipped + " skipped)");
        return BulkImportResult.builder()
                .total(total).created(created).skipped(skipped)
                .errors(errors).generatedCredentials(creds).build();
    }

    @Transactional(readOnly = true)
    public String exportCsv() {
        StringBuilder sb = new StringBuilder(
                "id,username,email,displayName,status,presence,department,jobTitle,guest,roles,createdAt\n");
        for (User u : userRepository.findAll()) {
            sb.append(u.getId()).append(',')
              .append(csv(u.getUsername())).append(',')
              .append(csv(u.getEmail())).append(',')
              .append(csv(u.getDisplayName())).append(',')
              .append(u.getStatus()).append(',')
              .append(u.getPresence()).append(',')
              .append(csv(u.getDepartment())).append(',')
              .append(csv(u.getJobTitle())).append(',')
              .append(u.isGuest()).append(',')
              .append(csv(u.getRoles().stream().map(Role::getName).collect(Collectors.joining("|")))).append(',')
              .append(u.getCreatedAt() == null ? "" : u.getCreatedAt())
              .append('\n');
        }
        return sb.toString();
    }

    /* ── Login history & activity ────────────────────────── */

    @Transactional(readOnly = true)
    public PagedResponse<LoginHistoryEntry> loginHistory(Long userId, int page, int size) {
        Pageable p = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200));
        Page<UserLoginHistory> result = (userId == null)
                ? loginHistoryRepository.findAllByOrderByLoginAtDesc(p)
                : loginHistoryRepository.findByUserIdOrderByLoginAtDesc(userId, p);
        List<LoginHistoryEntry> rows = result.getContent().stream().map(h -> LoginHistoryEntry.builder()
                .id(h.getId())
                .username(h.getUser() != null ? h.getUser().getUsername() : h.getUsernameAttempted())
                .success(h.isSuccess())
                .failureReason(h.getFailureReason())
                .ipAddress(h.getIpAddress())
                .userAgent(h.getUserAgent())
                .loginAt(h.getLoginAt())
                .build()).collect(Collectors.toList());
        return new PagedResponse<>(rows, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), result.isLast());
    }

    @Transactional(readOnly = true)
    public PagedResponse<ActivityEntry> activity(Long userId, int page, int size) {
        Pageable p = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200));
        Page<AuditLog> result = auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, p);
        List<ActivityEntry> rows = result.getContent().stream().map(a -> ActivityEntry.builder()
                .id(a.getId())
                .action(a.getAction())
                .entityType(a.getEntityType())
                .entityId(a.getEntityId())
                .details(a.getDetails())
                .timestamp(a.getCreatedAt())
                .build()).collect(Collectors.toList());
        return new PagedResponse<>(rows, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), result.isLast());
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    private void applyStatus(User user, User.UserStatus status, String reason) {
        user.setStatus(status);
        if (status == User.UserStatus.SUSPENDED || status == User.UserStatus.BLOCKED) {
            user.setSuspendedReason(reason);
            user.setSuspendedAt(LocalDateTime.now());
            user.setPresence(User.Presence.OFFLINE);
        } else {
            user.setSuspendedReason(null);
            user.setSuspendedAt(null);
        }
    }

    private Set<Role> resolveRoles(List<String> names) {
        Set<Role> roles = new HashSet<>();
        for (String n : names) {
            roleRepository.findByName(n.toUpperCase())
                    .ifPresent(roles::add);
        }
        if (roles.isEmpty()) {
            roleRepository.findByName("EMPLOYEE").ifPresent(roles::add);
        }
        return roles;
    }

    private User.UserStatus parseStatus(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return User.UserStatus.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String normalizeSortField(String sortBy) {
        if (sortBy == null) return "createdAt";
        switch (sortBy) {
            case "username": case "email": case "displayName":
            case "status": case "department": case "lastSeenAt": case "createdAt":
                return sortBy;
            default:
                return "createdAt";
        }
    }

    private String generatePassword() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) sb.append(PW_ALPHABET.charAt(RANDOM.nextInt(PW_ALPHABET.length())));
        return sb.toString();
    }

    private void audit(String actor, String action, Long entityId, String details) {
        try {
            User actorUser = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
            auditLogRepository.save(AuditLog.builder()
                    .user(actorUser)
                    .action(action)
                    .entityType("User")
                    .entityId(entityId)
                    .details(details)
                    .build());
        } catch (Exception e) {
            log.warn("Audit logging failed for action {}", action, e);
        }
    }

    private String val(String[] arr, int idx) {
        return idx < arr.length && arr[idx] != null ? arr[idx].trim() : "";
    }

    private String csv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .displayName(u.getDisplayName())
                .avatarUrl(u.getAvatarUrl())
                .status(u.getStatus().name())
                .presence(u.getPresence().name())
                .jobTitle(u.getJobTitle())
                .department(u.getDepartment())
                .phoneNumber(u.getPhoneNumber())
                .guest(u.isGuest())
                .roles(u.getRoles().stream().map(Role::getName).collect(Collectors.toList()))
                .suspendedReason(u.getSuspendedReason())
                .suspendedAt(u.getSuspendedAt())
                .lastSeenAt(u.getLastSeenAt())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }
}
