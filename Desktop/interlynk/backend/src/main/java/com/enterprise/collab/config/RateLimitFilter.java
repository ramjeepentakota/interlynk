package com.enterprise.collab.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-IP fixed-window rate limiter. In-memory and dependency-free (suitable for
 * a single-node deployment; move to Redis/bucket4j when running multiple nodes).
 *
 * Two windows are tracked per client IP:
 *   - auth endpoints (/api/v1/auth/login, /register, /refresh) — a tight limit
 *     to blunt credential brute-force.
 *   - everything else under /api — a general abuse ceiling.
 *
 * Over-limit requests get HTTP 429 with a Retry-After header. CORS preflight
 * (OPTIONS) is always allowed through.
 */
@Configuration
@Slf4j
public class RateLimitFilter {

    @Value("${app.security.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${app.security.rate-limit.requests-per-minute:100}")
    private int requestsPerMinute;

    @Value("${app.security.rate-limit.auth-requests-per-minute:10}")
    private int authRequestsPerMinute;

    @Bean
    public FilterRegistrationBean<Filter> rateLimitFilterRegistration() {
        FilterRegistrationBean<Filter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new SlidingWindowRateLimiter());
        registrationBean.addUrlPatterns("/api/*");
        registrationBean.setOrder(1);
        return registrationBean;
    }

    /** One counter bucket valid until {@code windowEndMs}. */
    private static final class Window {
        volatile long windowEndMs;
        final AtomicInteger count = new AtomicInteger(0);
    }

    private final class SlidingWindowRateLimiter implements Filter {

        // Keyed by "ip|scope". Cleaned lazily as windows roll over.
        private final Map<String, Window> windows = new ConcurrentHashMap<>();

        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws IOException, ServletException {

            HttpServletRequest req = (HttpServletRequest) request;
            HttpServletResponse res = (HttpServletResponse) response;

            if (!enabled || "OPTIONS".equalsIgnoreCase(req.getMethod())) {
                chain.doFilter(request, response);
                return;
            }

            String path = req.getRequestURI();
            boolean isAuth = path.startsWith("/api/v1/auth/") || path.startsWith("/api/auth/");
            int limit = isAuth ? authRequestsPerMinute : requestsPerMinute;
            String key = clientIp(req) + "|" + (isAuth ? "auth" : "api");

            if (isOverLimit(key, limit)) {
                res.setStatus(429); // Too Many Requests
                res.setHeader("Retry-After", "60");
                res.setContentType("application/json");
                res.getWriter().write("{\"error\":\"rate_limited\",\"message\":\"Too many requests. Slow down and retry shortly.\"}");
                return;
            }

            chain.doFilter(request, response);
        }

        private boolean isOverLimit(String key, int limit) {
            long now = System.currentTimeMillis();
            Window w = windows.compute(key, (k, existing) -> {
                if (existing == null || now >= existing.windowEndMs) {
                    Window fresh = new Window();
                    fresh.windowEndMs = now + 60_000L;
                    return fresh;
                }
                return existing;
            });
            return w.count.incrementAndGet() > limit;
        }

        /** Prefer the left-most X-Forwarded-For hop (set by our own reverse proxy)
         *  and fall back to the socket address. */
        private String clientIp(HttpServletRequest req) {
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isEmpty()) {
                int comma = xff.indexOf(',');
                return (comma > 0 ? xff.substring(0, comma) : xff).trim();
            }
            return req.getRemoteAddr();
        }

        @Override
        public void init(FilterConfig filterConfig) {
            log.info("Rate limiting initialized (enabled={}, api={}/min, auth={}/min)",
                    enabled, requestsPerMinute, authRequestsPerMinute);
        }

        @Override
        public void destroy() {
            windows.clear();
        }
    }
}
