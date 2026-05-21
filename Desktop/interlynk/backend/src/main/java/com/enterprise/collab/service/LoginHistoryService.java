package com.enterprise.collab.service;

import com.enterprise.collab.entity.User;
import com.enterprise.collab.entity.UserLoginHistory;
import com.enterprise.collab.repository.UserLoginHistoryRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;

/**
 * Records every authentication attempt. Recording is best-effort and runs
 * in its own transaction so a logging failure can never break sign-in.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginHistoryService {

    private final UserLoginHistoryRepository loginHistoryRepository;
    private final UserRepository userRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(String username) {
        try {
            User user = userRepository.findByUsername(username).orElse(null);
            save(user, username, true, null);
        } catch (Exception e) {
            log.warn("Failed to record successful login for {}", username, e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String username, String reason) {
        try {
            User user = username == null ? null : userRepository.findByUsername(username).orElse(null);
            save(user, username, false, reason);
        } catch (Exception e) {
            log.warn("Failed to record failed login for {}", username, e);
        }
    }

    private void save(User user, String username, boolean success, String reason) {
        HttpServletRequest req = currentRequest();
        loginHistoryRepository.save(UserLoginHistory.builder()
                .user(user)
                .usernameAttempted(username)
                .success(success)
                .failureReason(reason)
                .ipAddress(clientIp(req))
                .userAgent(req != null ? trim(req.getHeader("User-Agent"), 500) : null)
                .loginAt(LocalDateTime.now())
                .build());
    }

    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String clientIp(HttpServletRequest req) {
        if (req == null) return null;
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return trim(fwd.split(",")[0].trim(), 45);
        return trim(req.getRemoteAddr(), 45);
    }

    private String trim(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
