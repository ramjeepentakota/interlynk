package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminMeetingsDto.*;
import com.enterprise.collab.entity.MeetingPolicy;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.MeetingPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminMeetingPolicyService {

    private final MeetingPolicyRepository policyRepository;
    private static final Set<String> LOBBY_MODES =
            Set.of("EVERYONE", "ORG_ONLY", "INVITED_ONLY");

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedDefault() {
        try {
            if (policyRepository.findFirstByDefaultPolicyTrue().isPresent()) return;
            try {
                MeetingPolicy p = MeetingPolicy.builder()
                        .name("Global Meetings Default")
                        .description("Org-wide defaults for meetings, webinars, and live events.")
                        .defaultPolicy(true)
                        .allowRecording(true).autoRecord(false)
                        .allowTranscription(true).allowAiRecap(true)
                        .lobbyMode("ORG_ONLY").allowAnonymousJoin(false)
                        .allowScreenShare(true).allowWhiteboard(true)
                        .allowBreakoutRooms(true).allowMeetingChat(true)
                        .allowReactions(true).allowPolls(true)
                        .attendanceReports(true)
                        .allowWebinars(true).allowLiveEvents(false)
                        .maxAttendees(1000)
                        .build();
                policyRepository.save(p);
            } catch (Exception e) {
                log.warn("Unable to seed default meeting policy: {}", e.getMessage());
            }
        } catch (Exception e) {
            // Table may not yet exist on a fresh DB — seeding is best-effort.
            log.warn("Skipping meeting-policy seed (will retry on next start): {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<MeetingPolicyResponse> list() {
        return policyRepository.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MeetingPolicyResponse get(Long id) { return toResponse(require(id)); }

    @Transactional
    public MeetingPolicyResponse create(CreateMeetingPolicyRequest req) {
        if (policyRepository.findByName(req.getName()).isPresent()) {
            throw new ConflictException("Policy '" + req.getName() + "' already exists.");
        }
        MeetingPolicy p = MeetingPolicy.builder()
                .name(req.getName())
                .description(req.getDescription())
                .defaultPolicy(Boolean.TRUE.equals(req.getDefaultPolicy()))
                .allowRecording(b(req.getAllowRecording(), true))
                .autoRecord(b(req.getAutoRecord(), false))
                .allowTranscription(b(req.getAllowTranscription(), true))
                .allowAiRecap(b(req.getAllowAiRecap(), true))
                .lobbyMode(parseLobby(req.getLobbyMode(), "ORG_ONLY"))
                .allowAnonymousJoin(b(req.getAllowAnonymousJoin(), false))
                .allowScreenShare(b(req.getAllowScreenShare(), true))
                .allowWhiteboard(b(req.getAllowWhiteboard(), true))
                .allowBreakoutRooms(b(req.getAllowBreakoutRooms(), true))
                .allowMeetingChat(b(req.getAllowMeetingChat(), true))
                .allowReactions(b(req.getAllowReactions(), true))
                .allowPolls(b(req.getAllowPolls(), true))
                .attendanceReports(b(req.getAttendanceReports(), true))
                .allowWebinars(b(req.getAllowWebinars(), true))
                .allowLiveEvents(b(req.getAllowLiveEvents(), false))
                .maxAttendees(i(req.getMaxAttendees(), 1000))
                .build();
        if (p.isDefaultPolicy()) clearOtherDefaults(null);
        return toResponse(policyRepository.save(p));
    }

    @Transactional
    public MeetingPolicyResponse update(Long id, CreateMeetingPolicyRequest req) {
        MeetingPolicy p = require(id);
        if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getAllowRecording() != null) p.setAllowRecording(req.getAllowRecording());
        if (req.getAutoRecord() != null) p.setAutoRecord(req.getAutoRecord());
        if (req.getAllowTranscription() != null) p.setAllowTranscription(req.getAllowTranscription());
        if (req.getAllowAiRecap() != null) p.setAllowAiRecap(req.getAllowAiRecap());
        if (req.getLobbyMode() != null) p.setLobbyMode(parseLobby(req.getLobbyMode(), p.getLobbyMode()));
        if (req.getAllowAnonymousJoin() != null) p.setAllowAnonymousJoin(req.getAllowAnonymousJoin());
        if (req.getAllowScreenShare() != null) p.setAllowScreenShare(req.getAllowScreenShare());
        if (req.getAllowWhiteboard() != null) p.setAllowWhiteboard(req.getAllowWhiteboard());
        if (req.getAllowBreakoutRooms() != null) p.setAllowBreakoutRooms(req.getAllowBreakoutRooms());
        if (req.getAllowMeetingChat() != null) p.setAllowMeetingChat(req.getAllowMeetingChat());
        if (req.getAllowReactions() != null) p.setAllowReactions(req.getAllowReactions());
        if (req.getAllowPolls() != null) p.setAllowPolls(req.getAllowPolls());
        if (req.getAttendanceReports() != null) p.setAttendanceReports(req.getAttendanceReports());
        if (req.getAllowWebinars() != null) p.setAllowWebinars(req.getAllowWebinars());
        if (req.getAllowLiveEvents() != null) p.setAllowLiveEvents(req.getAllowLiveEvents());
        if (req.getMaxAttendees() != null) {
            if (req.getMaxAttendees() < 1) throw new BadRequestException("maxAttendees must be >= 1");
            p.setMaxAttendees(req.getMaxAttendees());
        }
        if (req.getDefaultPolicy() != null) {
            p.setDefaultPolicy(req.getDefaultPolicy());
            if (p.isDefaultPolicy()) clearOtherDefaults(p.getId());
        }
        return toResponse(policyRepository.save(p));
    }

    @Transactional
    public void delete(Long id) {
        MeetingPolicy p = require(id);
        if (p.isDefaultPolicy()) throw new BadRequestException("Cannot delete the default policy.");
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

    private MeetingPolicy require(Long id) {
        return policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MeetingPolicy", "id", id));
    }

    private boolean b(Boolean v, boolean d) { return v == null ? d : v; }
    private int i(Integer v, int d) { return v == null ? d : v; }

    private String parseLobby(String s, String fallback) {
        if (s == null) return fallback;
        String u = s.trim().toUpperCase();
        if (!LOBBY_MODES.contains(u)) {
            throw new BadRequestException("Invalid lobby mode. Allowed: " + Arrays.toString(LOBBY_MODES.toArray()));
        }
        return u;
    }

    private MeetingPolicyResponse toResponse(MeetingPolicy p) {
        return MeetingPolicyResponse.builder()
                .id(p.getId()).name(p.getName()).description(p.getDescription())
                .defaultPolicy(p.isDefaultPolicy())
                .allowRecording(p.isAllowRecording()).autoRecord(p.isAutoRecord())
                .allowTranscription(p.isAllowTranscription()).allowAiRecap(p.isAllowAiRecap())
                .lobbyMode(p.getLobbyMode()).allowAnonymousJoin(p.isAllowAnonymousJoin())
                .allowScreenShare(p.isAllowScreenShare()).allowWhiteboard(p.isAllowWhiteboard())
                .allowBreakoutRooms(p.isAllowBreakoutRooms()).allowMeetingChat(p.isAllowMeetingChat())
                .allowReactions(p.isAllowReactions()).allowPolls(p.isAllowPolls())
                .attendanceReports(p.isAttendanceReports())
                .allowWebinars(p.isAllowWebinars()).allowLiveEvents(p.isAllowLiveEvents())
                .maxAttendees(p.getMaxAttendees())
                .createdAt(p.getCreatedAt()).updatedAt(p.getUpdatedAt())
                .build();
    }
}
