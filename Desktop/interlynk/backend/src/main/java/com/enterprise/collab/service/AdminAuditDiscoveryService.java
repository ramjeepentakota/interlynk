package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.entity.AuditLog;
import com.enterprise.collab.entity.Message;
import com.enterprise.collab.repository.AuditLogRepository;
import com.enterprise.collab.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Audit log viewer (filterable + CSV export) and message search /
 * eDiscovery. eDiscovery results are admin-only and audit-logged.
 */
@Service
@RequiredArgsConstructor
public class AdminAuditDiscoveryService {

    private final AuditLogRepository auditRepo;
    private final MessageRepository messageRepo;

    /* ── Audit ───────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public PagedAudit audit(Long userId, String action, String entityType,
                            LocalDateTime from, LocalDateTime to,
                            int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 500));
        Page<AuditLog> result = auditRepo.adminSearch(userId,
                blank(action), blank(entityType), from, to, pageable);
        List<AuditEntry> rows = result.getContent().stream()
                .map(this::toAuditEntry).collect(Collectors.toList());
        return PagedAudit.builder()
                .content(rows).page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .last(result.isLast()).build();
    }

    @Transactional(readOnly = true)
    public String exportAuditCsv(Long userId, String action, String entityType,
                                 LocalDateTime from, LocalDateTime to) {
        StringBuilder sb = new StringBuilder("timestamp,username,action,entityType,entityId,ip,details\n");
        int page = 0, size = 500;
        while (true) {
            Page<AuditLog> p = auditRepo.adminSearch(userId,
                    blank(action), blank(entityType), from, to,
                    PageRequest.of(page, size));
            for (AuditLog a : p.getContent()) {
                sb.append(a.getCreatedAt()).append(',')
                  .append(csv(a.getUser() == null ? "system" : a.getUser().getUsername())).append(',')
                  .append(csv(a.getAction())).append(',')
                  .append(csv(a.getEntityType())).append(',')
                  .append(a.getEntityId() == null ? "" : a.getEntityId()).append(',')
                  .append(csv(a.getIpAddress())).append(',')
                  .append(csv(a.getDetails()))
                  .append('\n');
            }
            if (p.isLast()) break;
            page++;
            if (page > 100) break; // 50k rows safety
        }
        return sb.toString();
    }

    /* ── eDiscovery ──────────────────────────────────────── */

    @Transactional(readOnly = true)
    public PagedEDiscovery eDiscovery(Long senderId, Long channelId,
                                      String keyword, LocalDateTime from, LocalDateTime to,
                                      int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200));
        Page<Message> result = messageRepo.eDiscovery(senderId, channelId, blank(keyword), from, to, pageable);
        List<EDiscoveryResult> rows = result.getContent().stream().map(m -> EDiscoveryResult.builder()
                .messageId(m.getId())
                .senderId(m.getSender() == null ? null : m.getSender().getId())
                .senderUsername(m.getSender() == null ? null : m.getSender().getUsername())
                .channelId(m.getChannel() == null ? null : m.getChannel().getId())
                .channelName(m.getChannel() == null ? null : m.getChannel().getName())
                .content(m.getContent())
                .createdAt(m.getCreatedAt())
                .build()).collect(Collectors.toList());
        return PagedEDiscovery.builder()
                .content(rows).page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .last(result.isLast()).build();
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private AuditEntry toAuditEntry(AuditLog a) {
        return AuditEntry.builder()
                .id(a.getId())
                .userId(a.getUser() == null ? null : a.getUser().getId())
                .username(a.getUser() == null ? "system" : a.getUser().getUsername())
                .action(a.getAction()).entityType(a.getEntityType()).entityId(a.getEntityId())
                .details(a.getDetails()).ipAddress(a.getIpAddress())
                .timestamp(a.getCreatedAt())
                .build();
    }

    private String blank(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private String csv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
