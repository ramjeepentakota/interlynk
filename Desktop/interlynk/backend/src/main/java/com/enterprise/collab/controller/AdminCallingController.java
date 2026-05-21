package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminMeetingsDto.*;
import com.enterprise.collab.service.AdminCallingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/admin/calling")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminCallingController {

    private final AdminCallingService service;

    /* ── Phone numbers ────────────────────────────────────── */

    @GetMapping("/numbers")
    public ResponseEntity<PagedPhoneNumbers> listNumbers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String assignmentType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(service.listNumbers(q, assignmentType, page, size));
    }

    @PostMapping("/numbers")
    public ResponseEntity<PhoneNumberResponse> createNumber(
            @Valid @RequestBody CreatePhoneNumberRequest req, Authentication auth) {
        return ResponseEntity.ok(service.createNumber(req, auth.getName()));
    }

    @PostMapping("/numbers/{id}/assign")
    public ResponseEntity<PhoneNumberResponse> assignNumber(
            @PathVariable Long id, @Valid @RequestBody AssignPhoneNumberRequest req, Authentication auth) {
        return ResponseEntity.ok(service.assignNumber(id, req, auth.getName()));
    }

    @DeleteMapping("/numbers/{id}")
    public ResponseEntity<SimpleResponse> deleteNumber(@PathVariable Long id, Authentication auth) {
        service.deleteNumber(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Phone number deleted"));
    }

    /* ── Call queues ──────────────────────────────────────── */

    @GetMapping("/queues")
    public ResponseEntity<List<CallQueueResponse>> listQueues() {
        return ResponseEntity.ok(service.listQueues());
    }

    @PostMapping("/queues")
    public ResponseEntity<CallQueueResponse> createQueue(
            @Valid @RequestBody CreateCallQueueRequest req, Authentication auth) {
        return ResponseEntity.ok(service.createQueue(req, auth.getName()));
    }

    @PutMapping("/queues/{id}")
    public ResponseEntity<CallQueueResponse> updateQueue(
            @PathVariable Long id, @RequestBody CreateCallQueueRequest req, Authentication auth) {
        return ResponseEntity.ok(service.updateQueue(id, req, auth.getName()));
    }

    @DeleteMapping("/queues/{id}")
    public ResponseEntity<SimpleResponse> deleteQueue(@PathVariable Long id, Authentication auth) {
        service.deleteQueue(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Queue deleted"));
    }

    /* ── Auto attendants ──────────────────────────────────── */

    @GetMapping("/attendants")
    public ResponseEntity<List<AutoAttendantResponse>> listAttendants() {
        return ResponseEntity.ok(service.listAttendants());
    }

    @PostMapping("/attendants")
    public ResponseEntity<AutoAttendantResponse> createAttendant(
            @Valid @RequestBody CreateAutoAttendantRequest req, Authentication auth) {
        return ResponseEntity.ok(service.createAttendant(req, auth.getName()));
    }

    @PutMapping("/attendants/{id}")
    public ResponseEntity<AutoAttendantResponse> updateAttendant(
            @PathVariable Long id, @RequestBody CreateAutoAttendantRequest req, Authentication auth) {
        return ResponseEntity.ok(service.updateAttendant(id, req, auth.getName()));
    }

    @DeleteMapping("/attendants/{id}")
    public ResponseEntity<SimpleResponse> deleteAttendant(@PathVariable Long id, Authentication auth) {
        service.deleteAttendant(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Attendant deleted"));
    }

    /* ── Voicemail ───────────────────────────────────────── */

    @GetMapping("/voicemail/{userId}")
    public ResponseEntity<VoicemailResponse> getVoicemail(@PathVariable Long userId) {
        return ResponseEntity.ok(service.getOrCreateVoicemail(userId));
    }

    @PutMapping("/voicemail/{userId}")
    public ResponseEntity<VoicemailResponse> updateVoicemail(
            @PathVariable Long userId, @RequestBody UpdateVoicemailRequest req, Authentication auth) {
        return ResponseEntity.ok(service.updateVoicemail(userId, req, auth.getName()));
    }
}
