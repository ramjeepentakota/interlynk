package com.enterprise.collab.service;

import com.enterprise.collab.entity.AuditLog;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.AuditLogRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;

/**
 * Single chokepoint for audit-trail writes. Use this from any service that
 * mutates user-visible state — auth, channels, messages, calls, admin actions.
 *
 * Why: AuditLog was modelled but never wired, leaving the app blind to who did
 * what. Centralising here keeps the call sites one-liners and lets us swap the
 * sink (DB → Kafka → SIEM) later without touching callers.
 *
 * The writes are async + use REQUIRES_NEW so an audit failure can never abort a
 * business transaction, and a rolled-back business transaction still leaves the
 * audit trace behind.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public void record(String username, String action, String entityType, Long entityId) {
        record(username, action, entityType, entityId, null);
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String username, String action, String entityType, Long entityId, String details) {
        try {
            AuditLog.AuditLogBuilder log = AuditLog.builder()
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .details(details);

            if (username != null) {
                userRepository.findByUsername(username).ifPresent(log::user);
            }

            HttpServletRequest req = currentRequest();
            if (req != null) {
                log.ipAddress(clientIp(req));
                String ua = req.getHeader("User-Agent");
                if (ua != null && ua.length() > 500) ua = ua.substring(0, 500);
                log.userAgent(ua);
            }

            auditLogRepository.save(log.build());
        } catch (Exception e) {
            // Audit must never crash the request that triggered it.
            AuditService.log.warn("audit write failed action={} entity={}/{}: {}",
                    action, entityType, entityId, e.getMessage());
        }
    }

    public void recordAnonymous(String action, String entityType, Long entityId, String details) {
        record(null, action, entityType, entityId, details);
    }

    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
        } catch (IllegalStateException e) {
            return null;
        }
    }

    private String clientIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isEmpty()) {
            int comma = fwd.indexOf(',');
            return (comma > 0 ? fwd.substring(0, comma) : fwd).trim();
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isEmpty()) return real;
        return req.getRemoteAddr();
    }
}
