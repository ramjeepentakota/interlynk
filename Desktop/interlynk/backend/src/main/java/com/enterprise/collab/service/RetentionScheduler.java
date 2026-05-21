package com.enterprise.collab.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Nightly retention sweeper. Deletes rows older than a configurable age in
 * tables that have a clear time boundary (audit, login history, notifications,
 * messages). Each window is independent and 0 means "never delete".
 *
 * Why this design: many compliance regimes (GDPR, SOC2 CC6, HIPAA §164.316)
 * require either retention OR a documented purge schedule. Hard-deleting on a
 * cron is the simplest defensible posture for an SMB-scale app. Retention by
 * policy entity (per-team, per-channel) is a separate concern and would layer
 * on top of this base sweeper.
 *
 * Uses JdbcTemplate for batched bulk-deletes — JPA's cascading deletes would
 * load entities into memory and tank performance on large tables.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RetentionScheduler {

    private final JdbcTemplate jdbc;

    @Value("${app.retention.enabled:true}")
    private boolean enabled;

    @Value("${app.retention.messages-days:0}")
    private int messagesDays;

    @Value("${app.retention.audit-days:365}")
    private int auditDays;

    @Value("${app.retention.notifications-days:60}")
    private int notificationsDays;

    @Value("${app.retention.login-history-days:90}")
    private int loginHistoryDays;

    @Scheduled(cron = "${app.retention.sweep-cron:0 30 3 * * *}")
    public void sweep() {
        if (!enabled) {
            log.debug("retention sweep disabled");
            return;
        }
        long t = System.currentTimeMillis();
        log.info("retention sweep starting (messages={}d audit={}d notifications={}d loginHistory={}d)",
                messagesDays, auditDays, notificationsDays, loginHistoryDays);

        int removedMessages   = sweep("messages",            "created_at", messagesDays);
        int removedAudit      = sweep("audit_logs",          "created_at", auditDays);
        int removedNotif      = sweep("notifications",       "created_at", notificationsDays);
        int removedLoginHist  = sweep("user_login_history",  "created_at", loginHistoryDays);

        log.info("retention sweep done in {}ms (messages={} audit={} notifications={} loginHistory={})",
                System.currentTimeMillis() - t,
                removedMessages, removedAudit, removedNotif, removedLoginHist);
    }

    /**
     * Deletes rows from {@code table} where {@code column < now-days} in batches
     * of 1000 so we don't hold a long-running transaction or blow up the binlog.
     * Returns total rows removed. 0 days = no-op.
     */
    private int sweep(String table, String column, int days) {
        if (days <= 0) return 0;
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        int total = 0;
        try {
            int n;
            do {
                n = jdbc.update(
                        "DELETE FROM " + table + " WHERE " + column + " < ? LIMIT 1000",
                        cutoff);
                total += n;
            } while (n == 1000);
        } catch (Exception e) {
            // Table might not exist in some deploys (e.g. user_login_history is
            // ops-only). Log and continue with the next table.
            log.warn("retention sweep on {} failed: {}", table, e.getMessage());
        }
        return total;
    }
}
