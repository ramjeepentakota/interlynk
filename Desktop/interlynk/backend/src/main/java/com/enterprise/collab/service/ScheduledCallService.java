package com.enterprise.collab.service;

import com.enterprise.collab.dto.CallDto;
import com.enterprise.collab.dto.ScheduledCallDto;
import com.enterprise.collab.entity.CallRoom;
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

import java.security.SecureRandom;
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
    private final CallService callService;

    // Self-reference so the scheduler thread invokes the per-row methods through
    // the Spring proxy — otherwise @Transactional is bypassed and lazy invitee
    // access throws outside an open session.
    @Autowired
    @Lazy
    private ScheduledCallService self;

    private static final long MIN_LEAD_SECONDS = 60;
    private static final long REMINDER_LEAD_MINUTES = 5;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("MMM d, h:mm a");

    /** Alphabet for meeting codes: lowercase a-z + 2-9 minus look-alikes (0/o/1/l/i).
     *  Keeps codes phone-friendly and hard to mistype. */
    private static final char[] CODE_ALPHABET =
            "abcdefghjkmnpqrstuvwxyz23456789".toCharArray();
    private static final SecureRandom CODE_RNG = new SecureRandom();

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
                .meetingCode(generateUniqueMeetingCode())
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

    /**
     * Join (or launch) a scheduled call's live room. THIS is what fixes the bug
     * where every participant landed in a separate room and sat at "waiting for
     * others to join": the FIRST caller atomically creates ONE shared CallRoom
     * and stores its id on the ScheduledCall; everyone after reuses that same
     * callRoomId, so the SFU groups them into the same media session.
     *
     * Idempotent and safe to call by the host or any invitee, for a PENDING or
     * ACTIVE call. The per-id lock prevents two simultaneous joiners racing to
     * create two rooms on a single backend instance.
     */
    public ScheduledCallDto.Response joinLive(Long id, String username) {
        // Serialize the whole read-modify-write+commit per scheduled-call id so
        // concurrent joiners converge on ONE room. The lock is held in this
        // NON-transactional outer method and wraps the transactional inner call
        // via the `self` proxy — so a second joiner's transaction only starts
        // AFTER the first has fully committed and therefore reads the room id
        // the first one created (avoids InnoDB repeatable-read seeing null).
        // String#intern gives a stable JVM-wide monitor for the id.
        synchronized (("scheduled-call-join-" + id).intern()) {
            return self.joinLiveTx(id, username);
        }
    }

    @Transactional
    public ScheduledCallDto.Response joinLiveTx(Long id, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        ScheduledCall sc = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledCall", "id", id));

        // Anyone who joins by code is treated as an invitee on the fly. The
        // host-or-invitee gate remains for joins made through the UI list
        // (which always carries a backend-authenticated user).
        boolean isHost = sc.getCreatedBy().getId().equals(user.getId());
        boolean isInvitee = sc.getInvitees().stream().anyMatch(u -> u.getId().equals(user.getId()));
        if (!isHost && !isInvitee && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("Only the host or an invitee can join this call");
        }
        if (sc.getStatus() == ScheduledCall.Status.COMPLETED
                || sc.getStatus() == ScheduledCall.Status.CANCELLED) {
            throw new BadRequestException("This call has ended");
        }

        // Create the single shared room on first join, owned by the host so its
        // lifetime tracks the meeting rather than whoever joined first.
        if (sc.getCallRoomId() == null) {
            CallDto.CallRoomResponse room = callService.createCallRoom(
                    sc.getTitle(), CallRoom.CallRoomType.GROUP, sc.getCreatedBy().getId());
            sc.setCallRoomId(room.getId());
            log.info("Scheduled call {} opened shared room {}", sc.getId(), room.getId());
        }
        // Backfill a meeting code for rows scheduled before the feature shipped,
        // so the same shareable-link UX works for existing meetings without a
        // separate migration step.
        if (sc.getMeetingCode() == null || sc.getMeetingCode().isBlank()) {
            sc.setMeetingCode(generateUniqueMeetingCode());
        }
        // A join always implies the call is live now (covers early "warm-up"
        // joins on a PENDING call) so other invitees see it as joinable.
        if (sc.getStatus() == ScheduledCall.Status.PENDING) {
            sc.setStatus(ScheduledCall.Status.ACTIVE);
        }
        sc = repository.save(sc);

        // Register the caller as a participant so the SFU token endpoint
        // authorizes them for this room.
        callService.addParticipant(sc.getCallRoomId(), user.getId());

        return toResponse(sc);
    }

    /**
     * Look up a scheduled call by its shareable meeting code. Public-by-code
     * means: anyone signed in who knows the code can see the call's title and
     * (when joining) be admitted to the room. This is the same trust model as
     * a Google Meet / Zoom join link.
     */
    @Transactional(readOnly = true)
    public ScheduledCallDto.Response getByCode(String code) {
        ScheduledCall sc = requireByCode(code);
        return toResponse(sc);
    }

    /**
     * Join a scheduled call by its meeting code. Anyone signed in who has the
     * code may join — they are added as an invitee if they were not on the
     * original list, so the host-or-invitee check in {@link #joinLiveTx}
     * subsequently passes.
     */
    public ScheduledCallDto.Response joinLiveByCode(String code, String username) {
        ScheduledCall sc = requireByCode(code);
        // Add the caller as an invitee on the fly if they are not yet one.
        // Done in a tiny dedicated transaction so the join lock in joinLive()
        // serialises room creation regardless of whether the caller was on the
        // original list.
        self.addInviteeIfMissing(sc.getId(), username);
        return joinLive(sc.getId(), username);
    }

    @Transactional
    public void addInviteeIfMissing(Long scheduledCallId, String username) {
        ScheduledCall sc = repository.findById(scheduledCallId).orElse(null);
        if (sc == null) return;
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return;
        if (sc.getCreatedBy().getId().equals(user.getId())) return;
        boolean already = sc.getInvitees().stream().anyMatch(u -> u.getId().equals(user.getId()));
        if (already) return;
        sc.getInvitees().add(user);
        repository.save(sc);
        log.info("User {} added as on-the-fly invitee to scheduled call {} via meeting code",
                username, scheduledCallId);
    }

    private ScheduledCall requireByCode(String code) {
        if (code == null) throw new BadRequestException("meeting code is required");
        String normalised = code.trim().toLowerCase();
        if (normalised.isEmpty()) throw new BadRequestException("meeting code is required");
        return repository.findByMeetingCode(normalised)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledCall", "meetingCode", normalised));
    }

    /** Build a fresh, collision-free meeting code. Format: "xxx-xxxx-xxx" — 10
     *  characters from a 31-symbol alphabet (~10^15 codes), which is well
     *  beyond what's practical to brute-force given the lookup is authenticated. */
    private String generateUniqueMeetingCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = randomMeetingCode();
            if (repository.findByMeetingCode(code).isEmpty()) {
                return code;
            }
        }
        // Astronomically unlikely; surface as a 500 so we know if it ever fires.
        throw new IllegalStateException("Could not generate a unique meeting code");
    }

    private static String randomMeetingCode() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 10; i++) {
            if (i == 3 || i == 7) sb.append('-');
            sb.append(CODE_ALPHABET[CODE_RNG.nextInt(CODE_ALPHABET.length)]);
        }
        return sb.toString();
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

        String meetingCode = sc.getMeetingCode();
        String meetingLink = meetingCode != null ? "/join/" + meetingCode : null;

        return ScheduledCallDto.Response.builder()
                .id(sc.getId())
                .title(sc.getTitle())
                .scheduledAt(sc.getScheduledAt())
                .durationMinutes(sc.getDurationMinutes())
                .callType(sc.getCallType())
                .status(sc.getStatus().name())
                .callRoomId(sc.getCallRoomId())
                .meetingCode(meetingCode)
                .meetingLink(meetingLink)
                .createdByUserId(sc.getCreatedBy().getId())
                .createdByUsername(sc.getCreatedBy().getUsername())
                .createdByDisplayName(displayName(sc.getCreatedBy()))
                .invitees(invitees)
                .createdAt(sc.getCreatedAt())
                .build();
    }
}
