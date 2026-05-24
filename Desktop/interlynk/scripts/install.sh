#!/bin/bash

# Enterprise Collaboration Platform - Installation Script
# Run as: sudo bash install.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Enterprise Collaboration Platform Installer${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update -y

# Install Java 21
echo -e "${YELLOW}Installing Java 21...${NC}"
apt-get install -y openjdk-21-jdk

# Install MySQL 8
echo -e "${YELLOW}Installing MySQL 8...${NC}"
apt-get install -y mysql-server

# Configure MySQL
echo -e "${YELLOW}Configuring MySQL...${NC}"
systemctl enable mysql
systemctl start mysql

# Secure MySQL installation
# The DB password must be provided via the environment — never hardcode secrets
# in this script (it is committed to source control).
if [ -z "${DB_PASSWORD}" ]; then
    echo -e "${RED}DB_PASSWORD is not set. Run: DB_PASSWORD='your-strong-password' sudo -E bash install.sh${NC}"
    exit 1
fi
echo -e "${YELLOW}Setting up MySQL root password...${NC}"
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}';"
mysql -e "FLUSH PRIVILEGES;"

# Create database
echo -e "${YELLOW}Creating database...${NC}"
mysql -uroot -p"${DB_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS interlynk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Install Git (for code collaboration)
echo -e "${YELLOW}Installing Git...${NC}"
apt-get install -y git

# Install Python (for code execution)
echo -e "${YELLOW}Installing Python...${NC}"
apt-get install -y python3 python3-pip

# Install Node.js (for code execution)
echo -e "${YELLOW}Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Go (for code execution)
echo -e "${YELLOW}Installing Go...${NC}"
apt-get install -y golang-go

# Install C++ compiler
echo -e "${YELLOW}Installing C++ compiler...${NC}"
apt-get install -y g++

# Create application user
echo -e "${YELLOW}Creating application user...${NC}"
useradd -m -s /bin/bash enterprise 2>/dev/null || true

# Create directory structure
echo -e "${YELLOW}Creating directory structure...${NC}"
mkdir -p /opt/company-platform/{repos,user-workspaces,uploads,recordings,logs}
chown -R enterprise:enterprise /opt/company-platform

# Set permissions
chmod -R 755 /opt/company-platform

# Build the application
echo -e "${YELLOW}Building application...${NC}"
cd /opt/company-platform

# Build backend
cd backend
mvn clean package -DskipTests

# Copy JAR file
cp target/enterprise-collab.jar /opt/company-platform/

# Set ownership
chown enterprise:enterprise /opt/company-platform/enterprise-collab.jar

# Copy systemd service file
echo -e "${YELLOW}Setting up systemd service...${NC}"
cp /opt/company-platform/scripts/enterprise-collab.service /etc/systemd/system/
systemctl daemon-reload

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8080/tcp  # Application
ufw --force enable

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update application.yml with your database credentials"
echo "2. Start the service: systemctl start enterprise-collab"
echo "3. Enable at boot: systemctl enable enterprise-collab"
echo "4. Check status: systemctl status enterprise-collab"
echo ""
echo -e "${YELLOW}Admin login:${NC}"
echo "Username: admin"
echo "Password: value of ADMIN_INITIAL_PASSWORD (defaults to admin@123 — change immediately)"
echo ""
echo -e "${YELLOW}Access the application at:${NC}"
echo "http://your-server-ip:8080"
