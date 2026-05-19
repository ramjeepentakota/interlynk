# Enterprise Collaboration Platform - Installation Guide

This guide covers the complete installation process for the Enterprise Collaboration Platform on a Linux server without Docker or Kubernetes.

## System Requirements

### Hardware Requirements
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ for repositories and workspaces
- **Network**: Static IP recommended

### Software Requirements
- **OS**: Ubuntu 20.04 LTS or later (Debian-based Linux)
- **Java**: OpenJDK 21 or later
- **MySQL**: MySQL 8.0+
- **Node.js**: 18.x or later (for building frontend)
- **Git**: Latest version

---

## Step 1: System Preparation

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Required Packages
```bash
sudo apt install -y openjdk-21-jdk mysql-server git curl wget
```

### Verify Java Installation
```bash
java -version
# Should show: openjdk version "21.x.x"
```

---

## Step 2: MySQL Setup

### Start MySQL Service
```bash
sudo systemctl start mysql
sudo systemctl enable mysql
```

### Secure MySQL Installation
```bash
sudo mysql_secure_installation
```
Follow the prompts to set a root password and secure the installation.

### Create Database and User
```bash
sudo mysql -u root -p
```

In MySQL shell:
```sql
CREATE DATABASE enterprise_collab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'collabuser'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON enterprise_collab.* TO 'collabuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 3: Application Setup

### Create Application Directory
```bash
sudo mkdir -p /opt/company-platform
sudo mkdir -p /opt/company-platform/repos
sudo mkdir -p /opt/company-platform/user-workspaces
sudo mkdir -p /opt/company-platform/uploads
sudo mkdir -p /opt/company-platform/recordings
sudo mkdir -p /opt/company-platform/logs
sudo mkdir -p /var/log/enterprise-collab
```

### Set Permissions
```bash
sudo chown -R $USER:$USER /opt/company-platform
sudo chmod -R 755 /opt/company-platform
```

---

## Step 4: Build Backend

### Navigate to Project Directory
```bash
cd /path/to/enterprise-collab/backend
```

### Update Database Configuration
Edit `src/main/resources/application.yml` and update MySQL credentials:
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/enterprise_collab?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
    username: collabuser
    password: YourSecurePassword123!
```

### Build with Maven
```bash
./mvnw clean package -DskipTests
```

Or if you have Maven installed:
```bash
mvn clean package -DskipTests
```

The JAR file will be created at:
`target/enterprise-collab-1.0.0.jar`

---

## Step 5: Configure Systemd Service

### Create Service File
```bash
sudo nano /etc/systemd/system/enterprise-collab.service
```

Add the following content:
```ini
[Unit]
Description=Enterprise Collaboration Platform
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/company-platform
ExecStart=/usr/bin/java -jar /path/to/enterprise-collab/backend/target/enterprise-collab-1.0.0.jar
Environment="JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64"
Environment="SERVER_PORT=8080"
StandardOutput=append:/var/log/enterprise-collab/stdout.log
StandardError=append:/var/log/enterprise-collab/stderr.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable enterprise-collab
sudo systemctl start enterprise-collab
```

### Check Service Status
```bash
sudo systemctl status enterprise-collab
```

---

## Step 6: Build Desktop Client (Optional)

### Install Node.js Dependencies
```bash
cd /path/to/enterprise-collab/frontend-desktop
npm install
```

### Build for Development
```bash
npm run dev
```

### Build for Production (Windows Installer)
```bash
npm run build
```

The installer will be created at:
`frontend-desktop/release/win-unpacked/`

---

## Step 7: Verify Installation

### Check Backend API
```bash
curl http://localhost:8080/api/health
```

Expected response: `{"status":"UP"}`

### Access Admin Panel
Open browser and navigate to: `http://localhost:8080`

Default admin credentials (change immediately):
- Username: `admin`
- Password: `admin123`

---

## Configuration Options

### Application Properties

Key settings in `application.yml`:

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/enterprise_collab
    username: collabuser
    password: YourPassword
  jpa:
    hibernate:
      ddl-auto: update

app:
  storage:
    base-path: /opt/company-platform
  jwt:
    secret: YourSuperSecretKeyChangeThisInProduction
    expiration: 86400000
  cors:
    allowed-origins: http://localhost:5173,http://localhost:3000
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | 8080 |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_NAME` | Database name | enterprise_collab |
| `DB_USERNAME` | Database user | collabuser |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing key | - |
| `STORAGE_PATH` | File storage path | /opt/company-platform |

---

## Troubleshooting

### Check Logs
```bash
# Application logs
tail -f /var/log/enterprise-collab/stdout.log

# Error logs
tail -f /var/log/enterprise-collab/stderr.log
```

### Common Issues

1. **MySQL Connection Failed**
   - Check MySQL is running: `sudo systemctl status mysql`
   - Verify credentials in application.yml
   - Check firewall: `sudo ufw allow 3306`

2. **Port Already in Use**
   - Find process: `sudo lsof -i :8080`
   - Kill process or change port in application.yml

3. **OutOfMemory Errors**
   - Increase JVM heap in systemd service:
   ```ini
   ExecStart=/usr/bin/java -Xmx4g -jar ...
   ```

---

## Next Steps

1. Create teams in Admin Panel
2. Add users and assign roles
3. Create repositories for code collaboration
4. Install desktop client on employee machines
5. Configure SSL/TLS for production (recommended)

---

## Support

For issues and questions, please refer to the project documentation or contact your system administrator.
