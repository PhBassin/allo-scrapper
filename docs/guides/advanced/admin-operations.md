# Advanced RBAC & Admin Operations

Master role-based access control, permission design patterns, and operational playbooks for managing complex user hierarchies and administrative tasks.

**Last updated:** March 18, 2026

---

## Table of Contents

- [Overview](#overview)
- [RBAC Design Patterns](#rbac-design-patterns)
- [Custom Role Templates](#custom-role-templates)
- [Permission Delegation Models](#permission-delegation-models)
- [Theme Management Workflows](#theme-management-workflows)
- [Disaster Recovery](#disaster-recovery)
- [Audit & Compliance](#audit--compliance)
- [Troubleshooting](#troubleshooting)

---

## Overview

Allo-Scrapper's Role-Based Access Control (RBAC) system manages user permissions across 7 categories (users, scraper, cinemas, settings, reports, system, roles) with 26 granular permissions. This guide covers operational patterns for enterprise deployments.

### Key RBAC Concepts

**System Roles** (Built-in, Protected):
- `admin` – Full access via bypass mechanism
- `operator` – Scraping + cinema management (9 specific permissions)

**Custom Roles** (User-created, Flexible):
- Any combination of the 26 permissions
- Can be edited/deleted (with guards)
- Cannot be deleted if users are assigned

**Admin Bypass Mechanism**:
- Only the system `admin` role (not custom roles named "admin") gets all permissions
- Prevents privilege escalation attacks
- JWT contains all 26 permissions for admin users

### Permission Categories (26 Total)

| Category | Permissions | Typical Users |
|----------|-------------|---------------|
| **users** (5) | create, read, update, delete, list | Admins, Team Leads |
| **scraper** (2) | trigger, trigger_single | Operators, Content Teams |
| **cinemas** (4) | create, read, update, delete | Operators, Content Teams |
| **settings** (5) | read, update, reset, export, import | Admins, System Engineers |
| **reports** (2) | list, view | Operators, Analytics Team |
| **system** (3) | info, health, migrations | System Engineers, DevOps |
| **roles** (5) | list, read, create, update, delete | Admins Only |

**Reference**: See `docs/reference/roles-and-permissions.md` for complete API documentation.

---

## RBAC Design Patterns

### Pattern 1: Multi-Team Organization

For organizations with separate content, operations, and technical teams:

```sql
-- Team Leads (can manage their team's users but not access settings)
INSERT INTO roles (name, description) VALUES (
  'content_lead',
  'Content Team Lead - User management, cinema/scraper operations'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'content_lead'
AND p.name IN (
  'users:read', 'users:create', 'users:update',  -- Manage team members
  'cinemas:read', 'cinemas:create', 'cinemas:update', 'cinemas:delete',
  'scraper:trigger', 'scraper:trigger_single',
  'reports:list', 'reports:view'
);

-- Operations (read-only access, no changes)
INSERT INTO roles (name, description) VALUES (
  'viewer',
  'Read-Only Viewer - Monitor cinemas and reports without changes'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
AND p.name IN (
  'cinemas:read', 'reports:list', 'reports:view',
  'system:info', 'system:health'
);

-- Verify roles created
SELECT name, description FROM roles WHERE is_system = false;
```

**Usage:**
```typescript
// API: Create user with content_lead role
POST /api/users
{
  "username": "alice",
  "password": "secure_password_123",
  "role_id": 3  // content_lead role ID
}
```

### Pattern 2: Role Hierarchy (Pyramid)

For organizations with clear escalation paths:

```
Admin (all permissions)
  ↓
Manager (users:read, create, update + report perms)
  ↓
Operator (scraper:trigger, cinemas:*, reports:view)
  ↓
Viewer (read-only: cinemas:read, reports:view)
```

**Implementation:**

```sql
-- Viewer: Minimal permissions (read-only)
INSERT INTO roles (name, description) VALUES ('viewer', 'Read-only access');

-- Operator: Viewer + execution permissions
INSERT INTO roles (name, description) VALUES ('operator', 'Execute scraping tasks');

-- Manager: Operator + user management
INSERT INTO roles (name, description) VALUES ('manager', 'Team management + operations');

-- Verify hierarchy
WITH role_hierarchy AS (
  SELECT 
    r.name,
    COUNT(rp.permission_id) as perm_count,
    ARRAY_AGG(p.name) as perms
  FROM roles r
  LEFT JOIN role_permissions rp ON r.id = rp.role_id
  LEFT JOIN permissions p ON rp.permission_id = p.id
  WHERE r.is_system = false
  GROUP BY r.id, r.name
  ORDER BY perm_count ASC
)
SELECT name, perm_count, perms FROM role_hierarchy;

-- Output:
-- viewer      | 3 | {cinemas:read, reports:list, reports:view}
-- operator    | 9 | {... + scraper:trigger, scraper:trigger_single}
-- manager     | 13| {... + users:read, users:create, users:update}
-- admin (sys) | 26| {ALL}
```

### Pattern 3: Attribute-Based Access (ABAC Simulation)

For cinema-specific permissions, implement in application layer above RBAC:

```typescript
// server/src/middleware/cinema-access.ts
// Simulate ABAC by filtering cinemas based on user attributes

interface UserAttributes {
  userId: number;
  role: string;
  assignedCinemaIds?: number[];  // Add custom field to users table
  region?: string;               // Regional restriction
}

async function getCinemasForUser(user: UserAttributes): Promise<Cinema[]> {
  const allCinemas = await getCinemas();
  
  // Operator can only manage assigned cinemas
  if (user.role === 'operator' && user.assignedCinemaIds) {
    return allCinemas.filter(c => user.assignedCinemaIds!.includes(c.id));
  }
  
  // Regional manager can only access their region
  if (user.role === 'regional_manager' && user.region) {
    return allCinemas.filter(c => c.region === user.region);
  }
  
  // Admin/manager get all cinemas
  return allCinemas;
}

// Usage in routes
router.get('/api/cinemas', async (req, res) => {
  const cinemas = await getCinemasForUser(req.user);
  res.json(cinemas);
});
```

**Database Extension:**

```sql
-- Extend users table with attributes
ALTER TABLE users ADD COLUMN assigned_cinema_ids INTEGER[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN region VARCHAR(100);

-- Example: Operator assigned to specific cinemas
UPDATE users 
SET assigned_cinema_ids = ARRAY[1, 5, 12]
WHERE username = 'regional_operator';
```

---

## Custom Role Templates

### Template 1: Content Manager Role

**For teams managing cinema listings and schedules:**

```sql
INSERT INTO roles (name, description) VALUES (
  'content_manager',
  'Manage cinemas and schedules, trigger scraping'
);

-- 8 permissions total
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'content_manager'
AND p.name IN (
  -- Scraping
  'scraper:trigger',
  'scraper:trigger_single',
  -- Cinema management
  'cinemas:create',
  'cinemas:read',
  'cinemas:update',
  'cinemas:delete',
  -- Reports
  'reports:list',
  'reports:view'
);

-- Verify
SELECT p.name FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'content_manager'
ORDER BY p.name;
```

**Typical Users:**
- Content team leads
- Cinema data managers
- Scheduling coordinators

### Template 2: Analyst Role

**For teams analyzing scraping reports and system health:**

```sql
INSERT INTO roles (name, description) VALUES (
  'analyst',
  'View reports and system health, read-only access'
);

-- 5 permissions: reporting + monitoring
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'analyst'
AND p.name IN (
  'reports:list',
  'reports:view',
  'system:info',
  'system:health',
  'cinemas:read'
);
```

**Typical Users:**
- Analytics team
- Business intelligence engineers
- Quality assurance specialists

### Template 3: System Engineer Role

**For teams managing infrastructure and deployments:**

```sql
INSERT INTO roles (name, description) VALUES (
  'system_engineer',
  'System monitoring, database migrations, settings management'
);

-- 10 permissions: system operations + settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'system_engineer'
AND p.name IN (
  'system:info',
  'system:health',
  'system:migrations',
  'settings:read',
  'settings:update',
  'settings:reset',
  'settings:export',
  'settings:import',
  'roles:list',
  'roles:read'
);
```

**Typical Users:**
- DevOps engineers
- Site reliability engineers (SREs)
- Database administrators

### Template 4: Restricted Operator Role

**For temporary contractors or limited-access operators:**

```sql
INSERT INTO roles (name, description) VALUES (
  'restricted_operator',
  'Trigger scraping only, read-only cinema/report access'
);

-- 5 minimal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'restricted_operator'
AND p.name IN (
  'scraper:trigger_single',  -- Single cinema only
  'cinemas:read',
  'reports:list',
  'reports:view',
  'system:health'  -- Monitor health without full system access
);
```

**Typical Users:**
- Contractors
- Third-party integrations
- Temporary staff

---

## Permission Delegation Models

### Model 1: Delegate-All (Trust Everyone)

Admin trusts managers to manage their teams without oversight:

```typescript
// Manager creates/modifies operators without admin approval
async function createOperator(managerReq, req, res) {
  // Manager has users:create permission
  const newUser = await createUser(db, {
    username: req.body.username,
    password: req.body.password,
    roleId: OPERATOR_ROLE_ID,
  });
  
  res.json(newUser);
}
```

**Risks:**
- No audit trail of who created users
- No approval workflow
- Fast privilege escalation if manager account compromised

**Mitigation:**
```sql
-- Add audit logging
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES users(id),
  action VARCHAR(100),
  target_type VARCHAR(50),
  target_id INT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Log all user creations
INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
VALUES (
  req.user.id,
  'CREATE_USER',
  'user',
  newUser.id,
  jsonb_build_object('username', newUser.username, 'role_id', newUser.role_id)
);
```

### Model 2: Approval Workflow

Admin must approve role assignments before they take effect:

```typescript
// server/src/services/role-approval.ts

interface RoleAssignmentRequest {
  id: number;
  userId: number;
  requestedRoleId: number;
  requestedBy: number;
  approvedBy?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
}

// Create pending assignment request
async function requestRoleAssignment(
  db: Database,
  userId: number,
  roleId: number,
  requestedBy: number
): Promise<RoleAssignmentRequest> {
  return await db.query(
    `INSERT INTO role_assignment_requests 
     (user_id, requested_role_id, requested_by, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [userId, roleId, requestedBy]
  );
}

// Admin approves assignment
async function approveRoleAssignment(
  db: Database,
  requestId: number,
  approvedBy: number
): Promise<void> {
  const request = await db.query(
    'SELECT * FROM role_assignment_requests WHERE id = $1',
    [requestId]
  );
  
  if (request.status !== 'pending') {
    throw new Error('Request already processed');
  }
  
  // Update user's role
  await db.query(
    'UPDATE users SET role_id = $1 WHERE id = $2',
    [request.requested_role_id, request.user_id]
  );
  
  // Mark request approved
  await db.query(
    `UPDATE role_assignment_requests 
     SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [approvedBy, requestId]
  );
}
```

**Usage:**
```bash
# Manager requests role assignment (without direct access)
curl -X POST /api/role-requests \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": 42,
    "roleId": 3,
    "reason": "User completed training"
  }'

# Admin approves from dashboard
PUT /api/role-requests/7/approve
```

**Benefits:**
- Clear audit trail
- Security review before escalation
- Prevents accidents

### Model 3: Time-Limited Roles

Grant elevated access for specific duration (e.g., contractor access):

```typescript
// server/src/services/temporary-role.ts

interface TemporaryRoleGrant {
  userId: number;
  roleId: number;
  grantedBy: number;
  expiresAt: Date;
  reason: string;
}

async function grantTemporaryRole(
  db: Database,
  userId: number,
  roleId: number,
  durationDays: number,
  grantedBy: number,
  reason: string
): Promise<TemporaryRoleGrant> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  
  return await db.query(
    `INSERT INTO temporary_role_grants 
     (user_id, role_id, granted_by, expires_at, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, roleId, grantedBy, expiresAt, reason]
  );
}

// Periodic cleanup: revoke expired grants
async function revokeExpiredGrants(db: Database): Promise<number> {
  const result = await db.query(
    `UPDATE users 
     SET role_id = (SELECT id FROM roles WHERE name = 'viewer')
     WHERE id IN (
       SELECT user_id FROM temporary_role_grants 
       WHERE expires_at < CURRENT_TIMESTAMP AND revoked_at IS NULL
     )
     RETURNING id`
  );
  
  const revoked = result.rows.length;
  
  await db.query(
    `UPDATE temporary_role_grants SET revoked_at = CURRENT_TIMESTAMP
     WHERE expires_at < CURRENT_TIMESTAMP AND revoked_at IS NULL`
  );
  
  logger.info(`Revoked ${revoked} expired temporary role grants`);
  return revoked;
}

// Run cleanup daily
cron.schedule('0 2 * * *', () => revokeExpiredGrants(db));
```

**Usage:**
```bash
# Grant contractor operator access for 30 days
curl -X POST /api/users/123/temporary-role \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "roleId": 2,
    "durationDays": 30,
    "reason": "Contract: Q2 cinema audit"
  }'

# Automatically revokes after 30 days
```

---

## Theme Management Workflows

### Workflow 1: Branding Update (Multi-Stage)

Safe process for updating branding with validation and testing:

```typescript
// server/src/workflows/branding-update.ts

enum BrandingUpdateStage {
  DRAFT = 'draft',
  REVIEW = 'review',
  TESTING = 'testing',
  APPROVED = 'approved',
  DEPLOYED = 'deployed'
}

interface BrandingUpdateRequest {
  id: string;
  changes: Partial<AppSettings>;
  createdBy: number;
  stage: BrandingUpdateStage;
  approvedBy?: number;
  testingNotes?: string;
  deployedAt?: Date;
}

// 1. Create draft
async function createBrandingDraft(
  db: Database,
  userId: number,
  changes: Partial<AppSettings>
): Promise<BrandingUpdateRequest> {
  return await db.query(
    `INSERT INTO branding_updates 
     (changes, created_by, stage)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [JSON.stringify(changes), userId, BrandingUpdateStage.DRAFT]
  );
}

// 2. Submit for review
async function submitForReview(
  db: Database,
  requestId: string
): Promise<void> {
  await db.query(
    `UPDATE branding_updates SET stage = $1 WHERE id = $2`,
    [BrandingUpdateStage.REVIEW, requestId]
  );
}

// 3. Approve (admin only)
async function approveBrandingUpdate(
  db: Database,
  requestId: string,
  approvedBy: number
): Promise<void> {
  await db.query(
    `UPDATE branding_updates 
     SET stage = $1, approved_by = $2 
     WHERE id = $3`,
    [BrandingUpdateStage.APPROVED, approvedBy, requestId]
  );
}

// 4. Deploy to production
async function deployBrandingUpdate(
  db: Database,
  requestId: string
): Promise<void> {
  const update = await db.query(
    'SELECT changes FROM branding_updates WHERE id = $1',
    [requestId]
  );
  
  // Apply changes
  await updateSettings(db, update.changes);
  
  // Mark deployed
  await db.query(
    `UPDATE branding_updates 
     SET stage = $1, deployed_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [BrandingUpdateStage.DEPLOYED, requestId]
  );
}
```

**Database Schema:**
```sql
CREATE TABLE branding_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changes JSONB NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  stage VARCHAR(50) NOT NULL,
  approved_by INT REFERENCES users(id),
  tested_notes TEXT,
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Workflow 2: Font Import with Validation

Safe process for importing custom Google Fonts:

```typescript
// server/src/workflows/font-import.ts

interface FontImportRequest {
  fontName: string;
  fontUrl: string;  // Google Fonts URL
  validatedAt?: Date;
  status: 'pending' | 'validated' | 'imported' | 'rejected';
}

async function validateFontImport(
  fontUrl: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Test URL is valid and returns CSS
    const response = await fetch(fontUrl, { timeout: 5000 });
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    
    const css = await response.text();
    
    // Validate CSS structure
    if (!css.includes('@font-face')) {
      return { valid: false, error: 'Not a valid font CSS' };
    }
    
    // Check for suspicious content (XSS prevention)
    if (css.includes('<script>') || css.includes('javascript:')) {
      return { valid: false, error: 'Font CSS contains malicious content' };
    }
    
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function importFont(
  db: Database,
  fontName: string,
  fontUrl: string
): Promise<void> {
  // Validate first
  const validation = await validateFontImport(fontUrl);
  if (!validation.valid) {
    throw new Error(`Font validation failed: ${validation.error}`);
  }
  
  // Update settings
  const current = await getAdminSettings(db);
  const updated = {
    ...current,
    // Update relevant font fields
    heading_font: `${fontName}|${fontUrl}`,
  };
  
  await updateSettings(db, updated);
}
```

---

## Disaster Recovery

### Scenario 1: All Admins Locked Out

**Problem**: All admin users deleted or roles corrupted.

**Recovery**:

```sql
-- Option 1: Promote any user to admin (emergency only)
UPDATE users SET role_id = (
  SELECT id FROM roles WHERE name = 'admin' AND is_system = true
)
WHERE id = 1;  -- Replace with any valid user ID

-- Verify
SELECT username, role_id FROM users WHERE role_id = (
  SELECT id FROM roles WHERE name = 'admin'
);
```

**Prevention**:

```sql
-- Add safety guard: prevent last admin deletion
ALTER TABLE users ADD CONSTRAINT 
check_min_admin_count CHECK (
  (SELECT COUNT(*) FROM users WHERE role_id = 
    (SELECT id FROM roles WHERE name = 'admin')
  ) >= 1
);
```

### Scenario 2: Accidental Permission Grant

**Problem**: User given `settings:import` permission and imported malicious config.

**Recovery**:

```typescript
// Restore from backup
async function restoreSettings(
  db: Database,
  backupId: number
): Promise<void> {
  const backup = await db.query(
    'SELECT settings_json FROM settings_backups WHERE id = $1',
    [backupId]
  );
  
  await updateSettings(db, JSON.parse(backup.settings_json));
  
  logger.warn(
    `Settings restored from backup ${backupId} by system recovery`
  );
}

// Automatic backups before import
async function importSettingsWithBackup(
  db: Database,
  newSettings: AppSettings
): Promise<void> {
  // Create backup first
  const current = await getAdminSettings(db);
  await db.query(
    `INSERT INTO settings_backups (settings_json)
     VALUES ($1)`,
    [JSON.stringify(current)]
  );
  
  // Then import new settings
  await updateSettings(db, newSettings);
}
```

### Scenario 3: Role Permission Corruption

**Problem**: Custom role has orphaned permissions or is in inconsistent state.

**Recovery**:

```sql
-- Find roles with missing permissions
SELECT r.name, COUNT(rp.id) as perm_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_system = false
GROUP BY r.id
HAVING COUNT(rp.id) = 0;

-- Rebuild operator role permissions (if corrupted)
DELETE FROM role_permissions 
WHERE role_id = (SELECT id FROM roles WHERE name = 'operator');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'operator'
AND p.name IN (
  'scraper:trigger',
  'scraper:trigger_single',
  'cinemas:create',
  'cinemas:update',
  'cinemas:delete',
  'cinemas:read',
  'users:read',
  'reports:list',
  'reports:view'
);

-- Verify
SELECT COUNT(*) FROM role_permissions 
WHERE role_id = (SELECT id FROM roles WHERE name = 'operator');
-- Should return 9
```

### Scenario 4: Permission Changes Not Taking Effect

**Problem**: User's permissions changed in database but old permissions still in use (JWT expires in 24 hours).

**Solution**: Users must log out and log back in to get new JWT with updated permissions.

**Proactive approach**: Force re-login when permissions change:

```typescript
// server/src/services/permission-change-notifier.ts

async function notifyPermissionChange(
  userId: number,
  changes: string[]
): Promise<void> {
  // Send notification to client via WebSocket
  io.to(`user-${userId}`).emit('permission_changed', {
    message: 'Your permissions have changed. Please log in again.',
    changes,
  });
}

// When admin updates user role
async function updateUserRole(
  db: Database,
  userId: number,
  roleId: number
): Promise<void> {
  await db.query(
    'UPDATE users SET role_id = $1 WHERE id = $2',
    [roleId, userId]
  );
  
  // Get new role name for notification
  const newRole = await db.query(
    'SELECT name FROM roles WHERE id = $1',
    [roleId]
  );
  
  // Notify user
  await notifyPermissionChange(userId, [
    `Role changed to: ${newRole.name}`
  ]);
}
```

**Client-side handling:**

```typescript
// client/src/contexts/AuthContext.tsx

useEffect(() => {
  const handlePermissionChange = (event: { changes: string[] }) => {
    logger.warn('Permissions changed. Please log in again.', event.changes);
    logout(); // Clear token and redirect to login
  };
  
  socket.on('permission_changed', handlePermissionChange);
  
  return () => {
    socket.off('permission_changed', handlePermissionChange);
  };
}, [socket]);
```

---

## Audit & Compliance

### Audit Logging

Track all administrative actions:

```sql
-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT NOT NULL REFERENCES users(id),
  actor_username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  target_name VARCHAR(255),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

**Log All Admin Actions:**

```typescript
// server/src/middleware/audit-logger.ts

async function logAuditAction(
  db: Database,
  action: string,
  actor: User,
  targetType: string,
  targetId: number,
  changes?: Record<string, any>,
  req?: Request
): Promise<void> {
  await db.query(
    `INSERT INTO audit_log 
     (actor_id, actor_username, action, target_type, target_id, 
      changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actor.id,
      actor.username,
      action,
      targetType,
      targetId,
      JSON.stringify(changes),
      req?.ip,
      req?.get('User-Agent'),
    ]
  );
}

// Usage: Log role change
async function updateUserRole(
  db: Database,
  userId: number,
  roleId: number,
  actor: User,
  req: Request
): Promise<void> {
  const oldUser = await getUserById(db, userId);
  
  await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleId, userId]);
  
  // Log the change
  await logAuditAction(db, 'USER_ROLE_CHANGED', actor, 'user', userId, {
    oldRoleId: oldUser.role_id,
    newRoleId: roleId,
  }, req);
}
```

### Compliance Reports

Generate compliance audit trails:

```typescript
// server/src/services/compliance-reports.ts

async function generateAuditReport(
  db: Database,
  startDate: Date,
  endDate: Date,
  action?: string
): Promise<AuditRecord[]> {
  let query = `
    SELECT 
      id, actor_id, actor_username, action, target_type, 
      target_id, changes, ip_address, created_at
    FROM audit_log
    WHERE created_at BETWEEN $1 AND $2
  `;
  
  const params: any[] = [startDate, endDate];
  
  if (action) {
    query += ' AND action = $3';
    params.push(action);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const result = await db.query(query, params);
  return result.rows;
}

// Export audit trail as CSV
async function exportAuditTrailCSV(
  db: Database,
  startDate: Date,
  endDate: Date
): Promise<string> {
  const records = await generateAuditReport(db, startDate, endDate);
  
  const csv = [
    ['Timestamp', 'Actor', 'Action', 'Target', 'Changes', 'IP'].join(','),
    ...records.map(r =>
      [
        r.created_at,
        r.actor_username,
        r.action,
        `${r.target_type}#${r.target_id}`,
        JSON.stringify(r.changes),
        r.ip_address,
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');
  
  return csv;
}
```

---

## Troubleshooting

### Symptom: User Cannot Access Admin Panel

```typescript
// Debug permission issue
async function debugUserPermissions(db: Database, userId: number) {
  const user = await db.query(
    `SELECT u.id, u.username, r.name as role_name, r.is_system
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );
  
  const permissions = await db.query(
    `SELECT p.name FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = (
       SELECT role_id FROM users WHERE id = $1
     )`,
    [userId]
  );
  
  logger.info('User permissions:', {
    user: user.rows[0],
    permissions: permissions.rows.map(r => r.name),
  });
}
```

**Common Causes:**
1. User role_id is NULL → Assign role
2. Role has no permissions → Add permissions to role
3. JWT expired → User must re-login
4. Custom "admin" role without bypass → Only system admin role bypasses checks

### Symptom: Permission Changes Not Applied

**JWT caching issue**: Permissions are baked into JWT at login time.

**Solution**: User must logout and login again to get updated JWT.

**Verify in JWT:**
```bash
# Decode JWT (https://jwt.io)
# Check "permissions" array in payload

# If permissions list is missing or old, user needs to re-login
```

### Symptom: Accidental Permission Revocation

**Recover by restoring from backup:**

```sql
-- Find backup before change
SELECT * FROM role_permissions_backups
WHERE changed_at < NOW() - INTERVAL '2 hours'
ORDER BY changed_at DESC
LIMIT 1;

-- Restore role permissions from backup
DELETE FROM role_permissions WHERE role_id = 5;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM role_permissions_backups
WHERE backup_id = 123;  -- Use backup ID from above
```

**Prevention: Always backup before bulk changes:**

```bash
# Before modifying role permissions
pg_dump -t role_permissions $DATABASE_URL > backup-$(date +%s).sql

# Make changes
# If something goes wrong:
psql $DATABASE_URL < backup-1710768000.sql
```

---

## Best Practices

1. **Use system roles as baselines**: Build custom roles from operator/admin templates
2. **Implement approval workflows** for role escalation in production
3. **Enable audit logging** from day one (easier than backfilling)
4. **Test permission changes in staging** before production
5. **Enforce time-limited roles** for contractors and temporary staff
6. **Backup before settings imports** (auto-backup in code)
7. **Document role purposes** in role descriptions
8. **Monitor permission changes** via audit logs
9. **Require re-login after permission changes** (JWT expiry enforces this)
10. **Create emergency access plan** (e.g., temporary super-user restoration)
