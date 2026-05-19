# Enterprise Collaboration Platform - Admin Manual

This manual covers all administrative tasks for the Enterprise Collaboration Platform.

---

## Getting Started

### Accessing Admin Panel

1. Log in with admin credentials
2. Click on the **Admin** icon in the sidebar
3. You will see the admin dashboard

---

## Dashboard Overview

The admin dashboard provides a quick view of:

- **Active Users**: Number of currently online users
- **Active Calls**: Number of ongoing voice/video calls
- **Disk Usage**: Total disk space used by the system
- **Storage Usage**: Storage used for uploads and workspaces

---

## User Management

### Creating Users

1. Navigate to **Users** tab
2. Click **Add User** button
3. Fill in user details:
   - **Username**: Unique identifier
   - **Email**: User's email address
   - **Password**: Temporary password
   - **Role**: Select appropriate role
4. Click **Create User**

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | System administrator | Full access, user management, system config |
| **Manager** | Team lead | Code review, team management |
| **Employee** | Regular user | Chat, calls, workspace editing |

### Managing Users

- **View Users**: See all registered users in the table
- **Delete User**: Click trash icon to remove user
- **Edit User**: Click on user row to view details

---

## Team Management

### Creating Teams

1. Navigate to **Teams** tab
2. Click **Add Team** button
3. Enter team details:
   - **Name**: Team name (e.g., Engineering, Marketing)
   - **Description**: Brief team description
4. Click **Create Team**

### Managing Teams

- Teams organize users for collaboration
- Each team can have multiple projects
- Add users to teams through user management

---

## Project/Repository Management

### Creating Projects

1. Navigate to **Projects** tab
2. Click **Add Project** button
3. Enter project details:
   - **Name**: Project identifier
   - **Description**: Project description
   - **Team**: Select team to own the project
4. Click **Create Project**

### Project Features

- Each project gets a Git repository on the server
- Users create personal workspaces from projects
- Code review workflow available for all projects

---

## System Monitoring

### Viewing Logs

Navigate to **System Logs** tab to see:

- User login/logout events
- Code submissions and reviews
- Administrative actions
- System errors

Log entries include:
- Timestamp
- Username
- Action performed
- Details

### System Health

Monitor these key metrics:

1. **Active Users**: Check user activity
2. **Active Calls**: Monitor call usage
3. **Disk Space**: Ensure adequate storage
4. **Performance**: Check response times

---

## Security Best Practices

### Password Policy

- Enforce strong passwords
- Change default admin password immediately
- Regular password updates recommended

### Access Control

- Assign minimum necessary permissions
- Review user roles periodically
- Remove inactive users

### Audit Logs

- Regularly review audit logs
- Look for unusual activity
- Export logs for compliance

---

## Troubleshooting

### Common Issues

**Users Cannot Login**
- Check user is enabled
- Verify correct credentials
- Check user role assignments

**Cannot Create Projects**
- Ensure team exists
- Check disk space
- Verify admin permissions

**Workspace Issues**
- Check storage permissions
- Verify repository exists
- Check disk quota

---

## System Settings

### Configuration Options

Key settings in admin panel:

1. **Session Timeout**: Configure session duration
2. **Max Upload Size**: Limit file upload size
3. **Code Execution Timeout**: Set max execution time

### Backup Recommendations

Regular backups should include:

1. MySQL database
2. `/opt/company-platform/repos` directory
3. `/opt/company-platform/uploads` directory
4. Application logs

---

## Support

For additional help:

1. Check logs in Admin Panel
2. Review API documentation
3. Contact system administrator
