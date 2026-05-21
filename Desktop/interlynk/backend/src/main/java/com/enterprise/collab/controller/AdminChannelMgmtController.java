package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminTeamsDto.*;
import com.enterprise.collab.service.AdminChannelMgmtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

/**
 * Distinct base path from legacy {@code /api/admin/channels} so we can offer
 * pagination, archive/restore, and visibility without clashing.
 */
@RestController
@RequestMapping("/api/admin/channel-mgmt")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminChannelMgmtController {

    private final AdminChannelMgmtService channelService;

    @GetMapping
    public ResponseEntity<PagedChannels> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String visibility,
            @RequestParam(required = false) Boolean archived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(channelService.search(q, teamId, type, visibility, archived,
                page, size, sortBy, sortDir));
    }

    @PostMapping
    public ResponseEntity<AdminChannelResponse> create(
            @Valid @RequestBody CreateChannelRequest req, Authentication auth) {
        return ResponseEntity.ok(channelService.create(req, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AdminChannelResponse> update(
            @PathVariable Long id, @Valid @RequestBody UpdateChannelRequest req, Authentication auth) {
        return ResponseEntity.ok(channelService.update(id, req, auth.getName()));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<AdminChannelResponse> archive(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(channelService.archive(id, auth.getName()));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<AdminChannelResponse> restore(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(channelService.restore(id, auth.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<SimpleResponse> delete(@PathVariable Long id, Authentication auth) {
        channelService.delete(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Channel deleted"));
    }
}
