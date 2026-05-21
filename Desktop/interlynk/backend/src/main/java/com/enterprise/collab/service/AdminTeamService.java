package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminTeamsDto.*;
import com.enterprise.collab.entity.*;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Team lifecycle, membership, and policy assignment.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminTeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final MessagingPolicyRepository policyRepository;
    private final AuditLogRepository auditLogRepository;

    /* ── List / search ───────────────────────────────────── */

    @Transactional(readOnly = true)
    public PagedTeams search(String q, Boolean archived, String visibility,
                             int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by("desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC,
                safeSort(sortBy));
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), sort);
        String qn = (q == null || q.isBlank()) ? null : q.trim();
        Team.Visibility vis = parseVisibility(visibility);
        Page<Team> result = teamRepository.adminSearch(qn, archived, vis, pageable);
        return PagedTeams.builder()
                .content(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .first(result.isFirst()).last(result.isLast()).build();
    }

    @Transactional(readOnly = true)
    public AdminTeamResponse get(Long id) { return toResponse(require(id)); }

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> members(Long teamId) {
        require(teamId);
        return teamMemberRepository.findByTeamId(teamId).stream()
                .map(this::toMember).collect(Collectors.toList());
    }

    /* ── Create / update ─────────────────────────────────── */

    @Transactional
    public AdminTeamResponse create(CreateTeamRequest req, String actor) {
        if (teamRepository.findByName(req.getName()).isPresent()) {
            throw new ConflictException("A team named '" + req.getName() + "' already exists.");
        }
        User creator = actor == null ? null : userRepository.findByUsername(actor).orElse(null);

        Team team = Team.builder()
                .name(req.getName())
                .description(req.getDescription())
                .createdBy(creator)
                .visibility(parseVisibility(req.getVisibility()) != null
                        ? parseVisibility(req.getVisibility())
                        : Team.Visibility.PRIVATE)
                .templateName(req.getTemplateName())
                .messagingPolicy(req.getMessagingPolicyId() == null ? null
                        : policyRepository.findById(req.getMessagingPolicyId()).orElse(null))
                .build();
        Team saved = teamRepository.save(team);

        // creator is automatic owner
        if (creator != null) {
            teamMemberRepository.save(TeamMember.builder()
                    .team(saved).user(creator).roleInTeam(TeamMember.TeamRole.OWNER).build());
        }
        // additional owners
        if (req.getOwnerUsernames() != null) {
            for (String u : req.getOwnerUsernames()) {
                if (creator != null && u.equalsIgnoreCase(creator.getUsername())) continue;
                userRepository.findByUsername(u).ifPresent(usr ->
                        teamMemberRepository.save(TeamMember.builder()
                                .team(saved).user(usr).roleInTeam(TeamMember.TeamRole.OWNER).build()));
            }
        }
        applyTemplate(saved, req.getTemplateName(), creator);
        audit(actor, "CREATE_TEAM", saved.getId(), "Created team " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public AdminTeamResponse update(Long id, UpdateTeamRequest req, String actor) {
        Team t = require(id);
        if (req.getName() != null && !req.getName().isBlank()) t.setName(req.getName());
        if (req.getDescription() != null) t.setDescription(req.getDescription());
        if (req.getVisibility() != null) {
            Team.Visibility v = parseVisibility(req.getVisibility());
            if (v == null) throw new BadRequestException("Invalid visibility: " + req.getVisibility());
            t.setVisibility(v);
        }
        if (req.getTemplateName() != null) t.setTemplateName(req.getTemplateName());
        if (req.getMessagingPolicyId() != null) {
            if (req.getMessagingPolicyId() < 0) {
                t.setMessagingPolicy(null);
            } else {
                t.setMessagingPolicy(policyRepository.findById(req.getMessagingPolicyId())
                        .orElseThrow(() -> new ResourceNotFoundException("Policy", "id", req.getMessagingPolicyId())));
            }
        }
        Team saved = teamRepository.save(t);
        audit(actor, "UPDATE_TEAM", saved.getId(), "Updated team " + saved.getName());
        return toResponse(saved);
    }

    /* ── Lifecycle ───────────────────────────────────────── */

    @Transactional
    public AdminTeamResponse archive(Long id, String actor) {
        Team t = require(id);
        t.setArchived(true);
        t.setArchivedAt(LocalDateTime.now());
        teamRepository.save(t);
        // also archive channels under this team
        channelRepository.findByTeamId(id).forEach(c -> {
            c.setArchived(true);
            c.setArchivedAt(LocalDateTime.now());
            c.setIsActive(false);
            channelRepository.save(c);
        });
        audit(actor, "ARCHIVE_TEAM", id, "Archived team " + t.getName());
        return toResponse(t);
    }

    @Transactional
    public AdminTeamResponse restore(Long id, String actor) {
        Team t = require(id);
        t.setArchived(false);
        t.setArchivedAt(null);
        teamRepository.save(t);
        channelRepository.findByTeamId(id).forEach(c -> {
            c.setArchived(false);
            c.setArchivedAt(null);
            c.setIsActive(true);
            channelRepository.save(c);
        });
        audit(actor, "RESTORE_TEAM", id, "Restored team " + t.getName());
        return toResponse(t);
    }

    @Transactional
    public void delete(Long id, String actor) {
        Team t = require(id);
        String name = t.getName();
        teamMemberRepository.findByTeamId(id).forEach(teamMemberRepository::delete);
        channelRepository.findByTeamId(id).forEach(channelRepository::delete);
        teamRepository.delete(t);
        audit(actor, "DELETE_TEAM", id, "Permanently deleted team " + name);
    }

    /* ── Membership ──────────────────────────────────────── */

    @Transactional
    public TeamMemberResponse addMember(Long teamId, AddMemberRequest req, String actor) {
        Team t = require(teamId);
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", req.getUsername()));
        if (teamMemberRepository.findByTeamIdAndUserId(teamId, user.getId()).isPresent()) {
            throw new ConflictException("User is already a member of this team.");
        }
        TeamMember.TeamRole role = parseRole(req.getRole());
        TeamMember m = teamMemberRepository.save(TeamMember.builder()
                .team(t).user(user).roleInTeam(role).build());
        audit(actor, "ADD_TEAM_MEMBER", teamId,
                "Added " + user.getUsername() + " as " + role + " to " + t.getName());
        return toMember(m);
    }

    @Transactional
    public TeamMemberResponse changeRole(Long teamId, Long userId, String role, String actor) {
        TeamMember m = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("TeamMember", "userId", userId));
        TeamMember.TeamRole newRole = parseRole(role);
        if (m.getRoleInTeam() == TeamMember.TeamRole.OWNER
                && newRole != TeamMember.TeamRole.OWNER
                && countOwners(teamId) <= 1) {
            throw new BadRequestException("A team must have at least one owner.");
        }
        m.setRoleInTeam(newRole);
        teamMemberRepository.save(m);
        audit(actor, "CHANGE_TEAM_ROLE", teamId,
                "Changed " + m.getUser().getUsername() + " to " + newRole);
        return toMember(m);
    }

    @Transactional
    public void removeMember(Long teamId, Long userId, String actor) {
        TeamMember m = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("TeamMember", "userId", userId));
        if (m.getRoleInTeam() == TeamMember.TeamRole.OWNER && countOwners(teamId) <= 1) {
            throw new BadRequestException("Cannot remove the last owner. Transfer ownership first.");
        }
        teamMemberRepository.delete(m);
        audit(actor, "REMOVE_TEAM_MEMBER", teamId,
                "Removed " + m.getUser().getUsername() + " from team");
    }

    /* ── Internals ───────────────────────────────────────── */

    private long countOwners(Long teamId) {
        return teamMemberRepository.findByTeamId(teamId).stream()
                .filter(tm -> tm.getRoleInTeam() == TeamMember.TeamRole.OWNER).count();
    }

    /** Provisions starter channels for known templates. */
    private void applyTemplate(Team team, String template, User creator) {
        if (template == null || template.isBlank()) return;
        switch (template.toLowerCase()) {
            case "engineering":
                provision(team, creator, "general", "Team general discussion");
                provision(team, creator, "incidents", "Production incidents");
                provision(team, creator, "deploys", "Deployment announcements");
                break;
            case "sales":
                provision(team, creator, "general", "Team general discussion");
                provision(team, creator, "wins", "Closed deals & celebrations");
                provision(team, creator, "pipeline", "Active opportunities");
                break;
            case "leadership":
                provision(team, creator, "general", "Leadership discussion");
                provision(team, creator, "announcements", "Org announcements");
                break;
            default:
                provision(team, creator, "general", "Team general discussion");
        }
    }

    private void provision(Team team, User creator, String name, String description) {
        if (channelRepository.existsByNameAndTeamId(name, team.getId())) return;
        Channel ch = Channel.builder()
                .name(name).description(description)
                .type(Channel.ChannelType.TEXT)
                .visibility(Channel.Visibility.STANDARD)
                .team(team).createdBy(creator)
                .isActive(true).isLocked(false)
                .build();
        channelRepository.save(ch);
    }

    private Team require(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", id));
    }

    private Team.Visibility parseVisibility(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Team.Visibility.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private TeamMember.TeamRole parseRole(String s) {
        if (s == null || s.isBlank()) return TeamMember.TeamRole.MEMBER;
        try { return TeamMember.TeamRole.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid team role: " + s);
        }
    }

    private String safeSort(String s) {
        if (s == null) return "createdAt";
        switch (s) {
            case "name": case "createdAt": case "updatedAt": case "visibility": return s;
            default: return "createdAt";
        }
    }

    private void audit(String actor, String action, Long entityId, String details) {
        try {
            User u = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
            auditLogRepository.save(AuditLog.builder()
                    .user(u).action(action).entityType("Team").entityId(entityId).details(details).build());
        } catch (Exception e) { log.warn("audit failed", e); }
    }

    AdminTeamResponse toResponse(Team t) {
        List<TeamMember> members = teamMemberRepository.findByTeamId(t.getId());
        int owners = (int) members.stream()
                .filter(m -> m.getRoleInTeam() == TeamMember.TeamRole.OWNER).count();
        int channels = channelRepository.findByTeamId(t.getId()).size();
        return AdminTeamResponse.builder()
                .id(t.getId()).name(t.getName()).description(t.getDescription())
                .visibility(t.getVisibility() == null ? "PRIVATE" : t.getVisibility().name())
                .templateName(t.getTemplateName())
                .archived(t.isArchived()).archivedAt(t.getArchivedAt())
                .createdAt(t.getCreatedAt()).updatedAt(t.getUpdatedAt())
                .createdByUsername(t.getCreatedBy() == null ? null : t.getCreatedBy().getUsername())
                .messagingPolicyId(t.getMessagingPolicy() == null ? null : t.getMessagingPolicy().getId())
                .messagingPolicyName(t.getMessagingPolicy() == null ? null : t.getMessagingPolicy().getName())
                .memberCount(members.size()).ownerCount(owners).channelCount(channels)
                .build();
    }

    private TeamMemberResponse toMember(TeamMember m) {
        User u = m.getUser();
        return TeamMemberResponse.builder()
                .userId(u.getId()).username(u.getUsername())
                .displayName(u.getDisplayName()).email(u.getEmail())
                .roleInTeam(m.getRoleInTeam() == null ? "MEMBER" : m.getRoleInTeam().name())
                .joinedAt(m.getJoinedAt())
                .build();
    }
}
