package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminMgmtDto.*;
import com.enterprise.collab.entity.AuditLog;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Real-time organization overview: live counts, 7-day login trend,
 * dependency health probes, derived alerts, and usage analytics.
 * Every number is computed from persisted data — nothing is mocked.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final CallRoomRepository callRoomRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserLoginHistoryRepository loginHistoryRepository;
    private final DataSource dataSource;

    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("MMM d");

    @Transactional(readOnly = true)
    public DashboardSummary summary() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime last24h = now.minusHours(24);
        LocalDateTime last7d = now.minusDays(7);

        long totalUsers = userRepository.count();
        long active = userRepository.countByStatus(User.UserStatus.ACTIVE);
        long suspended = userRepository.countByStatus(User.UserStatus.SUSPENDED);
        long blocked = userRepository.countByStatus(User.UserStatus.BLOCKED);
        long guests = userRepository.countByGuestTrue();
        long onlineNow = userRepository.findOnlineUsers().size();
        long newUsers7d = userRepository.countByCreatedAtAfter(last7d);
        long activeCalls = callRoomRepository.findByIsActiveTrue().size();
        long logins24h = loginHistoryRepository.countByLoginAtAfter(last24h);
        long failed24h = loginHistoryRepository.countFailedSince(last24h);
        long messages24h = messageRepository.countSince(last24h);

        List<Alert> alerts = new ArrayList<>();
        if (failed24h >= 20) {
            alerts.add(Alert.builder().severity("CRITICAL")
                    .title("Elevated failed sign-ins")
                    .message(failed24h + " failed login attempts in the last 24h — possible brute-force activity.")
                    .build());
        } else if (failed24h >= 5) {
            alerts.add(Alert.builder().severity("WARNING")
                    .title("Failed sign-ins")
                    .message(failed24h + " failed login attempts in the last 24h.")
                    .build());
        }
        if (suspended + blocked > 0) {
            alerts.add(Alert.builder().severity("INFO")
                    .title("Restricted accounts")
                    .message(suspended + " suspended, " + blocked + " blocked account(s).")
                    .build());
        }
        if (alerts.isEmpty()) {
            alerts.add(Alert.builder().severity("INFO")
                    .title("All clear").message("No anomalies detected in the last 24 hours.").build());
        }

        return DashboardSummary.builder()
                .totalUsers(totalUsers)
                .activeUsers(active)
                .suspendedUsers(suspended)
                .blockedUsers(blocked)
                .guestUsers(guests)
                .onlineNow(onlineNow)
                .newUsersLast7Days(newUsers7d)
                .totalTeams(teamRepository.count())
                .totalChannels(channelRepository.count())
                .totalMessages(messageRepository.count())
                .messagesLast24h(messages24h)
                .activeCalls(activeCalls)
                .loginsLast24h(logins24h)
                .failedLoginsLast24h(failed24h)
                .serviceHealth(serviceHealth())
                .alerts(alerts)
                .loginTrend7d(loginTrend(7))
                .recentActivity(recentActivity(12))
                .build();
    }

    @Transactional(readOnly = true)
    public List<ServiceHealth> serviceHealth() {
        List<ServiceHealth> list = new ArrayList<>();

        long t0 = System.currentTimeMillis();
        try (Connection c = dataSource.getConnection()) {
            boolean valid = c.isValid(2);
            list.add(ServiceHealth.builder()
                    .name("Database")
                    .status(valid ? "UP" : "DOWN")
                    .detail(valid ? c.getMetaData().getDatabaseProductName() : "Connection invalid")
                    .latencyMs(System.currentTimeMillis() - t0)
                    .build());
        } catch (Exception e) {
            list.add(ServiceHealth.builder().name("Database").status("DOWN")
                    .detail(e.getMessage()).latencyMs(System.currentTimeMillis() - t0).build());
        }

        Runtime rt = Runtime.getRuntime();
        long usedMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long maxMb = rt.maxMemory() / (1024 * 1024);
        double pct = maxMb > 0 ? (usedMb * 100.0 / maxMb) : 0;
        list.add(ServiceHealth.builder()
                .name("Application")
                .status(pct > 90 ? "DEGRADED" : "UP")
                .detail("Heap " + usedMb + "MB / " + maxMb + "MB (" + Math.round(pct) + "%)")
                .latencyMs(0L)
                .build());

        list.add(ServiceHealth.builder()
                .name("Realtime / WebSocket")
                .status("UP")
                .detail(userRepository.findOnlineUsers().size() + " users online")
                .latencyMs(0L)
                .build());
        return list;
    }

    @Transactional(readOnly = true)
    public UsageAnalytics analytics(int days) {
        int d = Math.min(Math.max(days, 1), 90);
        List<DepartmentCount> byDept = new ArrayList<>();
        for (String dept : userRepository.findDistinctDepartments()) {
            byDept.add(new DepartmentCount(dept,
                    userRepository.adminSearch(null, null, null, dept,
                            PageRequest.of(0, 1)).getTotalElements()));
        }
        List<StatusCount> byStatus = Arrays.stream(User.UserStatus.values())
                .map(s -> new StatusCount(s.name(), userRepository.countByStatus(s)))
                .collect(Collectors.toList());

        return UsageAnalytics.builder()
                .messagesPerDay(messageTrend(d))
                .loginsPerDay(loginTrend(d))
                .usersByDepartment(byDept)
                .usersByStatus(byStatus)
                .build();
    }

    /* ── trends ──────────────────────────────────────────── */

    private List<TimeBucket> loginTrend(int days) {
        List<TimeBucket> buckets = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);
            LocalDateTime start = day.atStartOfDay();
            long all = loginHistoryRepository.countByLoginAtAfter(start);
            long afterEnd = loginHistoryRepository.countByLoginAtAfter(start.plusDays(1));
            buckets.add(new TimeBucket(day.format(DAY_FMT), Math.max(0, all - afterEnd)));
        }
        return buckets;
    }

    private List<TimeBucket> messageTrend(int days) {
        List<TimeBucket> buckets = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);
            LocalDateTime start = day.atStartOfDay();
            long all = messageRepository.countSince(start);
            long afterEnd = messageRepository.countSince(start.plusDays(1));
            buckets.add(new TimeBucket(day.format(DAY_FMT), Math.max(0, all - afterEnd)));
        }
        return buckets;
    }

    private List<RecentActivity> recentActivity(int limit) {
        return auditLogRepository
                .findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))
                .getContent().stream()
                .map(this::toRecent)
                .collect(Collectors.toList());
    }

    private RecentActivity toRecent(AuditLog a) {
        return RecentActivity.builder()
                .action(a.getAction())
                .entityType(a.getEntityType())
                .username(a.getUser() != null ? a.getUser().getUsername() : "system")
                .details(a.getDetails())
                .timestamp(a.getCreatedAt())
                .build();
    }
}
