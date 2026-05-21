package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminMgmtDto.*;
import com.enterprise.collab.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 1 — Dashboard &amp; Overview. Live organization metrics,
 * dependency health, and usage analytics. Admin-only.
 */
@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AdminDashboardService dashboardService;

    @GetMapping
    public ResponseEntity<DashboardSummary> summary() {
        return ResponseEntity.ok(dashboardService.summary());
    }

    @GetMapping("/health")
    public ResponseEntity<List<ServiceHealth>> health() {
        return ResponseEntity.ok(dashboardService.serviceHealth());
    }

    @GetMapping("/analytics")
    public ResponseEntity<UsageAnalytics> analytics(
            @RequestParam(defaultValue = "14") int days) {
        return ResponseEntity.ok(dashboardService.analytics(days));
    }
}
