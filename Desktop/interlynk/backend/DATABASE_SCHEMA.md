# Database Schema Documentation

## Overview
This document describes the database schema for the Interlynk Enterprise Collaboration Platform chat system.

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │    channels     │       │    messages     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ username        │       │ name            │──────▶│ channel_id (FK) │
│ email           │       │ description     │       │ sender_id (FK)  │
│ display_name    │       │ type            │       │ content         │
│ password_hash   │       │ team_id (FK)    │       │ parent_id (FK)  │
│ presence        │       │ created_by (FK) │       │ message_type    │
│ created_at      │       │ created_at      │       │ created_at      │
└─────────────────┘       │ updated_at      │       │ updated_at      │
                          └─────────────────┘       └─────────────────┘
                                 │                         │
                                 │                         │
                          ┌──────▼──────┐           ┌───────▼────────┐
                          │ channel_    │           │  attachments   │
                          │ members     │           ├────────────────┤
                          ├─────────────│           │ id (PK)        │
                          │ channel_id  │           │ message_id(FK) │
                          │ user_id     │           │ file_name      │
                          └─────────────│           │ file_path      │
                                        │           │ file_size      │
                          ┌─────────────▼───────────┐ mime_type      │
                          │        teams            │ created_at     │
                          ├─────────────────────────┤                │
                          │ id (PK)                 └────────────────┘
                          │ name                   
                          │ description            
                          │ created_at              
                          └────────────────────────
```

## Tables

### 1. users
```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    presence VARCHAR(20) DEFAULT 'OFFLINE',
    role VARCHAR(20) DEFAULT 'USER',
    last_seen_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_presence (presence),
    INDEX idx_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. teams
```sql
CREATE TABLE teams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. channels
```sql
CREATE TABLE channels (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    team_id BIGINT,
    created_by BIGINT NOT NULL,
    category VARCHAR(50),
    position INT DEFAULT 0,
    max_participants INT DEFAULT 25,
    is_locked BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    voice_room_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_team (team_id),
    INDEX idx_created_by (created_by),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. channel_members (Many-to-Many)
```sql
CREATE TABLE channel_members (
    channel_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. messages (CRITICAL - Message Persistence)
```sql
CREATE TABLE messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    parent_id BIGINT,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT',
    is_edited BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE,
    -- Performance indexes
    INDEX idx_channel_created (channel_id, created_at DESC),
    INDEX idx_channel_created_asc (channel_id, created_at ASC),
    INDEX idx_sender (sender_id),
    INDEX idx_parent (parent_id),
    FULLTEXT INDEX idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Note**: The `messages` table stores ALL messages in MySQL, ensuring persistence after restart.

### 6. attachments
```sql
CREATE TABLE attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7. reactions
```sql
CREATE TABLE reactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_message_user_emoji (message_id, user_id, emoji),
    INDEX idx_message (message_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8. direct_messages
```sql
CREATE TABLE direct_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender (sender_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_conversation (sender_id, receiver_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Performance Optimizations

### 1. Index for Message Pagination
```sql
-- Critical for paginated message loading
CREATE INDEX idx_channel_paginate ON messages(channel_id, created_at DESC);
```

### 2. Index for Search
```sql
-- For full-text search
ALTER TABLE messages ADD FULLTEXT INDEX ft_content (content);
```

### 3. Partitioning (For High Volume)
```sql
-- Optional: Partition by date for very high volume
ALTER TABLE messages PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p202501 VALUES LESS THAN (TO_DAYS('2025-02-01')),
    PARTITION p202502 VALUES LESS THAN (TO_DAYS('2025-03-01')),
    PARTITION p202503 VALUES LESS THAN (TO_DAYS('2025-04-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

## Redis Cache Keys

When Redis is enabled, the following caching strategies are used:

| Cache Name | TTL | Max Size | Description |
|------------|-----|----------|-------------|
| messages | 10 min | 1000 | Recent channel messages |
| channels | 5 min | 500 | Channel metadata |
| users | 1 hour | 2000 | User profiles |

### Redis Pub/Sub Channels
- `chat:channel:{id}` - Channel message broadcasts
- `chat:typing:{channelId}` - Typing indicators
- `chat:presence` - User presence updates

---

## Additional Tables for Enterprise Features

### 9. message_read_receipts
```sql
CREATE TABLE message_read_receipts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_message_user (message_id, user_id),
    INDEX idx_user_channel (user_id, message_id),
    INDEX idx_read_at (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 10. user_blocks
```sql
CREATE TABLE user_blocks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    blocker_id BIGINT NOT NULL,
    blocked_id BIGINT NOT NULL,
    reason VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_blocker_blocked (blocker_id, blocked_id),
    INDEX idx_blocker (blocker_id),
    INDEX idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Enterprise Features Summary

| Feature | Status | Implementation |
|---------|--------|----------------|
| Message Persistence | ✅ | MySQL messages table |
| Real-time Updates | ✅ | WebSocket/STOMP |
| Channel-based Messaging | ✅ | /topic/channel/{id} |
| Read Receipts | ✅ | message_read_receipts table |
| Message Search | ✅ | Full-text search |
| User Blocking | ✅ | user_blocks table |
| Presence Tracking | ✅ | Redis-based |
| Typing Indicators | ✅ | WebSocket topic |
| Rate Limiting | ✅ | Redis counter |
| Offline Message Queue | ✅ | Redis list |
| Message Caching | ✅ | Redis cache |
| Markdown Formatting | ✅ | MessageFormatterService |
| Connection Health | ✅ | Scheduled tasks |
| Multi-server Scaling | ✅ | Redis Pub/Sub |
| Pagination | ✅ | PageRequest |

---

## Performance Optimizations

### Database Indexes (Critical)
```sql
-- Most important indexes for chat performance
CREATE INDEX idx_messages_channel_time ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_sender_time ON messages(sender_id, created_at DESC);
CREATE INDEX idx_reactions_message ON reactions(message_id);
CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_read_receipts_user_channel ON message_read_receipts(user_id, message_id);
```

### Query Optimization Tips
1. Use pagination for message history (max 50 messages per page)
2. Cache frequently accessed channel metadata
3. Use Redis for presence and typing status
4. Implement message batching for bulk operations
5. Use connection pooling for MySQL (HikariCP)
