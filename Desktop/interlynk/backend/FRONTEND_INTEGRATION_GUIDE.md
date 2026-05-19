# Frontend Integration Guide

## WebSocket Connection for Real-Time Chat

This guide explains how to integrate the frontend with the backend WebSocket API for real-time messaging.

---

## Table of Contents
1. [Connection Setup](#connection-setup)
2. [Authentication](#authentication)
3. [Subscribing to Channels](#subscribing-to-channels)
4. [Sending Messages](#sending-messages)
5. [Receiving Messages](#receiving-messages)
6. [Typing Indicators](#typing-indicators)
7. [Presence Updates](#presence-updates)
8. [Error Handling](#error-handling)
9. [Debugging](#debugging)

---

## Connection Setup

### Using SockJS + STOMP

```javascript
// 1. Include SockJS and STOMP libraries
// <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1.6.1/dist/sockjs.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/@stomp/stompjs@7.0.0/lib/stomp.min.js"></script>

// 2. Initialize STOMP client
const stompClient = new StompJs.Client({
    webSocketFactory: () => new SockJS('http://localhost:8082/ws'),
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: onConnected,
    onDisconnect: onDisconnected,
    onStompError: onStompError
});

// 3. Connect
stompClient.activate();

function onConnected(frame) {
    console.log('Connected: ' + frame);
    // Subscribe to channels here
}

function onDisconnected() {
    console.log('Disconnected');
}

function onStompError(frame) {
    console.error('STOMP Error: ' + frame);
}
```

### Using Native WebSocket (No SockJS)

```javascript
const stompClient = new StompJs.Client({
    webSocketFactory: () => new WebSocket('ws://localhost:8082/ws'),
    reconnectDelay: 5000
});

stompClient.activate();
```

---

## Authentication

### Option 1: Query Parameter (Development)
```javascript
const stompClient = new StompJs.Client({
    webSocketFactory: () => new SockJS(`http://localhost:8082/ws?token=${authToken}`),
    // ...
});
```

### Option 2: STOMP Headers (Recommended)
```javascript
const stompClient = new StompJs.Client({
    webSocketFactory: () => new SockJS('http://localhost:8082/ws'),
    connectHeaders: {
        'Authorization': `Bearer ${authToken}`
    },
    // ...
});
```

---

## Subscribing to Channels

### Subscribe to Channel Messages
```javascript
// After connection is established
function subscribeToChannel(channelId) {
    // Subscribe to messages
    stompClient.subscribe(`/topic/channel/${channelId}`, (message) => {
        const messageData = JSON.parse(message.body);
        handleIncomingMessage(messageData);
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    // Subscribe to typing indicators
    stompClient.subscribe(`/topic/channel/${channelId}/typing`, (message) => {
        const typingData = JSON.parse(message.body);
        handleTypingIndicator(typingData);
    });
    
    console.log(`Subscribed to channel ${channelId}`);
}
```

### Unsubscribe
```javascript
const subscription = stompClient.subscribe(`/topic/channel/${channelId}`, callback);
subscription.unsubscribe();
```

---

## Sending Messages

### Via REST API (Recommended for reliability)
```javascript
async function sendMessage(channelId, content) {
    const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ content })
    });
    
    return response.json();
}
```

### Via WebSocket
```javascript
function sendMessageViaWebSocket(channelId, content) {
    stompClient.publish({
        destination: `/app/chat/channel/${channelId}`,
        body: JSON.stringify({
            username: currentUser.username,
            content: content,
            channelId: channelId
        }),
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
}
```

### Sending with Attachments
```javascript
async function sendMessageWithAttachments(channelId, content, attachments) {
    const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            content,
            attachments: attachments.map(att => ({
                filename: att.name,
                url: att.url,
                size: att.size,
                fileType: att.type
            }))
        })
    });
    
    return response.json();
}
```

---

## Receiving Messages

### Message Handler
```javascript
function handleIncomingMessage(message) {
    console.log('New message received:', message);
    
    // Add to message list
    messages.push(message);
    
    // Update UI
    renderMessage(message);
    
    // Scroll to bottom
    scrollToBottom();
}

// Message structure:
// {
//     "id": 123,
//     "content": "Hello World",
//     "senderId": 1,
//     "senderUsername": "john",
//     "senderDisplayName": "John Doe",
//     "channelId": 1,
//     "messageType": "TEXT",
//     "isEdited": false,
//     "isPinned": false,
//     "createdAt": "2025-01-15T10:30:00",
//     "attachments": [],
//     "reactions": []
// }
```

---

## Typing Indicators

### Sending Typing Status
```javascript
let typingTimeout = null;

function handleTextInput(textarea) {
    // Send typing status
    stompClient.publish({
        destination: `/app/typing/channel/${channelId}`,
        body: JSON.stringify({
            username: currentUser.username,
            channelId: channelId,
            isTyping: true
        })
    });
    
    // Clear after 3 seconds of inactivity
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        stompClient.publish({
            destination: `/app/typing/channel/${channelId}`,
            body: JSON.stringify({
                username: currentUser.username,
                channelId: channelId,
                isTyping: false
            })
        });
    }, 3000);
}
```

### Receiving Typing Status
```javascript
function handleTypingIndicator(data) {
    if (data.isTyping) {
        showTypingIndicator(data.username);
    } else {
        hideTypingIndicator(data.username);
    }
}
```

---

## Presence Updates

### Subscribe to Presence
```javascript
// Subscribe to presence updates
stompClient.subscribe('/topic/user/presence', (message) => {
    const presence = JSON.parse(message.body);
    updateUserPresence(presence.username, presence.presence);
});
```

### Presence Types
- `ONLINE` - User is active
- `AWAY` - User is idle
- `DO_NOT_DISTURB` - User doesn't want to be disturbed
- `OFFLINE` - User is disconnected

---

## Loading Message History

### Paginated API Call
```javascript
async function loadMessageHistory(channelId, page = 0, size = 50) {
    const response = await fetch(
        `/api/channels/${channelId}/messages?page=${page}&size=${size}`,
        {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        }
    );
    
    const data = await response.json();
    
    return {
        messages: data.messages,
        hasNext: data.hasNext,
        hasPrevious: data.hasPrevious,
        totalPages: data.totalPages
    };
}

// Load older messages (scroll up)
async function loadOlderMessages() {
    const result = await loadMessageHistory(channelId, currentPage + 1);
    messages = [...result.messages, ...messages];
    currentPage = result.hasNext ? currentPage + 1 : currentPage;
}

// Load newer messages (refresh)
async function loadNewerMessages() {
    const result = await loadMessageHistory(channelId, 0);
    messages = [...messages, ...result.messages];
}
```

---

## Error Handling

### Connection Error Handler
```javascript
const stompClient = new StompJs.Client({
    // ... other options
    onWebSocketError: (error) => {
        console.error('WebSocket Error:', error);
        showReconnectNotification();
    },
    onStompError: (frame) => {
        console.error('STOMP Error:', frame.headers['message']);
        showError('Failed to connect to chat server');
    },
    onConnectFrame: (frame) => {
        console.log('Connected');
    }
});
```

### Retry Logic
```javascript
const stompClient = new StompJs.Client({
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
    // Or implement custom retry
});
```

---

## Debugging

### Enable STOMP Debugging
```javascript
const stompClient = new StompJs.Client({
    // ... other options
    debug: (str) => {
        console.log('STOMP:', str);
    }
});
```

### Common Issues

1. **Connection refused**
   - Check if server is running on correct port (8082)
   - Verify CORS settings allow your origin

2. **401 Unauthorized**
   - Ensure auth token is valid and not expired
   - Check token is included in headers

3. **Messages not received**
   - Verify subscription is successful
   - Check if channel ID is correct

4. **Messages not persisting**
   - Check MySQL database connection
   - Verify messages table exists

---

## React Example

```jsx
import React, { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const ChatComponent = ({ channelId, authToken }) => {
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const clientRef = useRef(null);

    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS(`http://localhost:8082/ws`),
            connectHeaders: { Authorization: `Bearer ${authToken}` },
            onConnect: () => {
                setConnected(true);
                
                // Subscribe to channel
                client.subscribe(`/topic/channel/${channelId}`, (message) => {
                    const msg = JSON.parse(message.body);
                    setMessages(prev => [...prev, msg]);
                });
            },
            onDisconnect: () => setConnected(false)
        });

        client.activate();
        clientRef.current = client;

        return () => client.deactivate();
    }, [channelId, authToken]);

    const sendMessage = (content) => {
        clientRef.current.publish({
            destination: `/app/chat/channel/${channelId}`,
            body: JSON.stringify({ content, username: currentUser.username })
        });
    };

    return (
        <div>
            <div>{connected ? 'Connected' : 'Disconnected'}</div>
            <div className="messages">
                {messages.map(msg => (
                    <div key={msg.id}>{msg.content}</div>
                ))}
            </div>
            <input onChange={(e) => sendMessage(e.target.value)} />
        </div>
    );
};
```

---

## Vue.js Example

```javascript
<script setup>
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const messages = ref([]);
const connected = ref(false);
let client = null;

const connect = (channelId, token) => {
    client = new Client({
        webSocketFactory: () => new SockJS(`http://localhost:8082/ws`),
        connectHeaders: { Authorization: `Bearer ${token}` },
        onConnect: () => {
            connected.value = true;
            client.subscribe(`/topic/channel/${channelId}`, (msg) => {
                messages.value.push(JSON.parse(msg.body));
            });
        }
    });
    client.activate();
};

const sendMessage = (content) => {
    client.publish({
        destination: `/app/chat/channel/${channelId}`,
        body: JSON.stringify({ content, username: currentUser.username })
    });
};
</script>
```

---

## Testing with cURL

```bash
# Test WebSocket connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost:8082" \
  -H "Origin: http://localhost:3000" \
  http://localhost:8082/ws
```

---

## Performance Tips

1. **Batch Updates**: Group multiple rapid message sends
2. **Debounce Typing**: Don't send on every keystroke
3. **Lazy Load History**: Load older messages on scroll up
4. **Use Pagination**: Limit initial load to 50 messages
5. **Compress Messages**: Enable gzip on server
