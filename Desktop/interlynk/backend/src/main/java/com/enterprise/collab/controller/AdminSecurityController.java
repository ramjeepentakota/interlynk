package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.security.Totp;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.enterprise.collab.service.AdminSecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.io.ByteArrayOutputStream;
import java.util.List;

/** MFA enrollment + RBAC. */
@RestController
@RequestMapping("/api/admin/security")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminSecurityController {

    private final AdminSecurityService service;
    private final UserRepository userRepository;

    @Value("${app.security.mfa.issuer:Narada}")
    private String mfaIssuer;

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

    /** Stage 1 — generate a new TOTP secret + backup codes. Returns once. */
    @PostMapping("/users/{userId}/mfa/enroll")
    public ResponseEntity<MfaEnrollResponse> enroll(
            @PathVariable Long userId, Authentication auth) {
        return ResponseEntity.ok(service.enrollMfa(userId, auth.getName()));
    }

    /** Stage 2 — verify the first authenticator-app code before activating. */
    @PostMapping("/users/{userId}/mfa/confirm")
    public ResponseEntity<MfaStatusResponse> confirm(
            @PathVariable Long userId,
            @Valid @RequestBody MfaConfirmRequest req,
            Authentication auth) {
        return ResponseEntity.ok(service.confirmMfa(userId, req.getCode(), auth.getName()));
    }

    /**
     * Returns a PNG QR code encoding the current user's
     * {@code otpauth://totp/...} URL. Scan this from Authy / Google
     * Authenticator / Microsoft Authenticator / 1Password / Duo / Bitwarden.
     * Only returns a code while the user has a pending (un-confirmed)
     * enrollment — once MFA is confirmed, the secret should not be re-exposed.
     */
    @GetMapping(value = "/users/{userId}/mfa/qr.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> qr(@PathVariable Long userId) throws Exception {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        if (u.getMfaSecret() == null) {
            return ResponseEntity.notFound().build();
        }
        String otpauth = Totp.otpAuthUrl(mfaIssuer, u.getUsername(), u.getMfaSecret());
        BitMatrix matrix = new QRCodeWriter().encode(otpauth, BarcodeFormat.QR_CODE, 280, 280);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", out);
        return ResponseEntity.ok()
                .header("Cache-Control", "no-store, no-cache, must-revalidate")
                .body(out.toByteArray());
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
