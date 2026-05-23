package com.enterprise.collab.service;

import com.enterprise.collab.dto.ScheduledCallDto;
import com.enterprise.collab.entity.ScheduledCall;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ForbiddenException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.ScheduledCallRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Create, list, cancel and auto-launch scheduled calls. A poll tick runs every
 * 30s: it sends "starting soon" reminders for calls a few minutes out, then
 * activates calls whose time has come by spinning up a real CallRoom and
 * notifying the host + invitees. Polling (not in-memory timers) so the
 * schedule survives a backend restart — same rationale as ScheduledMessage.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduledCallService {

    private final ScheduledCallRepository repository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // Self-reference so the scheduler thread invokes the per-row methods through
    // the Spring proxy — otherwise @Transactional is bypassed and lazy invitee
    // access throws outside an open session.
    @Autowired
    @Lazy
    private ScheduledCallService self;

    private static final long MIN_LEAD_SECONDS = 60;
    private static final long REMINDER_LEAD_MINUTES = 5;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("MMM d, h:mm a");

    // ============ Commands ============

    @Transactional
    public ScheduledCallDto.Response schedule(ScheduledCallDto.CreateRequest req, String username) {
        if (req.getTitle() == null || req.getTitle().isBlank()) {
            throw new BadRequestException("title is required");
        }
        if (req.getScheduledAt() == null
                || req.getScheduledAt().isBefore(LocalDateTime.now().plusSeconds(MIN_LEAD_SECONDS))) {
            throw new BadRequestException("scheduledAt must be at least 1 minute in the future");
        }

        User creator = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        ScheduledCall sc = ScheduledCall.builder()
                .title(req.getTitle().trim())
                .scheduledAt(req.getScheduledAt())
                .durationMinutes(req.getDurationMinutes() != null && req.getDurationMinutes() > 0
                        ? req.getDurationMinutes() : 30)
                .callType(normalizeCallType(req.getCallType()))
                .createdBy(creator)
                .invitees(resolveInvitees(req.getInviteeIds(), creator.getId()))
                .status(ScheduledCall.Status.PENDING)
                .build();

        sc = repository.save(sc);
        notifyInvited(sc);
        log.info("Scheduled call {} '{}' by {} for {} ({} invitees)",
                sc.getId(), sc.getTitle(), username, sc.getScheduledAt(), sc.getInvitees().size());
        return toResponse(sc);
    }

    @Transactional
    public ScheduledCallDto.Response update(Long id, ScheduledCallDto.UpdateRequest req, String username) {
        ScheduledCall sc = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledCall", "id", id));
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        assertCanManage(sc, user);
        if (sc.getStatus() != ScheduledCall.Status.PENDING) {
            throw new BadRequestException("Only PENDING calls can be edited");
        }

        if (req.getTitle() != null && !req.getTitle().isBlank()) {
            sc.setTitle(req.getTitle().trim());
        }
        if (req.getScheduledAt() != null) {
            if (req.getScheduledAt().isBefore(LocalDateTime.now().plusSeconds(MIN_LEAD_SECONDS))) {
                throw new BadRequestException("scheduledAt must be at least 1 minute in the future");
            }
            sc.setScheduledAt(req.getScheduledAt());
            sc.setReminderSentAt(null); // re-arm the reminder for the new time
        }
        if (req.getDurationMinutes() != null && req.getDurationMinutes() > 0) {
            sc.setDurationMinutes(req.getDurationMinutes());
        }
        if (req.getCallType() != null) {
            sc.setCallType(normalizeCallType(req.getCallType()));
        }
        if (req.getInviteeIds() != null) {
            sc.setInvitees(resolveInvitees(req.getInviteeIds(), sc.getCreatedBy().getId()));
        }
        return toResponse(repository.save(sc));
    }

    @Transactional
    public void cancel(Long id, String username) {
        ScheduledCall sc = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledCall", "id", id));
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        assertCanManage(sc, user);
        if (sc.getStatus() != ScheduledCall.Status.PENDING) {
            throw new BadRequestException("Only PENDING calls can be cancelled");
        }
        sc.setStatus(ScheduledCall.Status.CANCELLED);
        repository.save(sc);
        notifyCancelled(sc);
        log.info("Scheduled call {} cancelled by {}", id, username);
    }

    // ============ Queries ============

    @Transactional(readOnly = true)
    public List<ScheduledCallDto.Response> listUpcomingForUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        return repository.findUpcomingForUser(user.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ScheduledCallDto.Response getOne(Long id, String username) {
        ScheduledCall sc = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledCall", "id", id));
        return toResponse(sc);
    }

    // ============ Poller ============

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void tick() {
        LocalDateTime now = LocalDateTime.now();

        try {
            for (ScheduledCall sc : repository.findReminderDue(now, now.plusMinutes(REMINDER_LEAD_MINUTES))) {
                self.sendReminder(sc.getId());
            }
        } catch (Exception e) {
            log.warn("scheduled-call reminder poll failed: {}", e.getMessage());
        }

        try {
            for (ScheduledCall sc : repository.findDue(now)) {
                self.activateOne(sc.getId());
            }
        } catch (Exception e) {
            log.warn("scheduled-call activation poll failed: {}", e.getMessage());
        }

        // Retire ACTIVE calls that have run past their planned end so they drop
        // off everyone's upcoming list.
        try {
            for (ScheduledCall sc : repository.findByStatus(ScheduledCall.Status.ACTIVE)) {
                int mins = sc.getDurationMinutes() != null ? sc.getDurationMinutes() : 30;
                if (sc.getScheduledAt().plusMinutes(mins).isBefore(now)) {
                    self.complete(sc.getId());
                }
            }
        } catch (Exception e) {
            log.warn("scheduled-call completion poll failed: {}", e.getMessage());
        }
    }

    @Transactional
    public void sendReminder(Long id) {
        ScheduledCall sc = repository.findById(id).orElse(null);
        if (sc == null || sc.getStatus() != ScheduledCall.Status.PENDING || sc.getReminderSentAt() != null) {
            return;
        }
        String when = sc.getScheduledAt().format(TIME_FMT);
        for (User u : recipients(sc)) {
            notificationService.createNotification(
                    u.getId(),
                    "CALL_REMINDER",
                    "Call starting soon: " + sc.getTitle(),
                    "Your scheduled call starts at " + when + ".",
                    "/scheduled-calls/" + sc.getId());
        }
        sc.setReminderSentAt(LocalDateTime.now());
        repository.save(sc);
    }

    @Transactional
    public void activateOne(Long id) {
        ScheduledCall sc = repository.findById(id).orElse(null);
        if (sc == null || sc.getStatus() != ScheduledCall.Status.PENDING) return;
        // Don't pre-create a CallRoom here: the existing 1:1 WebRTC flow needs the
        // host's CallPanel mounted to answer with an offer, so a room created by a
        // background thread (with nobody present) would just orphan. Instead flip
        // to ACTIVE and prompt everyone; the host presses Start, which rings the
        // invitee through the normal direct-call path.
        sc.setStatus(ScheduledCall.Status.ACTIVE);
        repository.save(sc);
        notifyStarting(sc);
        log.info("Scheduled call {} is now active (awaiting host start)", sc.getId());
    }

    @Transactional
    public void complete(Long id) {
        ScheduledCall sc = repository.findById(id).orElse(null);
        if (sc == null || sc.getStatus() != ScheduledCall.Status.ACTIVE) return;
        sc.setStatus(ScheduledCall.Status.COMPLETED);
        repository.save(sc);
    }

    // ============ Notifications ============

    private void notifyInvited(ScheduledCall sc) {
        String when = sc.getScheduledAt().format(TIME_FMT);
        String host = displayName(sc.getCreatedBy());
        for (User u : sc.getInvitees()) {
            notificationService.createNotification(
                    u.getId(),
                    "CALL_INVITE",
                    "Call invitation: " + sc.getTitle(),
                    host + " invited you to a " + sc.getCallType() + " call on " + when + ".",
                    "/scheduled-calls/" + sc.getId());
        }
    }

    private void notifyCancelled(ScheduledCall sc) {
        for (User u : sc.getInvitees()) {
            notificationService.createNotification(
                    u.getId(),
                    "CALL_CANCELLED",
                    "Call cancelled: " + sc.getTitle(),
                    displayName(sc.getCreatedBy()) + " cancelled the scheduled call.",
                    "/scheduled-calls/" + sc.getId());
        }
    }

    private void notifyStarting(ScheduledCall sc) {
        String host = displayName(sc.getCreatedBy());
        // Host prompt — their UI surfaces a "Start" action that rings the invitees.
        notificationService.createNotification(
                sc.getCreatedBy().getId(),
                "CALL_STARTING",
                "Time to start: " + sc.getTitle(),
                "Your scheduled call is due. Open it to start the call.",
                "/scheduled-calls/" + sc.getId());
        // Invitees — heads-up that the host is about to ring them.
        for (User u : sc.getInvitees()) {
            notificationService.createNotification(
                    u.getId(),
                    "CALL_STARTING",
                    "Call starting: " + sc.getTitle(),
                    host + " is starting the scheduled call. You'll be rung shortly.",
                    "/scheduled-calls/" + sc.getId());
        }
    }

    // ============ Helpers ============

    private Set<User> resolveInvitees(List<Long> inviteeIds, Long creatorId) {
        Set<User> invitees = new HashSet<>();
        if (inviteeIds == null) return invitees;
        for (Long uid : inviteeIds) {
            if (uid == null || uid.equals(creatorId)) continue; // never invite the host to their own call
            userRepository.findById(uid).ifPresent(invitees::add);
        }
        return invitees;
    }

    private List<User> recipients(ScheduledCall sc) {
        List<User> all = new ArrayList<>(sc.getInvitees());
        all.add(sc.getCreatedBy());
        return all;
    }

    private void assertCanManage(ScheduledCall sc, User user) {
        if (!sc.getCreatedBy().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("Only the host or an admin can manage this scheduled call");
        }
    }

    private String normalizeCallType(String raw) {
        return "voice".equalsIgnoreCase(raw) ? "voice" : "video";
    }

    private String displayName(User u) {
        return u.getDisplayName() != null && !u.getDisplayName().isBlank()
                ? u.getDisplayName() : u.getUsername();
    }

    private ScheduledCallDto.Response toResponse(ScheduledCall sc) {
        List<ScheduledCallDto.InviteeResponse> invitees = sc.getInvitees().stream()
                .map(u -> ScheduledCallDto.InviteeResponse.builder()
                        .userId(u.getId())
                        .username(u.getUsername())
                        .displayName(u.getDisplayName())
                        .avatarUrl(u.getAvatarUrl())
                        .build())
                .collect(Collectors.toList());

        return ScheduledCallDto.Response.builder()
                .id(sc.getId())
                .title(sc.getTitle())
                .scheduledAt(sc.getScheduledAt())
                .durationMinutes(sc.getDurationMinutes())
                .callType(sc.getCallType())
                .status(sc.getStatus().name())
                .callRoomId(sc.getCallRoomId())
                .createdByUserId(sc.getCreatedBy().getId())
                .createdByUsername(sc.getCreatedBy().getUsername())
                .createdByDisplayName(displayName(sc.getCreatedBy()))
                .invitees(invitees)
                .createdAt(sc.getCreatedAt())
                .build();
    }
}
