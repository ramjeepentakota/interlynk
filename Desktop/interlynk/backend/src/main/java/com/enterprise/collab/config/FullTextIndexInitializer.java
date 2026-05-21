package com.enterprise.collab.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Creates the FULLTEXT indexes that power SearchService. Runs once at
 * startup; errors for "duplicate key name" / "duplicate index" are swallowed
 * so the bean is idempotent across restarts.
 *
 * We do this in Java rather than appending to schema.sql because Spring's
 * sql.init script-runner can't parse MySQL DELIMITER blocks or stored
 * procedures — so an information-schema guard inside SQL is awkward. JdbcTemplate
 * + try/catch is the simplest path that survives every redeploy.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FullTextIndexInitializer {

    private final JdbcTemplate jdbc;

    private static final List<String> INDEXES = List.of(
            "ALTER TABLE messages ADD FULLTEXT INDEX ft_messages_content (content)",
            "ALTER TABLE users ADD FULLTEXT INDEX ft_users_directory (username, display_name, email)",
            "ALTER TABLE channels ADD FULLTEXT INDEX ft_channels_directory (name, description)"
    );

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        for (String sql : INDEXES) {
            try {
                jdbc.execute(sql);
                log.info("created fulltext index: {}", sql);
            } catch (org.springframework.dao.DataAccessException e) {
                // MySQL error 1061 = duplicate key name (index already exists).
                // Any other error is logged but non-fatal — search will degrade
                // to LIKE on the affected column.
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("1061") || msg.toLowerCase().contains("duplicate key")) {
                    log.debug("fulltext index already present: {}", sql);
                } else {
                    log.warn("could not create fulltext index ({}): {}", sql, msg);
                }
            }
        }
    }
}
