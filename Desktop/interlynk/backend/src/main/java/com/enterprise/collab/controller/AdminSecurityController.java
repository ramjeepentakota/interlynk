package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.service.AdminSecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/** MFA enrollment + RBAC. */
@RestController
@RequestMapping("/api/admin/security")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminSecurityController {

    private final AdminSecurityService service;

    /* ── MFA ─────────────────────────────────────────────── */

    @GetMapping("/users/{userId}/mfa")
    public ResponseEntity<MfaStatusResponse> mfa(@PathVariable Long userId) {
        return ResponseEntity.ok(service.mfaStatus(userId));
    }

    @PutMapping("/users/{userId}/mfa")
    public ResponseEntity<MfaStatusResponse> setMfa(
            @PathVariable Long userId, @RequestBody MfaSetRequest req, Authentication auth) {
        return ResponseEntity.ok(service.setMfa(userId, req, auth.getName()));
    }

    @PostMapping("/users/{userId}/mfa/enroll")
    public ResponseEntity<MfaEnrollResponse> enroll(
            @PathVariable Long userId, Authentication auth) {
        return ResponseEntity.ok(service.enrollMfa(userId, auth.getName()));
    }

    /* ── RBAC ────────────────────────────────────────────── */

    @GetMapping("/permissions")
    public ResponseEntity<List<PermissionCatalogEntry>> catalog() {
        return ResponseEntity.ok(service.permissionCatalog());
    }

    @GetMapping("/roles")
    public ResponseEntity<List<RoleResponse>> roles() {
        return ResponseEntity.ok(service.listRoles());
    }

    @PostMapping("/roles")
    public ResponseEntity<RoleResponse> createRole(
            @Valid @RequestBody CreateRoleRequest req, Authentication auth) {
        return ResponseEntity.ok(service.createRole(req, auth.getName()));
    }

    @PutMapping("/roles/{id}")
    public ResponseEntity<RoleResponse> updateRole(
            @PathVariable Long id, @RequestBody UpdateRoleRequest req, Authentication auth) {
        return ResponseEntity.ok(service.updateRole(id, req, auth.getName()));
    }

    @DeleteMapping("/roles/{id}")
    public ResponseEntity<SimpleResponse> deleteRole(@PathVariable Long id, Authentication auth) {
        service.deleteRole(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Role deleted"));
    }
}
