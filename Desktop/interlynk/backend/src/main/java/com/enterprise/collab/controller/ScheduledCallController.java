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

    /**
     * Join (or launch) the call's single shared room. Returns the call with its
     * callRoomId populated so the client connects everyone to the SAME SFU room.
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<ScheduledCallDto.Response> join(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.joinLive(id, principal.getUsername()));
    }

    /**
     * Look up a scheduled call by its shareable meeting code. Anyone signed in
     * can resolve a code to view the meeting's title/time — same trust model
     * as a Google Meet / Zoom join link.
     */
    @GetMapping("/by-code/{code}")
    public ResponseEntity<ScheduledCallDto.Response> getByCode(@PathVariable String code) {
        return ResponseEntity.ok(service.getByCode(code));
    }

    /**
     * Join a scheduled call by its meeting code. If the caller is not already
     * an invitee they are added on the fly, then routed through the same
     * shared-room join path as the id-based endpoint.
     */
    @PostMapping("/by-code/{code}/join")
    public ResponseEntity<ScheduledCallDto.Response> joinByCode(
            @PathVariable String code,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.joinLiveByCode(code, principal.getUsername()));
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
