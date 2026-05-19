# Enterprise Collaboration Platform - API Documentation

This document provides complete API reference for the Enterprise Collaboration Platform.

## Base URL
```
http://localhost:8080/api
```

## Authentication

### Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@company.com",
    "role": "ADMIN"
  }
}
```

### Register
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "teamId": 1
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 2,
    "username": "john",
    "email": "john@company.com",
    "role": "EMPLOYEE"
  }
}
```

---

## Channels

### Get All Channels
```
GET /api/channels
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "general",
    "type": "PUBLIC",
    "description": "General discussion"
  }
]
```

### Create Channel
```
POST /api/channels
```

**Request Body:**
```json
{
  "name": "string",
  "type": "PUBLIC|PRIVATE",
  "description": "string"
}
```

### Get Channel Messages
```
GET /api/channels/{channelId}/messages
```

**Query Parameters:**
- `page`: Page number (default: 0)
- `size`: Page size (default: 50)

**Response:**
```json
{
  "content": [
    {
      "id": 1,
      "content": "Hello!",
      "senderId": 1,
      "senderUsername": "admin",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Send Message
```
POST /api/channels/{channelId}/messages
```

**Request Body:**
```json
{
  "content": "Hello team!"
}
```

---

## Direct Messages

### Get Direct Messages
```
GET /api/messages/direct/{userId}
```

### Send Direct Message
```
POST /api/messages/direct
```

**Request Body:**
```json
{
  "receiverId": 2,
  "content": "Hello!"
}
```

---

## Workspaces

### Get User Workspaces
```
GET /api/workspaces
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "repository": {
      "id": 1,
      "name": "my-project",
      "url": "/opt/company-platform/repos/my-project"
    },
    "branch": "main",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Create Workspace
```
POST /api/workspaces
```

**Query Parameters:**
- `repositoryId`: ID of the repository
- `branch`: Branch name (optional, default: main)

### Get Workspace Files
```
GET /api/workspaces/{workspaceId}/files
```

**Response:**
```json
[
  {
    "id": 1,
    "filePath": "src/index.js",
    "content": "console.log('Hello');",
    "isDirectory": false
  }
]
```

### Save File
```
POST /api/workspaces/{workspaceId}/files
```

**Request Body:**
```json
{
  "filePath": "src/index.js",
  "content": "console.log('Hello World');"
}
```

---

## Code Execution

### Execute Code
```
POST /api/execute
```

**Request Body:**
```json
{
  "workspaceId": 1,
  "language": "javascript|python|java|go|cpp",
  "code": "console.log('Hello');"
}
```

**Response:**
```json
{
  "id": 1,
  "status": "RUNNING",
  "output": "",
  "errorOutput": ""
}
```

### Get Execution Result
```
GET /api/execute/{executionId}
```

**Response:**
```json
{
  "id": 1,
  "status": "COMPLETED",
  "output": "Hello\n",
  "errorOutput": "",
  "exitCode": 0
}
```

---

## Code Review

### Get Pull Requests
```
GET /api/reviews
```

**Response:**
```json
[
  {
    "id": 1,
    "title": "Add new feature",
    "description": "This PR adds a new feature",
    "status": "OPEN",
    "sourceBranch": "feature/new-feature",
    "targetBranch": "main",
    "author": {
      "id": 1,
      "username": "john"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Create Pull Request
```
POST /api/reviews
```

**Request Body:**
```json
{
  "title": "Add new feature",
  "description": "This PR adds a new feature",
  "sourceBranch": "feature/new-feature",
  "targetBranch": "main",
  "workspaceId": 1
}
```

### Approve Pull Request
```
POST /api/reviews/{prId}/approve
```

**Request Body:**
```json
{
  "comment": "Looks good!"
}
```

### Reject Pull Request
```
POST /api/reviews/{prId}/reject
```

**Request Body:**
```json
{
  "comment": "Please fix this issue"
}
```

### Merge Pull Request
```
POST /api/reviews/{prId}/merge
```

---

## Voice/Video Calls

### Get Active Rooms
```
GET /api/calls/rooms
```

### Create Room
```
POST /api/calls/room
```

**Request Body:**
```json
{
  "name": "Team Meeting",
  "type": "ONE_TO_ONE|GROUP"
}
```

### Join Room
```
POST /api/calls/room/{roomId}/join
```

### Leave Room
```
POST /api/calls/room/{roomId}/leave
```

### Get Participants
```
GET /api/calls/room/{roomId}/participants
```

---

## Notifications

### Get Notifications
```
GET /api/notifications
```

### Get Unread Count
```
GET /api/notifications/count
```

### Mark as Read
```
POST /api/notifications/{id}/read
```

### Mark All as Read
```
POST /api/notifications/read-all
```

---

## Admin APIs

### Get All Users
```
GET /api/admin/users
```

### Create User
```
POST /api/admin/users
```

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "ADMIN|MANAGER|EMPLOYEE"
}
```

### Delete User
```
DELETE /api/admin/users/{userId}
```

### Get Teams
```
GET /api/admin/teams
```

### Create Team
```
POST /api/admin/teams
```

**Request Body:**
```json
{
  "name": "Engineering",
  "description": "Engineering team"
}
```

### Get Repositories
```
GET /api/admin/repositories
```

### Create Repository
```
POST /api/admin/repositories
```

**Request Body:**
```json
{
  "name": "my-project",
  "description": "Project description",
  "teamId": 1
}
```

### Get Stats
```
GET /api/admin/stats
```

**Response:**
```json
{
  "activeUsers": 50,
  "activeCalls": 5,
  "diskUsage": 10737418240,
  "storageUsage": 5368709120
}
```

### Get Audit Logs
```
GET /api/admin/audit-logs
```

**Query Parameters:**
- `page`: Page number
- `size`: Page size

---

## WebSocket Topics

### Subscribe to Channel Messages
```
/topic/channel/{channelId}
```

### Subscribe to Notifications
```
/topic/user/{userId}/notifications
```

### Subscribe to Call Updates
```
/topic/call/{roomId}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "status": 400,
  "message": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "status": 401,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "status": 403,
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "status": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "status": 500,
  "message": "Internal server error"
}
```
