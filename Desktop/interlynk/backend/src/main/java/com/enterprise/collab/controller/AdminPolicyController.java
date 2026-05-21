package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminTeamsDto.*;
import com.enterprise.collab.service.AdminPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/admin/policies/messaging")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminPolicyController {

    private final AdminPolicyService policyService;

    @GetMapping
    public ResponseEntity<List<MessagingPolicyResponse>> list() {
        return ResponseEntity.ok(policyService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessagingPolicyResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(policyService.get(id));
    }

    @PostMapping
    public ResponseEntity<MessagingPolicyResponse> create(@Valid @RequestBody CreatePolicyRequest req) {
        return ResponseEntity.ok(policyService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessagingPolicyResponse> update(
            @PathVariable Long id, @RequestBody CreatePolicyRequest req) {
        return ResponseEntity.ok(policyService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<SimpleResponse> delete(@PathVariable Long id) {
        policyService.delete(id);
        return ResponseEntity.ok(new SimpleResponse(true, "Policy deleted"));
    }
}
