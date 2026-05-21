package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminMeetingsDto.*;
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

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Phone-number inventory, call queues, auto-attendants and per-user
 * voicemail. Carrier connectors (PSTN/SIP) are pluggable via
 * {@link PhoneNumber#getCarrier()}; this layer is provider-neutral.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCallingService {

    private final PhoneNumberRepository phoneRepository;
    private final CallQueueRepository queueRepository;
    private final AutoAttendantRepository attendantRepository;
    private final VoicemailSettingRepository voicemailRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{6,14}$");
    private static final Set<String> ASSIGNMENT_TYPES =
            Set.of("USER", "CALL_QUEUE", "AUTO_ATTENDANT", "EMERGENCY", "UNASSIGNED");
    private static final Set<String> CARRIERS = Set.of("PSTN", "SIP", "INTERNAL");
    private static final Set<String> ROUTING_METHODS =
            Set.of("ATTENDANT", "SERIAL", "ROUND_ROBIN", "LONGEST_IDLE");
    private static final Set<String> OVERFLOW_ACTIONS =
            Set.of("OVERFLOW_VOICEMAIL", "OVERFLOW_DISCONNECT", "OVERFLOW_REDIRECT");

    /* ── Phone numbers ───────────────────────────────────── */

    @Transactional(readOnly = true)
    public PagedPhoneNumbers listNumbers(String q, String assignmentType,
                                         int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PhoneNumber> res = phoneRepository.adminSearch(
                blank(q),
                blank(assignmentType) == null ? null : assignmentType.toUpperCase(),
                pageable);
        return PagedPhoneNumbers.builder()
                .content(res.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(res.getNumber()).size(res.getSize())
                .totalElements(res.getTotalElements()).totalPages(res.getTotalPages())
                .first(res.isFirst()).last(res.isLast()).build();
    }

    @Transactional
    public PhoneNumberResponse createNumber(CreatePhoneNumberRequest req, String actor) {
        String e164 = req.getE164() == null ? "" : req.getE164().trim();
        if (!E164.matcher(e164).matches()) {
            throw new BadRequestException("e164 must match international format, e.g. +14155550100");
        }
        if (phoneRepository.findByE164(e164).isPresent()) {
            throw new ConflictException("Phone number " + e164 + " already exists.");
        }
        String carrier = req.getCarrier() == null ? "INTERNAL" : req.getCarrier().toUpperCase();
        if (!CARRIERS.contains(carrier)) throw new BadRequestException("Invalid carrier: " + carrier);

        PhoneNumber n = PhoneNumber.builder()
                .e164(e164).label(req.getLabel())
                .callerIdName(req.getCallerIdName())
                .carrier(carrier)
                .emergencyAddress(req.getEmergencyAddress())
                .countryCode(req.getCountryCode() == null ? "+1" : req.getCountryCode())
                .build();
        PhoneNumber saved = phoneRepository.save(n);
        audit(actor, "CREATE_PHONE", saved.getId(), "Added " + e164 + " (" + carrier + ")");
        return toResponse(saved);
    }

    @Transactional
    public PhoneNumberResponse assignNumber(Long id, AssignPhoneNumberRequest req, String actor) {
        PhoneNumber n = requireNumber(id);
        String type = req.getAssignmentType().toUpperCase();
        if (!ASSIGNMENT_TYPES.contains(type)) {
            throw new BadRequestException("Invalid assignmentType. Allowed: " + ASSIGNMENT_TYPES);
        }
        if (!type.equals("UNASSIGNED") && req.getAssignedToId() == null && !type.equals("EMERGENCY")) {
            throw new BadRequestException("assignedToId is required for " + type);
        }
        validateAssignmentTarget(type, req.getAssignedToId());
        n.setAssignmentType(type);
        n.setAssignedToId(type.equals("UNASSIGNED") ? null : req.getAssignedToId());
        PhoneNumber saved = phoneRepository.save(n);
        audit(actor, "ASSIGN_PHONE", saved.getId(),
                "Assigned " + n.getE164() + " → " + type + (req.getAssignedToId() != null ? "#" + req.getAssignedToId() : ""));
        return toResponse(saved);
    }

    @Transactional
    public void deleteNumber(Long id, String actor) {
        PhoneNumber n = requireNumber(id);
        phoneRepository.delete(n);
        audit(actor, "DELETE_PHONE", id, "Removed " + n.getE164());
    }

    private void validateAssignmentTarget(String type, Long targetId) {
        if (targetId == null) return;
        switch (type) {
            case "USER":
                if (userRepository.findById(targetId).isEmpty())
                    throw new ResourceNotFoundException("User", "id", targetId);
                break;
            case "CALL_QUEUE":
                if (queueRepository.findById(targetId).isEmpty())
                    throw new ResourceNotFoundException("CallQueue", "id", targetId);
                break;
            case "AUTO_ATTENDANT":
                if (attendantRepository.findById(targetId).isEmpty())
                    throw new ResourceNotFoundException("AutoAttendant", "id", targetId);
                break;
            default: /* EMERGENCY / UNASSIGNED */
        }
    }

    /* ── Call queues ─────────────────────────────────────── */

    @Transactional(readOnly = true)
    public List<CallQueueResponse> listQueues() {
        return queueRepository.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public CallQueueResponse createQueue(CreateCallQueueRequest req, String actor) {
        if (queueRepository.findByName(req.getName()).isPresent()) {
            throw new ConflictException("Queue '" + req.getName() + "' already exists.");
        }
        CallQueue q = CallQueue.builder()
                .name(req.getName())
                .description(req.getDescription())
                .routingMethod(parseRouting(req.getRoutingMethod(), "ATTENDANT"))
                .greetingLanguage(req.getGreetingLanguage() == null ? "en-US" : req.getGreetingLanguage())
                .maxWaitSeconds(req.getMaxWaitSeconds() == null ? 300 : req.getMaxWaitSeconds())
                .maxSize(req.getMaxSize() == null ? 50 : req.getMaxSize())
                .overflowAction(parseOverflow(req.getOverflowAction(), "OVERFLOW_VOICEMAIL"))
                .overflowTarget(req.getOverflowTarget())
                .active(true)
                .build();
        q.setAgents(resolveAgents(req.getAgentIds()));
        CallQueue saved = queueRepository.save(q);
        audit(actor, "CREATE_CALL_QUEUE", saved.getId(), "Created queue " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public CallQueueResponse updateQueue(Long id, CreateCallQueueRequest req, String actor) {
        CallQueue q = requireQueue(id);
        if (req.getName() != null && !req.getName().isBlank()) q.setName(req.getName());
        if (req.getDescription() != null) q.setDescription(req.getDescription());
        if (req.getRoutingMethod() != null) q.setRoutingMethod(parseRouting(req.getRoutingMethod(), q.getRoutingMethod()));
        if (req.getGreetingLanguage() != null) q.setGreetingLanguage(req.getGreetingLanguage());
        if (req.getMaxWaitSeconds() != null) {
            if (req.getMaxWaitSeconds() < 0) throw new BadRequestException("maxWaitSeconds must be >= 0");
            q.setMaxWaitSeconds(req.getMaxWaitSeconds());
        }
        if (req.getMaxSize() != null) q.setMaxSize(req.getMaxSize());
        if (req.getOverflowAction() != null) q.setOverflowAction(parseOverflow(req.getOverflowAction(), q.getOverflowAction()));
        if (req.getOverflowTarget() != null) q.setOverflowTarget(req.getOverflowTarget());
        if (req.getAgentIds() != null) q.setAgents(resolveAgents(req.getAgentIds()));
        CallQueue saved = queueRepository.save(q);
        audit(actor, "UPDATE_CALL_QUEUE", saved.getId(), "Updated queue " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public void deleteQueue(Long id, String actor) {
        CallQueue q = requireQueue(id);
        // detach any phone numbers pointing here
        phoneRepository.findByAssignmentTypeAndAssignedToId("CALL_QUEUE", id).forEach(n -> {
            n.setAssignmentType("UNASSIGNED");
            n.setAssignedToId(null);
            phoneRepository.save(n);
        });
        queueRepository.delete(q);
        audit(actor, "DELETE_CALL_QUEUE", id, "Deleted queue " + q.getName());
    }

    private Set<User> resolveAgents(List<Long> ids) {
        if (ids == null) return new HashSet<>();
        Set<User> out = new HashSet<>();
        for (Long id : ids) userRepository.findById(id).ifPresent(out::add);
        return out;
    }

    /* ── Auto attendants ─────────────────────────────────── */

    @Transactional(readOnly = true)
    public List<AutoAttendantResponse> listAttendants() {
        return attendantRepository.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public AutoAttendantResponse createAttendant(CreateAutoAttendantRequest req, String actor) {
        if (attendantRepository.findByName(req.getName()).isPresent()) {
            throw new ConflictException("Attendant '" + req.getName() + "' already exists.");
        }
        AutoAttendant a = AutoAttendant.builder()
                .name(req.getName()).description(req.getDescription())
                .language(req.getLanguage() == null ? "en-US" : req.getLanguage())
                .timeZone(req.getTimeZone() == null ? "UTC" : req.getTimeZone())
                .greetingText(req.getGreetingText()).greetingAudioUrl(req.getGreetingAudioUrl())
                .menuJson(req.getMenuJson()).businessHoursJson(req.getBusinessHoursJson())
                .active(true)
                .build();
        AutoAttendant saved = attendantRepository.save(a);
        audit(actor, "CREATE_AUTO_ATTENDANT", saved.getId(), "Created attendant " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public AutoAttendantResponse updateAttendant(Long id, CreateAutoAttendantRequest req, String actor) {
        AutoAttendant a = requireAttendant(id);
        if (req.getName() != null && !req.getName().isBlank()) a.setName(req.getName());
        if (req.getDescription() != null) a.setDescription(req.getDescription());
        if (req.getLanguage() != null) a.setLanguage(req.getLanguage());
        if (req.getTimeZone() != null) a.setTimeZone(req.getTimeZone());
        if (req.getGreetingText() != null) a.setGreetingText(req.getGreetingText());
        if (req.getGreetingAudioUrl() != null) a.setGreetingAudioUrl(req.getGreetingAudioUrl());
        if (req.getMenuJson() != null) a.setMenuJson(req.getMenuJson());
        if (req.getBusinessHoursJson() != null) a.setBusinessHoursJson(req.getBusinessHoursJson());
        AutoAttendant saved = attendantRepository.save(a);
        audit(actor, "UPDATE_AUTO_ATTENDANT", saved.getId(), "Updated attendant " + saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public void deleteAttendant(Long id, String actor) {
        AutoAttendant a = requireAttendant(id);
        phoneRepository.findByAssignmentTypeAndAssignedToId("AUTO_ATTENDANT", id).forEach(n -> {
            n.setAssignmentType("UNASSIGNED");
            n.setAssignedToId(null);
            phoneRepository.save(n);
        });
        attendantRepository.delete(a);
        audit(actor, "DELETE_AUTO_ATTENDANT", id, "Deleted attendant " + a.getName());
    }

    /* ── Voicemail (per user) ────────────────────────────── */

    @Transactional
    public VoicemailResponse getOrCreateVoicemail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        VoicemailSetting s = voicemailRepository.findByUserId(userId)
                .orElseGet(() -> voicemailRepository.save(
                        VoicemailSetting.builder().user(user).build()));
        return toResponse(s);
    }

    @Transactional
    public VoicemailResponse updateVoicemail(Long userId, UpdateVoicemailRequest req, String actor) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        VoicemailSetting s = voicemailRepository.findByUserId(userId)
                .orElseGet(() -> VoicemailSetting.builder().user(user).build());
        if (req.getEnabled() != null) s.setEnabled(req.getEnabled());
        if (req.getGreetingText() != null) s.setGreetingText(req.getGreetingText());
        if (req.getTranscriptionEnabled() != null) s.setTranscriptionEnabled(req.getTranscriptionEnabled());
        if (req.getEmailNotification() != null) s.setEmailNotification(req.getEmailNotification());
        if (req.getMaxDurationSeconds() != null) {
            if (req.getMaxDurationSeconds() < 10) throw new BadRequestException("maxDurationSeconds must be >= 10");
            s.setMaxDurationSeconds(req.getMaxDurationSeconds());
        }
        if (req.getAutoDeleteDays() != null) s.setAutoDeleteDays(req.getAutoDeleteDays());
        s = voicemailRepository.save(s);
        audit(actor, "UPDATE_VOICEMAIL", userId, "Updated voicemail for " + user.getUsername());
        return toResponse(s);
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private PhoneNumber requireNumber(Long id) {
        return phoneRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PhoneNumber", "id", id));
    }
    private CallQueue requireQueue(Long id) {
        return queueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CallQueue", "id", id));
    }
    private AutoAttendant requireAttendant(Long id) {
        return attendantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AutoAttendant", "id", id));
    }
    private String blank(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private String parseRouting(String s, String fallback) {
        if (s == null) return fallback;
        String u = s.trim().toUpperCase();
        if (!ROUTING_METHODS.contains(u))
            throw new BadRequestException("Invalid routingMethod. Allowed: " + ROUTING_METHODS);
        return u;
    }

    private String parseOverflow(String s, String fallback) {
        if (s == null) return fallback;
        String u = s.trim().toUpperCase();
        if (!OVERFLOW_ACTIONS.contains(u))
            throw new BadRequestException("Invalid overflowAction. Allowed: " + OVERFLOW_ACTIONS);
        return u;
    }

    private void audit(String actor, String action, Long entityId, String details) {
        try {
            User u = actor == null ? null : userRepository.findByUsername(actor).orElse(null);
            auditLogRepository.save(AuditLog.builder()
                    .user(u).action(action).entityType("Calling").entityId(entityId).details(details).build());
        } catch (Exception e) { log.warn("audit failed", e); }
    }

    /* ── Mappers ─────────────────────────────────────────── */

    PhoneNumberResponse toResponse(PhoneNumber n) {
        String label = null;
        if (n.getAssignedToId() != null) {
            switch (n.getAssignmentType()) {
                case "USER":
                    label = userRepository.findById(n.getAssignedToId())
                            .map(u -> u.getDisplayName() + " (@" + u.getUsername() + ")").orElse(null);
                    break;
                case "CALL_QUEUE":
                    label = queueRepository.findById(n.getAssignedToId()).map(CallQueue::getName).orElse(null);
                    break;
                case "AUTO_ATTENDANT":
                    label = attendantRepository.findById(n.getAssignedToId()).map(AutoAttendant::getName).orElse(null);
                    break;
                default:
            }
        }
        return PhoneNumberResponse.builder()
                .id(n.getId()).e164(n.getE164()).label(n.getLabel())
                .assignmentType(n.getAssignmentType()).assignedToId(n.getAssignedToId()).assignedToLabel(label)
                .callerIdName(n.getCallerIdName()).carrier(n.getCarrier())
                .emergencyAddress(n.getEmergencyAddress()).countryCode(n.getCountryCode())
                .createdAt(n.getCreatedAt()).build();
    }

    CallQueueResponse toResponse(CallQueue q) {
        List<AgentSummary> agents = q.getAgents() == null ? List.of()
                : q.getAgents().stream().map(u -> AgentSummary.builder()
                .userId(u.getId()).username(u.getUsername()).displayName(u.getDisplayName()).build())
                .collect(Collectors.toList());
        return CallQueueResponse.builder()
                .id(q.getId()).name(q.getName()).description(q.getDescription())
                .routingMethod(q.getRoutingMethod()).greetingLanguage(q.getGreetingLanguage())
                .maxWaitSeconds(q.getMaxWaitSeconds()).maxSize(q.getMaxSize())
                .overflowAction(q.getOverflowAction()).overflowTarget(q.getOverflowTarget())
                .active(q.isActive()).agentCount(agents.size()).agents(agents)
                .createdAt(q.getCreatedAt()).build();
    }

    AutoAttendantResponse toResponse(AutoAttendant a) {
        return AutoAttendantResponse.builder()
                .id(a.getId()).name(a.getName()).description(a.getDescription())
                .language(a.getLanguage()).timeZone(a.getTimeZone())
                .greetingText(a.getGreetingText()).greetingAudioUrl(a.getGreetingAudioUrl())
                .menuJson(a.getMenuJson()).businessHoursJson(a.getBusinessHoursJson())
                .active(a.isActive()).createdAt(a.getCreatedAt()).build();
    }

    VoicemailResponse toResponse(VoicemailSetting s) {
        return VoicemailResponse.builder()
                .id(s.getId()).userId(s.getUser().getId()).username(s.getUser().getUsername())
                .enabled(s.isEnabled()).greetingText(s.getGreetingText())
                .transcriptionEnabled(s.isTranscriptionEnabled())
                .emailNotification(s.isEmailNotification())
                .maxDurationSeconds(s.getMaxDurationSeconds())
                .autoDeleteDays(s.getAutoDeleteDays()).build();
    }
}
