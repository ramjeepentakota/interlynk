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
import java.util.stream.Collectors;

/**
 * Admin-side channel management — separate from the existing
 * {@link com.enterprise.collab.controller.AdminController} channel endpoints
 * so we can offer pagination, visibility, archive, and full lifecycle.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminChannelMgmtService {

    private final ChannelRepository channelRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public PagedChannels search(String q, Long teamId, String type, String visibility,
                                Boolean archived, int page, int size,
                                String sortBy, String sortDir) {
        Sort sort = Sort.by("desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC,
                safeSort(sortBy));
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), sort);
        Page<Channel> result = channelRepository.adminSearch(
                blank(q), teamId, archived, parseType(type), parseVisibility(visibility), pageable);
        return PagedChannels.builder()
                .content(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .first(result.isFirst()).last(result.isLast()).build();
    }

    @Transactional
    public AdminChannelResponse create(CreateChannelRequest req, String actor) {
        Team team = req.getTeamId() == null ? null
                : teamRepository.findById(req.getTeamId())
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", req.getTeamId()));
        if (team != null && channelRepository.existsByNameAndTeamId(req.getName(), team.getId())) {
            throw new ConflictException("Channel '" + req.getName() + "' already exists in this team.");
        }
        User actorUser = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
        Channel c = Channel.builder()
                .name(req.getName())
                .description(req.getDescription())
                .type(parseType(req.getType()) == null ? Channel.ChannelType.TEXT : parseType(req.getType()))
                .visibility(parseVisibility(req.getVisibility()) == null ? Channel.Visibility.STANDARD : parseVisibility(req.getVisibility()))
                .team(team)
                .createdBy(actorUser)
                .category(req.getCategory())
                .maxParticipants(req.getMaxParticipants() == null ? 25 : req.getMaxParticipants())
                .isActive(true)
                .isLocked(false)
                .build();
        Channel saved = channelRepository.save(c);
        audit(actor, "CREATE_CHANNEL", saved.getId(),
                "Created " + saved.getType() + " channel " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public AdminChannelResponse update(Long id, UpdateChannelRequest req, String actor) {
        Channel c = require(id);
        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getCategory() != null) c.setCategory(req.getCategory());
        if (req.getLocked() != null) c.setIsLocked(req.getLocked());
        if (req.getActive() != null) c.setIsActive(req.getActive());
        if (req.getMaxParticipants() != null) {
            if (req.getMaxParticipants() < 1) throw new BadRequestException("maxParticipants must be >= 1");
            c.setMaxParticipants(req.getMaxParticipants());
        }
        if (req.getVisibility() != null) {
            Channel.Visibility v = parseVisibility(req.getVisibility());
            if (v == null) throw new BadRequestException("Invalid visibility: " + req.getVisibility());
            c.setVisibility(v);
        }
        Channel saved = channelRepository.save(c);
        audit(actor, "UPDATE_CHANNEL", saved.getId(), "Updated channel " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public AdminChannelResponse archive(Long id, String actor) {
        Channel c = require(id);
        c.setArchived(true);
        c.setArchivedAt(LocalDateTime.now());
        c.setIsActive(false);
        channelRepository.save(c);
        audit(actor, "ARCHIVE_CHANNEL", id, "Archived channel " + c.getName());
        return toResponse(c);
    }

    @Transactional
    public AdminChannelResponse restore(Long id, String actor) {
        Channel c = require(id);
        c.setArchived(false);
        c.setArchivedAt(null);
        c.setIsActive(true);
        channelRepository.save(c);
        audit(actor, "RESTORE_CHANNEL", id, "Restored channel " + c.getName());
        return toResponse(c);
    }

    @Transactional
    public void delete(Long id, String actor) {
        Channel c = require(id);
        String name = c.getName();
        channelRepository.delete(c);
        audit(actor, "DELETE_CHANNEL", id, "Deleted channel " + name);
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private Channel require(Long id) {
        return channelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", id));
    }

    private Channel.ChannelType parseType(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Channel.ChannelType.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private Channel.Visibility parseVisibility(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Channel.Visibility.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private String blank(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private String safeSort(String s) {
        if (s == null) return "createdAt";
        switch (s) {
            case "name": case "createdAt": case "updatedAt":
            case "type": case "visibility": case "position": return s;
            default: return "createdAt";
        }
    }

    private void audit(String actor, String action, Long entityId, String details) {
        try {
            User u = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
            auditLogRepository.save(AuditLog.builder()
                    .user(u).action(action).entityType("Channel").entityId(entityId).details(details).build());
        } catch (Exception e) { log.warn("audit failed", e); }
    }

    AdminChannelResponse toResponse(Channel c) {
        return AdminChannelResponse.builder()
                .id(c.getId()).name(c.getName()).description(c.getDescription())
                .type(c.getType() == null ? "TEXT" : c.getType().name())
                .visibility(c.getVisibility() == null ? "STANDARD" : c.getVisibility().name())
                .archived(c.isArchived()).archivedAt(c.getArchivedAt())
                .active(Boolean.TRUE.equals(c.getIsActive()))
                .locked(Boolean.TRUE.equals(c.getIsLocked()))
                .category(c.getCategory())
                .maxParticipants(c.getMaxParticipants())
                .teamId(c.getTeam() == null ? null : c.getTeam().getId())
                .teamName(c.getTeam() == null ? null : c.getTeam().getName())
                .memberCount(c.getMembers() == null ? 0 : c.getMembers().size())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
