package com.enterprise.collab.controller;

import com.enterprise.collab.dto.ScheduledCallDto;
import com.enterprise.collab.service.ScheduledCallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/scheduled-calls")
@RequiredArgsConstructor
@Validated
public class ScheduledCallController {

    private final ScheduledCallService service;

    @PostMapping
    public ResponseEntity<ScheduledCallDto.Response> create(
            @Valid @RequestBody ScheduledCallDto.CreateRequest body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.schedule(body, principal.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<ScheduledCallDto.Response>> listUpcoming(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.listUpcomingForUser(principal.getUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScheduledCallDto.Response> getOne(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.getOne(id, principal.getUsername()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ScheduledCallDto.Response> update(
            @PathVariable Long id,
            @RequestBody ScheduledCallDto.UpdateRequest body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.update(id, body, principal.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        service.cancel(id, principal.getUsername());
        return ResponseEntity.noContent().build();
    }
}
