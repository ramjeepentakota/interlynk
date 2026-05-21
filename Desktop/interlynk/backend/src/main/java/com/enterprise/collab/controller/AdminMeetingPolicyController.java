package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminMeetingsDto.*;
import com.enterprise.collab.service.AdminMeetingPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/admin/policies/meetings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminMeetingPolicyController {

    private final AdminMeetingPolicyService service;

    @GetMapping public ResponseEntity<List<MeetingPolicyResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/{id}") public ResponseEntity<MeetingPolicyResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping public ResponseEntity<MeetingPolicyResponse> create(
            @Valid @RequestBody CreateMeetingPolicyRequest req) {
        return ResponseEntity.ok(service.create(req));
    }

    @PutMapping("/{id}") public ResponseEntity<MeetingPolicyResponse> update(
            @PathVariable Long id, @RequestBody CreateMeetingPolicyRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}") public ResponseEntity<SimpleResponse> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(new SimpleResponse(true, "Policy deleted"));
    }
}
