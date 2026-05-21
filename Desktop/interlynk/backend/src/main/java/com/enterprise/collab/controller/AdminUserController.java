package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminMgmtDto.*;
import com.enterprise.collab.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

/**
 * Module 1 — User Management. All routes are admin-only (also enforced
 * globally by SecurityConfig for {@code /api/admin/**}). Paths are chosen
 * to coexist with the legacy {@code AdminController}.
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping("/search")
    public ResponseEntity<PagedUsersResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean guest,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(
                adminUserService.search(q, status, guest, department, page, size, sortBy, sortDir));
    }

    @GetMapping("/departments")
    public ResponseEntity<?> departments() {
        return ResponseEntity.ok(adminUserService.departments());
    }

    @GetMapping("/{userId}/detail")
    public ResponseEntity<AdminUserResponse> detail(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.getOne(userId));
    }

    @PutMapping("/{userId}/profile")
    public ResponseEntity<AdminUserResponse> update(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRequest req,
            Authentication auth) {
        return ResponseEntity.ok(adminUserService.update(userId, req, auth.getName()));
    }

    @PostMapping("/{userId}/suspend")
    public ResponseEntity<AdminUserResponse> suspend(
            @PathVariable Long userId,
            @Valid @RequestBody SuspendRequest req,
            Authentication auth) {
        return ResponseEntity.ok(adminUserService.suspend(userId, req.getReason(), auth.getName()));
    }

    @PostMapping("/{userId}/unsuspend")
    public ResponseEntity<AdminUserResponse> unsuspend(@PathVariable Long userId, Authentication auth) {
        return ResponseEntity.ok(adminUserService.unsuspend(userId, auth.getName()));
    }

    @PostMapping("/{userId}/block")
    public ResponseEntity<AdminUserResponse> block(
            @PathVariable Long userId,
            @RequestBody(required = false) Map<String, Boolean> body,
            Authentication auth) {
        boolean blocked = body == null || body.getOrDefault("blocked", true);
        return ResponseEntity.ok(adminUserService.block(userId, blocked, auth.getName()));
    }

    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<ResetPasswordResponse> resetPassword(
            @PathVariable Long userId,
            @RequestBody(required = false) ResetPasswordRequest req,
            Authentication auth) {
        String pw = req == null ? null : req.getNewPassword();
        return ResponseEntity.ok(adminUserService.resetPassword(userId, pw, auth.getName()));
    }

    @DeleteMapping("/{userId}/purge")
    public ResponseEntity<SimpleResponse> purge(@PathVariable Long userId, Authentication auth) {
        adminUserService.delete(userId, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "User deleted"));
    }

    @PostMapping("/invite-guest")
    public ResponseEntity<ResetPasswordResponse> inviteGuest(
            @Valid @RequestBody InviteGuestRequest req, Authentication auth) {
        return ResponseEntity.ok(adminUserService.inviteGuest(req, auth.getName()));
    }

    @PostMapping(value = "/import", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<BulkImportResult> importCsv(
            @RequestBody String csv, Authentication auth) {
        return ResponseEntity.ok(adminUserService.bulkImport(csv, auth.getName()));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> exportCsv() {
        String csv = adminUserService.exportCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"users-export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/{userId}/login-history")
    public ResponseEntity<PagedResponse<LoginHistoryEntry>> userLoginHistory(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(adminUserService.loginHistory(userId, page, size));
    }

    @GetMapping("/login-history")
    public ResponseEntity<PagedResponse<LoginHistoryEntry>> allLoginHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(adminUserService.loginHistory(null, page, size));
    }

    @GetMapping("/{userId}/activity")
    public ResponseEntity<PagedResponse<ActivityEntry>> activity(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(adminUserService.activity(userId, page, size));
    }
}
