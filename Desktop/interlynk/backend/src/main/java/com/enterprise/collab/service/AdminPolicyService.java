package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminTeamsDto.*;
import com.enterprise.collab.entity.MessagingPolicy;
import com.enterprise.collab.entity.Team;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.MessagingPolicyRepository;
import com.enterprise.collab.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Messaging-policy CRUD plus the central lookup that other services
 * use to resolve "what rules apply to this team / message?".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminPolicyService {

    private final MessagingPolicyRepository policyRepository;
    private final TeamRepository teamRepository;

    /** Bootstrap a sensible default policy after the context is ready. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void ensureDefault() {
        try {
            if (policyRepository.findFirstByDefaultPolicyTrue().isPresent()) return;
            try {
                MessagingPolicy p = MessagingPolicy.builder()
                        .name("Global Default")
                        .description("Default messaging policy applied to all teams without an explicit assignment.")
                        .defaultPolicy(true)
                        .allowOwnerDelete(true).allowUserDelete(true).allowUserEdit(true)
                        .allowGifs(true).allowStickers(true).allowMemes(true)
                        .readReceiptsEnabled(true).allowExternalChat(false)
                        .allowFileAttachments(true).allowUrlPreviews(true)
                        .maxAttachmentMb(25).retentionDays(0).chatSupervision(false)
                        .build();
                policyRepository.save(p);
                log.info("Created default messaging policy.");
            } catch (Exception e) {
                log.warn("Unable to seed default policy (may already exist): {}", e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Skipping messaging-policy seed (will retry on next start): {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<MessagingPolicyResponse> list() {
        return policyRepository.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MessagingPolicyResponse get(Long id) {
        return toResponse(require(id));
    }

    /** Resolves the effective policy for a team: explicit > default. Falls back to a memory default. */
    @Transactional(readOnly = true)
    public MessagingPolicy resolveFor(Team team) {
        if (team != null && team.getMessagingPolicy() != null) return team.getMessagingPolicy();
        return policyRepository.findFirstByDefaultPolicyTrue().orElseGet(MessagingPolicy::new);
    }

    @Transactional
    public MessagingPolicyResponse create(CreatePolicyRequest req) {
        if (policyRepository.findByName(req.getName()).isPresent()) {
            throw new ConflictException("A policy named '" + req.getName() + "' already exists.");
        }
        MessagingPolicy p = MessagingPolicy.builder()
                .name(req.getName())
                .description(req.getDescription())
                .defaultPolicy(Boolean.TRUE.equals(req.getDefaultPolicy()))
                .allowOwnerDelete(boolDefault(req.getAllowOwnerDelete(), true))
                .allowUserDelete(boolDefault(req.getAllowUserDelete(), true))
                .allowUserEdit(boolDefault(req.getAllowUserEdit(), true))
                .allowGifs(boolDefault(req.getAllowGifs(), true))
                .allowStickers(boolDefault(req.getAllowStickers(), true))
                .allowMemes(boolDefault(req.getAllowMemes(), true))
                .readReceiptsEnabled(boolDefault(req.getReadReceiptsEnabled(), true))
                .allowExternalChat(boolDefault(req.getAllowExternalChat(), false))
                .allowFileAttachments(boolDefault(req.getAllowFileAttachments(), true))
                .allowUrlPreviews(boolDefault(req.getAllowUrlPreviews(), true))
                .maxAttachmentMb(intDefault(req.getMaxAttachmentMb(), 25))
                .retentionDays(intDefault(req.getRetentionDays(), 0))
                .chatSupervision(boolDefault(req.getChatSupervision(), false))
                .build();
        if (p.isDefaultPolicy()) clearOtherDefaults(null);
        return toResponse(policyRepository.save(p));
    }

    @Transactional
    public MessagingPolicyResponse update(Long id, CreatePolicyRequest req) {
        MessagingPolicy p = require(id);
        if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getAllowOwnerDelete() != null) p.setAllowOwnerDelete(req.getAllowOwnerDelete());
        if (req.getAllowUserDelete() != null) p.setAllowUserDelete(req.getAllowUserDelete());
        if (req.getAllowUserEdit() != null) p.setAllowUserEdit(req.getAllowUserEdit());
        if (req.getAllowGifs() != null) p.setAllowGifs(req.getAllowGifs());
        if (req.getAllowStickers() != null) p.setAllowStickers(req.getAllowStickers());
        if (req.getAllowMemes() != null) p.setAllowMemes(req.getAllowMemes());
        if (req.getReadReceiptsEnabled() != null) p.setReadReceiptsEnabled(req.getReadReceiptsEnabled());
        if (req.getAllowExternalChat() != null) p.setAllowExternalChat(req.getAllowExternalChat());
        if (req.getAllowFileAttachments() != null) p.setAllowFileAttachments(req.getAllowFileAttachments());
        if (req.getAllowUrlPreviews() != null) p.setAllowUrlPreviews(req.getAllowUrlPreviews());
        if (req.getMaxAttachmentMb() != null) {
            if (req.getMaxAttachmentMb() < 1 || req.getMaxAttachmentMb() > 1024)
                throw new BadRequestException("maxAttachmentMb must be between 1 and 1024");
            p.setMaxAttachmentMb(req.getMaxAttachmentMb());
        }
        if (req.getRetentionDays() != null) {
            if (req.getRetentionDays() < 0) throw new BadRequestException("retentionDays must be >= 0");
            p.setRetentionDays(req.getRetentionDays());
        }
        if (req.getChatSupervision() != null) p.setChatSupervision(req.getChatSupervision());
        if (req.getDefaultPolicy() != null) {
            p.setDefaultPolicy(req.getDefaultPolicy());
            if (p.isDefaultPolicy()) clearOtherDefaults(p.getId());
        }
        return toResponse(policyRepository.save(p));
    }

    @Transactional
    public void delete(Long id) {
        MessagingPolicy p = require(id);
        if (p.isDefaultPolicy()) throw new BadRequestException("Cannot delete the default policy.");
        // Detach from teams first
        teamRepository.findAll().forEach(t -> {
            if (t.getMessagingPolicy() != null && t.getMessagingPolicy().getId().equals(id)) {
                t.setMessagingPolicy(null);
                teamRepository.save(t);
            }
        });
        policyRepository.delete(p);
    }

    private void clearOtherDefaults(Long keepId) {
        policyRepository.findAll().forEach(other -> {
            if (other.isDefaultPolicy() && (keepId == null || !other.getId().equals(keepId))) {
                other.setDefaultPolicy(false);
                policyRepository.save(other);
            }
        });
    }

    private MessagingPolicy require(Long id) {
        return policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MessagingPolicy", "id", id));
    }

    private boolean boolDefault(Boolean v, boolean d) { return v == null ? d : v; }
    private int intDefault(Integer v, int d) { return v == null ? d : v; }

    MessagingPolicyResponse toResponse(MessagingPolicy p) {
        int usedBy = (int) teamRepository.findAll().stream()
                .filter(t -> t.getMessagingPolicy() != null && t.getMessagingPolicy().getId().equals(p.getId()))
                .count();
        return MessagingPolicyResponse.builder()
                .id(p.getId()).name(p.getName()).description(p.getDescription())
                .defaultPolicy(p.isDefaultPolicy())
                .allowOwnerDelete(p.isAllowOwnerDelete())
                .allowUserDelete(p.isAllowUserDelete())
                .allowUserEdit(p.isAllowUserEdit())
                .allowGifs(p.isAllowGifs())
                .allowStickers(p.isAllowStickers())
                .allowMemes(p.isAllowMemes())
                .readReceiptsEnabled(p.isReadReceiptsEnabled())
                .allowExternalChat(p.isAllowExternalChat())
                .allowFileAttachments(p.isAllowFileAttachments())
                .allowUrlPreviews(p.isAllowUrlPreviews())
                .maxAttachmentMb(p.getMaxAttachmentMb())
                .retentionDays(p.getRetentionDays())
                .chatSupervision(p.isChatSupervision())
                .teamsUsingThisPolicy(usedBy)
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
