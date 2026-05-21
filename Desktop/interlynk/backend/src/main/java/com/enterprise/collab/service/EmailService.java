package com.enterprise.collab.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Outbound transactional email. Enabled only when {@code app.email.enabled=true}
 * and {@code spring.mail.host} is set; otherwise calls are logged and dropped
 * (no-op) so dev / CI environments don't need an SMTP server.
 *
 * All sends are @Async — the caller never blocks on the SMTP round-trip.
 *
 * Add wiring (later): bring in a templating engine (Thymeleaf or FreeMarker)
 * for HTML bodies. For now we ship plaintext because notification copy in this
 * codebase is short and template choice is a per-org decision.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.email.enabled:false}")
    private boolean enabled;

    @Value("${app.email.from:noreply@interlynk.local}")
    private String from;

    @Value("${app.email.subject-prefix:[Interlynk] }")
    private String subjectPrefix;

    @Async
    public void send(String to, String subject, String body) {
        if (!enabled || mailSender == null || to == null || to.isBlank()) {
            log.debug("email send skipped (enabled={}, sender={}, to={}): {}",
                    enabled, mailSender != null, to, subject);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subjectPrefix + subject);
            m.setText(body);
            mailSender.send(m);
            log.info("email sent to={} subject={}", to, subject);
        } catch (Exception e) {
            // Never throw — caller is async and we don't want to crash retry loops.
            log.warn("email send failed to={} subject={}: {}", to, subject, e.getMessage());
        }
    }

    public boolean isEnabled() {
        return enabled && mailSender != null;
    }

    // ─── Convenience helpers for common flows ──────────────────────────────

    public void sendPasswordResetLink(String to, String displayName, String resetUrl) {
        String body = "Hi " + (displayName != null ? displayName : "there") + ",\n\n"
                + "We received a request to reset your Interlynk password. "
                + "Click the link below within 30 minutes to set a new one:\n\n"
                + resetUrl + "\n\n"
                + "If you didn't request this, you can safely ignore this email.\n";
        send(to, "Reset your password", body);
    }

    public void sendTeamInvite(String to, String inviterName, String teamName, String acceptUrl) {
        String body = inviterName + " has invited you to join the team \"" + teamName + "\" on Interlynk.\n\n"
                + "Accept here: " + acceptUrl + "\n";
        send(to, inviterName + " invited you to " + teamName, body);
    }

    public void sendMentionDigest(String to, String displayName, int mentionCount, String inboxUrl) {
        String body = "Hi " + (displayName != null ? displayName : "there") + ",\n\n"
                + "You have " + mentionCount + " new mentions on Interlynk.\n\n"
                + "View them: " + inboxUrl + "\n";
        send(to, "You have " + mentionCount + " new mentions", body);
    }
}
