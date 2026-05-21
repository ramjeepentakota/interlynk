package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminTeamsDto.*;
import com.enterprise.collab.service.AdminTeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/admin/teams")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminTeamController {

    private final AdminTeamService teamService;

    @GetMapping
    public ResponseEntity<PagedTeams> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean archived,
            @RequestParam(required = false) String visibility,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(teamService.search(q, archived, visibility, page, size, sortBy, sortDir));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminTeamResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(teamService.get(id));
    }

    @PostMapping
    public ResponseEntity<AdminTeamResponse> create(
            @Valid @RequestBody CreateTeamRequest req, Authentication auth) {
        return ResponseEntity.ok(teamService.create(req, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AdminTeamResponse> update(
            @PathVariable Long id, @Valid @RequestBody UpdateTeamRequest req, Authentication auth) {
        return ResponseEntity.ok(teamService.update(id, req, auth.getName()));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<AdminTeamResponse> archive(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(teamService.archive(id, auth.getName()));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<AdminTeamResponse> restore(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(teamService.restore(id, auth.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<SimpleResponse> delete(@PathVariable Long id, Authentication auth) {
        teamService.delete(id, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Team deleted"));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<TeamMemberResponse>> members(@PathVariable Long id) {
        return ResponseEntity.ok(teamService.members(id));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<TeamMemberResponse> addMember(
            @PathVariable Long id, @Valid @RequestBody AddMemberRequest req, Authentication auth) {
        return ResponseEntity.ok(teamService.addMember(id, req, auth.getName()));
    }

    @PutMapping("/{id}/members/{userId}/role")
    public ResponseEntity<TeamMemberResponse> changeRole(
            @PathVariable Long id, @PathVariable Long userId,
            @Valid @RequestBody ChangeRoleRequest req, Authentication auth) {
        return ResponseEntity.ok(teamService.changeRole(id, userId, req.getRole(), auth.getName()));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<SimpleResponse> removeMember(
            @PathVariable Long id, @PathVariable Long userId, Authentication auth) {
        teamService.removeMember(id, userId, auth.getName());
        return ResponseEntity.ok(new SimpleResponse(true, "Member removed"));
    }
}
