package com.enterprise.collab.config;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;

/**
 * Tags every HTTP request with a correlation id (header X-Request-Id or a fresh
 * UUID) and stamps it into SLF4J MDC under traceId/requestId for the whole
 * request lifecycle. The same id is echoed back on the response so clients can
 * surface it in error UIs and support tickets.
 *
 * Also stamps userId once the JwtAuthenticationFilter has run.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_TRACE = "traceId";
    public static final String MDC_REQUEST = "requestId";
    public static final String MDC_USER = "userId";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = req.getHeader(HEADER);
        if (id == null || id.isEmpty() || id.length() > 64) {
            id = UUID.randomUUID().toString();
        }
        MDC.put(MDC_TRACE, id);
        MDC.put(MDC_REQUEST, id);
        res.setHeader(HEADER, id);

        try {
            // Stamp userId if a principal is present (JWT filter ran before this for
            // most paths; for unauthenticated calls userId stays empty).
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getName() != null) {
                MDC.put(MDC_USER, auth.getName());
            }
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_TRACE);
            MDC.remove(MDC_REQUEST);
            MDC.remove(MDC_USER);
        }
    }
}
