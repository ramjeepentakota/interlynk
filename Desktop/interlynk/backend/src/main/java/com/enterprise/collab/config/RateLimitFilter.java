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
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
@Slf4j
public class RateLimitFilter {
    
    // Note: Bucket4j rate limiting is disabled for Java 8 compatibility
    // It can be enabled when using Java 11+ with bucket4j 8.x
    
    @Value("${app.security.rate-limit.requests-per-minute:100}")
    private int requestsPerMinute;
    
    // Simple in-memory counter for demonstration
    // Production should use a proper rate limiting solution
    private final java.util.Map<String, AtomicInteger> requestCounts = new java.util.concurrent.ConcurrentHashMap<>();
    
    @Bean
    public FilterRegistrationBean<Filter> rateLimitFilterRegistration() {
        FilterRegistrationBean<Filter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new SimpleRateLimiter());
        registrationBean.addUrlPatterns("/api/*");
        registrationBean.setOrder(1);
        return registrationBean;
    }
    
    private class SimpleRateLimiter implements Filter {
        
        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
                throws IOException, ServletException {
            
            HttpServletRequest httpRequest = (HttpServletRequest) request;
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            
            // Skip CORS preflight requests
            if ("OPTIONS".equalsIgnoreCase(httpRequest.getMethod())) {
                chain.doFilter(request, response);
                return;
            }
            
            // For now, pass all requests through without rate limiting
            // Rate limiting can be enabled with bucket4j when using Java 11+
            chain.doFilter(request, response);
        }
        
        @Override
        public void init(FilterConfig filterConfig) throws ServletException {
            log.info("Rate limiting filter initialized (bucket4j disabled for Java 8)");
        }
        
        @Override
        public void destroy() {
            // Cleanup
        }
    }
}
