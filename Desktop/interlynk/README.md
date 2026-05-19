# Enterprise Collaboration Platform

A comprehensive enterprise internal communication and collaboration platform built with Java Spring Boot and React/Electron.

## Features

### Communication
- **Real-time Chat**: Public and private channels with WebSocket support
- **Direct Messaging**: Private conversations between users
- **Voice Channels**: Persistent voice rooms like Discord
- **Video Calls**: 1-to-1 and group video calls with screen sharing
- **Presence**: Online, offline, busy, away status
- **Message Reactions**: Emoji reactions to messages
- **Message Threads**: Reply to messages in threads
- **Message Editing**: Edit and delete messages

### Code Collaboration
- **Monaco Editor**: Full VSCode-like editing experience
- **Code Execution**: Run Python, Java, Node.js, Go, C++ code in sandboxed environment
- **Code Review**: Pull request workflow with approve/reject/merge
- **Secure Workspaces**: Isolated user workspaces with watermarking

### Administration
- **RBAC**: Admin, Manager, Employee roles
- **User Management**: Create and manage users
- **Team Management**: Organize users into teams
- **Project Management**: Create and manage code repositories
- **Audit Logging**: Track all system activities

## Technology Stack

### Backend
- Java 21
- Spring Boot 3
- Spring Security (JWT) with Refresh Tokens
- Spring WebSocket + STOMP
- Spring Data JPA
- MySQL 8

### Frontend Desktop
- Electron 28
- React 18
- TypeScript
- Monaco Editor
- Tailwind CSS
- Zustand (State Management)

### Build Tools
- Maven (Backend)
- Vite (Frontend)
- electron-builder (Desktop packaging)

## Project Structure

```
enterprise-collab/
├── backend/                    # Spring Boot backend
│   ├── src/main/java/
│   │   └── com/enterprise/collab/
│   │       ├── config/       # Configuration classes
│   │       ├── controller/   # REST controllers
│   │       ├── dto/          # Data Transfer Objects
│   │       ├── entity/       # JPA entities
│   │       ├── exception/    # Exception handling
│   │       ├── repository/   # Data repositories
│   │       ├── security/     # JWT & security
│   │       └── service/      # Business logic
│   └── pom.xml
├── frontend-desktop/          # Electron + React client
├── docs/                     # Documentation
└── scripts/                  # Deployment scripts
```

## Quick Start

### Prerequisites

- Java 21+
- MySQL 8.0+
- Node.js 18+
- Maven 3.8+

### Backend Setup

```bash
# Build the backend
cd backend
./mvnw clean package -DskipTests

# Run the backend
java -jar target/enterprise-collab.jar
```

### Frontend Setup

```bash
# Install dependencies
cd frontend-desktop
npm install

# Run in development mode
npm run dev
```

### Production Build

```bash
# Build desktop client
npm run build
```

## Configuration

### Database Configuration

Edit `backend/src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/enterprise_collab
    username: your_username
    password: your_password
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SERVER_PORT` | Server port (default: 8082) |
| `DB_HOST` | Database host |
| `DB_PORT` | Database port |
| `DB_NAME` | Database name |
| `DB_USERNAME` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing key |
| `JWT_EXPIRATION` | JWT token expiration (ms) |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration (ms) |
| `STORAGE_PATH` | File storage path |

## API Documentation

The API is documented using OpenAPI/Swagger. After starting the server, visit:

- Swagger UI: http://localhost:8082/swagger-ui.html
- OpenAPI JSON: http://localhost:8082/v3/api-docs

## Authentication

The API uses JWT tokens for authentication. All authenticated endpoints require the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register a new user |
| POST | /api/v1/auth/login | Login and get tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout and revoke tokens |
| GET | /api/v1/auth/me | Get current user |
| PUT | /api/v1/auth/profile | Update user profile |
| POST | /api/v1/auth/change-password | Change password |
| GET | /api/v1/auth/users/search | Search users |

## Features

### Rate Limiting
The API includes rate limiting to prevent abuse. Default: 100 requests per minute per IP.

### WebSocket
Real-time features use WebSocket with STOMP protocol:
- Chat messages
- Call signaling
- Presence updates

### Code Execution
Supported languages:
- Python
- Java
- JavaScript/Node.js
- Go
- Rust
- C/C++

## Architecture

### Security Model

1. **Authentication**: JWT-based token authentication with refresh tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Code Isolation**: Users work in isolated temporary workspaces
4. **Audit Logging**: All actions logged for compliance
5. **Rate Limiting**: Prevent API abuse

### Real-time Communication

- WebSocket with STOMP protocol for chat
- WebRTC signaling server for video calls
- Presence system for user status

### Storage

All data stored locally on server:
- `/opt/company-platform/repos/` - Git repositories
- `/opt/company-platform/user-workspaces/` - User workspaces
- `/opt/company-platform/uploads/` - File uploads

## Default Credentials

After first run, use these credentials:
- Username: `admin`
- Password: `admin123`

**Change the password immediately after first login!**

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact your system administrator.
