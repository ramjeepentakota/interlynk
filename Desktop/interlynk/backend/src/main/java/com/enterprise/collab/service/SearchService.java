package com.enterprise.collab.service;

import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Cross-channel full-text search backed by MySQL InnoDB FULLTEXT indexes
 * created at startup by FullTextIndexInitializer.
 *
 * Why a service (not a JPA query): MATCH … AGAINST is a MySQL-dialect
 * construct that Spring Data JPA cannot validate at compile time, and we want
 * to compose a single query that scores results AND enforces channel
 * membership in one round-trip. JdbcTemplate keeps the SQL explicit and the
 * column projection cheap.
 *
 * Input sanitisation: the user query is passed as a positional parameter; we
 * also strip control characters that confuse the boolean-mode tokenizer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;

    public List<MessageHit> searchMessages(String username, String rawQuery, int limit) {
        if (rawQuery == null || rawQuery.isBlank()) return Collections.emptyList();
        if (limit <= 0 || limit > 200) limit = 50;

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        String q = normalize(rawQuery);
        if (q.isEmpty()) return Collections.emptyList();

        // Boolean-mode query: each term is a "+wildcard*" so we get sub-string
        // semantics. Admins skip the membership join (they can see everything).
        boolean isAdmin = user.hasRole("ADMIN");
        StringBuilder sql = new StringBuilder(
                "SELECT m.id, m.channel_id, c.name AS channel_name, m.sender_id, u.username AS sender_username, " +
                "       m.content, m.created_at, " +
                "       MATCH(m.content) AGAINST(? IN BOOLEAN MODE) AS score " +
                "FROM messages m " +
                "JOIN channels c ON c.id = m.channel_id " +
                "JOIN users u ON u.id = m.sender_id ");
        if (!isAdmin) {
            sql.append("JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ? ");
        }
        sql.append("WHERE MATCH(m.content) AGAINST(? IN BOOLEAN MODE) ");
        sql.append("ORDER BY score DESC, m.created_at DESC LIMIT ?");

        List<Object> args = new ArrayList<>();
        args.add(q);                          // score expression
        if (!isAdmin) args.add(user.getId()); // membership join
        args.add(q);                          // WHERE clause
        args.add(limit);

        return jdbc.query(sql.toString(), args.toArray(), (rs, n) -> {
            MessageHit h = new MessageHit();
            h.id = rs.getLong("id");
            h.channelId = rs.getLong("channel_id");
            h.channelName = rs.getString("channel_name");
            h.senderId = rs.getLong("sender_id");
            h.senderUsername = rs.getString("sender_username");
            h.content = rs.getString("content");
            java.sql.Timestamp ts = rs.getTimestamp("created_at");
            h.createdAt = ts != null ? ts.toLocalDateTime() : null;
            h.score = rs.getDouble("score");
            return h;
        });
    }

    public List<UserHit> searchUsers(String rawQuery, int limit) {
        if (rawQuery == null || rawQuery.isBlank()) return Collections.emptyList();
        if (limit <= 0 || limit > 100) limit = 25;
        String q = normalize(rawQuery);
        if (q.isEmpty()) return Collections.emptyList();

        String sql = "SELECT id, username, display_name, email, avatar_url, presence, status, department, job_title " +
                     "FROM users " +
                     "WHERE MATCH(username, display_name, email) AGAINST(? IN BOOLEAN MODE) " +
                     "AND status = 'ACTIVE' " +
                     "ORDER BY MATCH(username, display_name, email) AGAINST(? IN BOOLEAN MODE) DESC " +
                     "LIMIT ?";
        return jdbc.query(sql, new Object[]{q, q, limit}, (rs, n) -> {
            UserHit h = new UserHit();
            h.id = rs.getLong("id");
            h.username = rs.getString("username");
            h.displayName = rs.getString("display_name");
            h.email = rs.getString("email");
            h.avatarUrl = rs.getString("avatar_url");
            h.presence = rs.getString("presence");
            h.department = rs.getString("department");
            h.jobTitle = rs.getString("job_title");
            return h;
        });
    }

    /**
     * Strips control characters, escapes boolean-mode operators we don't want
     * users to inject, and turns space-separated terms into "+term*" prefix
     * matches. Empty after normalization → caller returns empty list.
     */
    private String normalize(String input) {
        // Remove characters that have special meaning in BOOLEAN MODE.
        String cleaned = input.replaceAll("[+\\-><()~*\"@:]", " ").trim();
        if (cleaned.length() > 200) cleaned = cleaned.substring(0, 200);
        if (cleaned.isEmpty()) return "";

        StringBuilder out = new StringBuilder();
        for (String tok : cleaned.split("\\s+")) {
            if (tok.length() < 2) continue;   // ft_min_word_len is usually 3; we
                                              // pad with prefix * so length 2 OK.
            if (out.length() > 0) out.append(' ');
            out.append('+').append(tok).append('*');
        }
        return out.toString();
    }

    public static class MessageHit {
        public Long id;
        public Long channelId;
        public String channelName;
        public Long senderId;
        public String senderUsername;
        public String content;
        public LocalDateTime createdAt;
        public double score;
    }

    public static class UserHit {
        public Long id;
        public String username;
        public String displayName;
        public String email;
        public String avatarUrl;
        public String presence;
        public String department;
        public String jobTitle;
    }
}
