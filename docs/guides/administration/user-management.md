# User Management

Guide to managing users and access control through the admin panel.

---

## Overview

Allo-Scrapper uses a role-based access control system with two distinct user roles:

- **Admin**: Full system access including settings, user management, and all operations
- **User**: Read-only access to view films, showtimes, and cinemas

This guide covers managing user accounts through the admin panel interface. For API-based user management, see the [Users API Reference](../../reference/api/users.md).

**Who should use this guide:**
- System administrators managing user accounts
- Non-technical staff with admin access
- Anyone responsible for user onboarding and access control

---

## Accessing User Management

### Prerequisites

- Admin role account
- Active login session
- Access to the admin panel

### Navigation Steps

1. **Login to the application**
   - Navigate to the homepage
   - Click "Login" in the top-right corner
   - Enter your admin credentials
   - Click "Login"

2. **Access User Management**
   - Click your username in the top-right corner
   - Select **"Users"** from the dropdown menu
   - Navigate to `/admin/users`

> **Note**: Only users with admin role can access user management features. Regular users will not see the "Users" option in their dropdown menu.

---

## User Roles Explained

### Admin Role

**Permissions:**
- **Settings Management**: Modify branding, colors, typography, footer, email settings
- **User Management**: Create, edit, delete users; change roles; reset passwords
- **Cinema Management**: Add, edit, remove cinemas; trigger scraping operations
- **System Access**: View system diagnostics, database statistics, migration status
- **Configuration**: Export/import settings, reset to defaults

**Use Cases:**
- System administrators
- IT staff responsible for application maintenance
- Trusted personnel managing the cinema portal

### User Role

**Permissions:**
- **Read-Only Access**: View films, showtimes, and cinema information
- **Search and Filter**: Use all search and filtering features
- **Basic Navigation**: Access all public pages and content

**Restrictions:**
- Cannot modify any settings or configuration
- Cannot manage other users
- Cannot access admin panel features
- Cannot perform administrative operations

**Use Cases:**
- General staff viewing cinema schedules
- Customer service representatives
- Anyone needing read-only access to cinema data

---

## Creating New Users

### Via Admin Panel

**Step-by-step instructions:**

1. **Navigate to User Management**
   - Access `/admin/users` as described above

2. **Initiate User Creation**
   - Click the **"+ Create User"** button
   - User creation form opens

3. **Fill Required Information**
   - **Username**: Enter unique username (see requirements below)
   - **Password**: Enter secure password (see requirements below)
   - **Role**: Select either "admin" or "user" (defaults to "user")

4. **Submit Form**
   - Click **"Create User"** button
   - New user appears in the user list
   - Success message confirms creation

### Username Rules

**Requirements:**
- **Length**: 3-15 characters
- **Allowed characters**: Letters (a-z, A-Z) and numbers (0-9) only
- **No special characters**: Spaces, underscores, hyphens, or symbols not allowed
- **Case-sensitive**: "Admin" and "admin" are different usernames
- **Must be unique**: Cannot duplicate existing usernames

**Valid examples:**
- `admin`
- `user123`
- `JohnDoe`
- `viewer2024`

**Invalid examples:**
- `ab` (too short)
- `this-is-too-long-username` (too long)
- `user_name` (underscore not allowed)
- `user-123` (hyphen not allowed)
- `user name` (space not allowed)

### Password Requirements

**Security requirements:**
- **Minimum 8 characters**
- **At least one uppercase letter** (A-Z)
- **At least one lowercase letter** (a-z)
- **At least one digit** (0-9)
- **At least one special character** (!@#$%^&*(),.?":{}|<>)

**Valid examples:**
- `SecurePass123!`
- `MyP@ssw0rd`
- `Admin2024#`
- `Cinema$123`

**Invalid examples:**
- `password` (no uppercase, digit, or special character)
- `PASSWORD123` (no lowercase or special character)
- `Pass123` (too short, no special character)
- `MyPassword` (no digit or special character)

### Default Role Assignment

- **Default role**: "user" (read-only access)
- **Admin role**: Must be explicitly selected during creation
- **Role can be changed**: After creation via role update feature

---

## Managing Existing Users

### Viewing Users

**User List Display:**
- **Username**: Unique identifier for the user
- **Role**: Current role (admin/user) with colored badges
- **Created Date**: When the account was created
- **Actions**: Available operations (Edit, Delete)

**List Features:**
- **Sorting**: Click column headers to sort by username, role, or date
- **Search**: Filter users by username (if search feature available)
- **Pagination**: Navigate through multiple pages of users

### Updating User Roles

**How to change user role:**

1. **Locate User**
   - Find the user in the user list
   - Identify current role badge

2. **Access Role Editor**
   - Click **"Edit"** button next to the user
   - Role selection dropdown appears

3. **Change Role**
   - Select new role: "admin" or "user"
   - Confirm the change
   - Role badge updates immediately

**Security Considerations:**
- **Last Admin Protection**: Cannot demote the last admin user to prevent system lockout
- **Immediate Effect**: Role changes take effect immediately
- **Session Impact**: User may need to logout/login to see new permissions

**Best Practices:**
- **Principle of Least Privilege**: Assign minimal required role
- **Regular Reviews**: Periodically audit user roles
- **Document Changes**: Keep record of who has admin access
- **Avoid Unnecessary Admins**: Limit admin accounts to essential personnel

### Resetting Passwords

**Admin-initiated password reset:**

1. **Select User**
   - Locate user in the user list
   - Click **"Edit"** or **"Reset Password"** button

2. **Generate New Password**
   - System generates secure random password
   - Password meets all security requirements
   - Temporary password displayed once

3. **Communicate Securely**
   - Copy the generated password
   - Share with user through secure channel (not email)
   - Instruct user to change password on first login

**Important Notes:**
- **One-time Display**: Password shown only once, cannot be retrieved later
- **Immediate Effect**: Old password becomes invalid immediately
- **Security**: New password meets all complexity requirements
- **User Action Required**: User should change password on first login

### Deleting Users

**How to delete a user account:**

1. **Locate User**
   - Find user in the user list
   - Ensure this is the correct user to delete

2. **Initiate Deletion**
   - Click **"Delete"** button next to user
   - Confirmation dialog appears

3. **Confirm Action**
   - Read warning about irreversible action
   - Click **"Confirm Delete"** or **"Yes, Delete"**
   - User removed from list immediately

**Safety Guards:**
- **Cannot delete your own account**: Prevents accidental self-lockout
- **Cannot delete last admin**: Prevents system lockout
- **Confirmation required**: Prevents accidental deletion

**Irreversible Action Warning:**
- User account and all associated data permanently removed
- Cannot be undone or recovered
- User will immediately lose access to the system

---

## Role-Based Access Control

### Admin Permissions

**Complete list of admin-only operations:**

**Settings Management:**
- Modify site name, logo, favicon
- Change color scheme and typography
- Update footer text and links
- Configure email branding

**User Management:**
- Create new user accounts
- Change user roles (admin ↔ user)
- Reset user passwords
- Delete user accounts
- View user list and details

**Cinema Management:**
- Add new cinemas to the system
- Edit cinema information
- Remove cinemas
- Trigger manual scraping operations

**System Operations:**
- View system diagnostics and health
- Monitor database statistics
- Check migration status
- Export/import configuration
- Reset settings to defaults

### User Permissions

**Read-only operations available to regular users:**

**Content Viewing:**
- Browse all films and showtimes
- View cinema information and locations
- Access search and filtering features
- View detailed film information

**Navigation:**
- Access all public pages
- Use search functionality
- Navigate between different sections
- View responsive mobile interface

**What users cannot do:**
- Access admin panel (`/admin/*` routes)
- Modify any settings or configuration
- Manage other user accounts
- Add or remove cinemas
- View system diagnostics
- Export or import settings

### Security Considerations

**Principle of Least Privilege:**
- Assign minimum role required for user's responsibilities
- Regular users should not have admin access unless necessary
- Review and audit permissions regularly

**Regular Access Audits:**
- Monthly review of all user accounts
- Remove inactive or unnecessary accounts
- Verify admin users still require elevated access
- Document reasons for admin role assignments

**Avoid Unnecessary Admin Accounts:**
- Limit admin accounts to essential personnel only
- Use regular user accounts for day-to-day operations
- Create admin accounts only when administrative tasks are required

---

## Best Practices

### User Account Management

**Create users only when needed:**
- Avoid creating accounts "just in case"
- Create accounts when user actually needs access
- Remove accounts when user no longer needs access

**Use descriptive usernames:**
- Include user's name or role when appropriate
- Avoid generic names like "user1", "temp"
- Make usernames easy to identify and remember

**Assign minimal required role:**
- Start with "user" role by default
- Promote to "admin" only when necessary
- Regularly review and downgrade unnecessary admin access

**Regular password changes:**
- Encourage users to change passwords periodically
- Reset passwords for inactive accounts
- Use strong passwords that meet all requirements

**Periodic access reviews:**
- Monthly audit of all user accounts
- Quarterly review of admin role assignments
- Annual comprehensive access review
- Document review findings and actions taken

### Security

**Strong password enforcement:**
- Ensure all passwords meet complexity requirements
- Educate users about password security
- Consider password managers for complex passwords

**Limit admin accounts:**
- Maintain minimum number of admin users
- Create backup admin account for emergency access
- Document who has admin access and why

**Monitor user activity:**
- Review login patterns for unusual activity
- Monitor admin actions through system logs
- Investigate suspicious or unauthorized access

**Remove inactive accounts:**
- Identify accounts not used for 90+ days
- Disable or delete accounts for departed users
- Maintain clean, current user list

**Document role assignments:**
- Keep record of who has admin access
- Document business justification for admin roles
- Update documentation when roles change

---

## Common Workflows

### Onboarding New Administrator

**Complete process for adding admin user:**

1. **Create User Account**
   - Navigate to `/admin/users`
   - Click "+ Create User"
   - Enter username following naming conventions
   - Generate secure password
   - Select "admin" role

2. **Verify Account Creation**
   - Confirm user appears in user list
   - Verify role badge shows "admin"
   - Check creation timestamp

3. **Communicate Credentials Securely**
   - Share username and password through secure channel
   - Avoid sending credentials via email
   - Use encrypted messaging or in-person delivery

4. **Force Password Change on First Login**
   - Instruct user to login immediately
   - Require password change on first access
   - Verify user can access admin features

5. **Verify Permissions**
   - Test access to admin panel
   - Confirm user can perform required admin tasks
   - Document admin access in security records

### Onboarding Read-Only User

**Process for adding regular user:**

1. **Create User Account**
   - Navigate to `/admin/users`
   - Click "+ Create User"
   - Enter descriptive username
   - Generate secure password
   - Leave role as "user" (default)

2. **Verify Read-Only Access**
   - Confirm user appears in list with "user" role
   - Test login with new credentials
   - Verify user cannot access admin features

3. **Communicate Access Information**
   - Share login credentials securely
   - Provide brief orientation on available features
   - Explain read-only nature of their access

### Removing User Access

**Complete process for user removal:**

1. **Locate User in Admin Panel**
   - Navigate to `/admin/users`
   - Find user in the user list
   - Verify this is the correct user to remove

2. **Delete User Account**
   - Click "Delete" button next to user
   - Read confirmation dialog carefully
   - Click "Confirm Delete" to proceed

3. **Confirm Action**
   - Verify user no longer appears in user list
   - Confirm user cannot login with old credentials
   - Update any documentation referencing the user

4. **Verify Removal**
   - Test that deleted username cannot login
   - Ensure user has no remaining system access
   - Document the removal in security logs

---

## Troubleshooting

### Common Issues

#### "User cannot login"

**Symptoms:**
- User enters credentials but login fails
- "Invalid username or password" error message
- User reports being locked out

**Solutions:**
1. **Verify username/password accuracy**
   - Check for typos in username
   - Verify password meets requirements
   - Confirm caps lock status

2. **Check account exists**
   - Search for user in admin panel user list
   - Verify username spelling matches exactly
   - Confirm account wasn't accidentally deleted

3. **Reset password**
   - Use admin panel to reset user's password
   - Generate new secure password
   - Communicate new password securely to user

#### "Access denied" errors

**Symptoms:**
- User can login but gets "Access denied" or "Forbidden" errors
- User cannot access expected features
- Permission-related error messages

**Solutions:**
1. **Verify user role matches required permissions**
   - Check user's role in admin panel
   - Confirm role matches access requirements
   - Upgrade to admin role if necessary

2. **Check specific feature requirements**
   - Some features require admin role
   - Verify user is accessing appropriate sections
   - Review role-based access control rules

#### "Cannot delete user" errors

**Symptoms:**
- Delete button doesn't work
- Error message when attempting deletion
- User remains in list after delete attempt

**Solutions:**
1. **Cannot delete own account**
   - System prevents self-deletion for safety
   - Login with different admin account to delete
   - This is expected behavior, not a bug

2. **Cannot delete last admin**
   - System prevents deletion of last admin user
   - Create another admin user first
   - Then delete the original admin if needed

3. **Verify admin privileges**
   - Confirm you're logged in as admin
   - Regular users cannot delete accounts
   - Check role badge in user dropdown

#### "Password rejected" errors

**Symptoms:**
- Password doesn't meet requirements
- Form validation errors
- Cannot create or reset password

**Solutions:**
1. **Ensure password meets all requirements**
   - Minimum 8 characters
   - At least one uppercase letter (A-Z)
   - At least one lowercase letter (a-z)
   - At least one digit (0-9)
   - At least one special character

2. **Check for hidden characters**
   - Avoid copying passwords from documents
   - Type password manually
   - Check for extra spaces or invisible characters

### Safety Guards

**System protections in place:**

#### Cannot delete your own admin account
- **Purpose**: Prevents accidental lockout
- **Behavior**: Delete button disabled for your own account
- **Workaround**: Login with different admin to delete account

#### Username must be unique
- **Purpose**: Prevents duplicate accounts
- **Behavior**: Error message if username already exists
- **Solution**: Choose different username

#### Role changes require admin privileges
- **Purpose**: Prevents privilege escalation
- **Behavior**: Only admins can change user roles
- **Security**: Regular users cannot promote themselves

#### Last admin protection
- **Purpose**: Prevents complete admin lockout
- **Behavior**: Cannot demote or delete the last admin user
- **Workaround**: Create another admin first, then modify original

---

## Related Documentation

- [Admin Panel Guide](./admin-panel.md) - Complete admin panel reference
- [Users API Reference](../../reference/api/users.md) - API documentation for developers
- [Security Policy](../../project/security.md) - Security best practices and policies
- [Authentication API Reference](../../reference/api/auth.md) - API authentication endpoints
- [Quick Start](../../getting-started/quick-start.md) - Initial setup and configuration

---

**Last updated:** March 4, 2026

[← Back to Administration Guides](./README.md)