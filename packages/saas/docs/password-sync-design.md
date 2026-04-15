# Password Synchronization Design for Multi-Tenant Architecture

**Issue:** [#833](https://github.com/phBassin/allo-scrapper/issues/833)  
**Author:** BMad Quick Dev Workflow  
**Date:** 2026-04-15  
**Status:** Design Proposal

---

## Problem Statement

### Current Duplication Issue

In the schema-per-tenant architecture, admin password hashes are duplicated across schemas:
- System admins exist in `public.users` with a password hash
- When a new org is created (or the default ICS org is bootstrapped), that same admin user is copied to `org_*.users` with their password hash

**Example from `saas_008_create_default_ics_org.sql` (lines 384-399):**

```sql
INSERT INTO org_ics.users (username, password_hash, role_id, email_verified)
SELECT u.username, u.password_hash, r.id, true
FROM public.users u
CROSS JOIN org_ics.roles r
WHERE u.is_system_role = true AND r.name = 'admin'
```

This creates **two independent copies** of the password hash:
- One in `public.users.password_hash`
- One in `org_ics.users.password_hash`

### Security Implications

**Password drift:** If an admin changes their password in one location, the change does not propagate to other schemas. This creates security risks:

1. **Credential confusion:** Admin logs into one org with new password, then fails to log into another org with the same credentials
2. **Extended breach window:** If admin password is compromised, changing the password in `public.users` does NOT invalidate the old hash in org schemas
3. **Audit trail gaps:** Password change events logged in one schema are not reflected in others

### UX Implications

**User confusion about where to change password:**

- System admin changes password via `/admin` UI → updates `public.users` only
- Same admin logs into org via `/org/acme` → still uses old password hash from `org_acme.users`
- User reports "password change didn't work"

**Current auth behavior (from `auth-service.ts`):**

The `AuthService.changePassword()` method only updates `public.users`:

```typescript
await updateUserPassword(this.db, user.id, newPasswordHash);
```

This does NOT propagate the change to any org schemas where the user exists.

---

## Approach 1: Shared Credentials Table

### Design

Create a dedicated credentials table in the public schema:

```sql
CREATE TABLE public.user_credentials (
  username VARCHAR(255) PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Schema changes:**

- `public.users.password_hash` → removed (replaced by FK to user_credentials)
- `org_*.users.password_hash` → removed (soft reference to public.user_credentials by username)

**Auth query pattern:**

```sql
-- From any org schema
SELECT u.id, u.username, u.role_id, c.password_hash
FROM org_acme.users u
JOIN public.user_credentials c ON c.username = u.username
WHERE u.username = $1;
```

### Pros

✅ **Single source of truth:** Only one place to update password hash  
✅ **No sync delay:** Changes are immediately visible to all orgs  
✅ **Simple queries:** Standard JOIN pattern, well-understood by developers  
✅ **Atomic updates:** Password change is a single transaction, no partial failure risk

### Cons

❌ **Cross-schema JOIN performance:** Every login requires a JOIN across `public` and `org_*` schemas  
❌ **Breaks full isolation:** Org schemas now have a hard dependency on public schema structure  
❌ **Connection pool implications:** Org-scoped connections must have permission to read `public.user_credentials`  
❌ **Migration complexity:** Requires backfilling credentials table, removing columns from existing schemas

### Security Considerations

- **Credentials accessible from any org schema connection:** If an attacker gains access to an org schema connection, they can read all usernames and password hashes from `public.user_credentials`
- **RBAC enforcement:** Need to ensure org-scoped users cannot UPDATE the credentials table, only SELECT their own row
- **Audit logging:** Password changes must be logged in a centralized audit table (not org-specific)

### Performance Impact

**Benchmark assumption (to be validated):**

- Cross-schema JOIN adds ~0.5-2ms per query on typical PostgreSQL instances
- For 100 logins/second, adds ~50-200ms total latency
- Negligible for most workloads, but could be a concern at scale (10k+ logins/sec)

---

## Approach 2: Trigger-Based Sync

### Design

Use PostgreSQL triggers to propagate password changes from `public.users` to all org schemas:

```sql
CREATE OR REPLACE FUNCTION sync_password_to_orgs()
RETURNS TRIGGER AS $$
DECLARE
  org_schema TEXT;
BEGIN
  -- Find all org schemas where this user exists
  FOR org_schema IN
    SELECT 'org_' || slug FROM organizations
  LOOP
    -- Update password hash in each org schema
    EXECUTE format('
      UPDATE %I.users
      SET password_hash = $1, updated_at = NOW()
      WHERE username = $2
    ', org_schema)
    USING NEW.password_hash, NEW.username;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_password_after_update
AFTER UPDATE OF password_hash ON public.users
FOR EACH ROW
WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash)
EXECUTE FUNCTION sync_password_to_orgs();
```

### Pros

✅ **Immediate consistency:** Password changes propagate instantly, no delay  
✅ **Transparent to application:** Auth service doesn't need to know about sync logic  
✅ **No schema coupling:** Org schemas remain independent (no FKs to public)  
✅ **Works for all user types:** System admins, org admins, regular users (if multi-org support added later)

### Cons

❌ **Trigger complexity:** Dynamic SQL execution in triggers is hard to test and debug  
❌ **Cascade failure risk:** If updating one org schema fails (e.g., connection timeout), entire transaction rolls back  
❌ **Performance overhead:** Every password change requires N additional UPDATE queries (N = number of orgs user belongs to)  
❌ **Hard to audit:** Password sync events are implicit, not logged by application  
❌ **Difficult to rollback:** If a sync goes wrong, hard to identify which schemas have stale data

### Security Considerations

- **Triggers run with elevated permissions:** The trigger function must have permission to UPDATE all org schemas
- **SQL injection risk:** Using `format()` with dynamic schema names requires careful sanitization (though `%I` is safe)
- **Audit logging:** Trigger-based changes bypass application audit logging (must use PostgreSQL audit extension or custom trigger logging)

### Error Handling

**What happens if sync fails?**

- Entire transaction rolls back (password change in `public.users` is also reverted)
- User sees generic "password change failed" error
- **Recovery:** Manual intervention required to identify which org schemas are out of sync

**Potential enhancement:**

```sql
-- Use EXCEPTION block to log failures and continue
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.password_sync_failures (username, org_schema, error)
    VALUES (NEW.username, org_schema, SQLERRM);
    -- Don't re-raise, allow transaction to succeed
```

This trades immediate consistency for eventual consistency (failed syncs logged for manual retry).

---

## Approach 3: Polling-Based Sync

### Design

A background worker periodically checks for password changes and propagates them:

```typescript
// Background worker (e.g., cron job or Node.js setInterval)
async function syncPasswords() {
  // Find users with password_hash changes since last sync
  const changedUsers = await db.query(`
    SELECT u.username, u.password_hash, u.updated_at
    FROM public.users u
    LEFT JOIN public.password_sync_log l ON l.username = u.username
    WHERE u.updated_at > COALESCE(l.last_synced_at, '1970-01-01')
  `);

  for (const user of changedUsers) {
    // Find all orgs where this user exists
    const orgs = await db.query(`
      SELECT slug FROM organizations o
      WHERE EXISTS (
        SELECT 1 FROM org_${o.slug}.users WHERE username = $1
      )
    `, [user.username]);

    // Update password hash in each org
    for (const org of orgs) {
      await db.query(`
        UPDATE org_${org.slug}.users
        SET password_hash = $1, updated_at = NOW()
        WHERE username = $2
      `, [user.password_hash, user.username]);
    }

    // Record successful sync
    await db.query(`
      INSERT INTO public.password_sync_log (username, last_synced_at)
      VALUES ($1, NOW())
      ON CONFLICT (username) DO UPDATE SET last_synced_at = NOW()
    `, [user.username]);
  }
}

// Run every 60 seconds
setInterval(syncPasswords, 60_000);
```

**Required tables:**

```sql
CREATE TABLE public.password_sync_log (
  username VARCHAR(255) PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL,
  last_error TEXT
);
```

### Pros

✅ **Decoupled from transaction:** Password change in `public.users` succeeds immediately, sync happens asynchronously  
✅ **Retryable:** If sync fails, worker retries on next poll  
✅ **Observable:** Sync status is explicit in `password_sync_log` table  
✅ **Easy to test:** Worker logic is a simple async function, can be unit tested  
✅ **Backpressure control:** Can rate-limit sync to avoid overwhelming database

### Cons

❌ **Eventual consistency (sync delay):** Password changes take up to 60 seconds to propagate (depending on poll interval)  
❌ **Polling overhead:** Worker runs periodically even if no passwords changed  
❌ **Requires background process:** Adds deployment complexity (must ensure worker is running)  
❌ **Race condition window:** User changes password, immediately tries to log into org with new password → fails because sync hasn't run yet

### Security Considerations

- **Secure storage of sync state:** `password_sync_log` table must be protected (contains username + last sync timestamp)
- **Sync worker credentials:** Worker needs write access to all org schemas (use dedicated connection with elevated permissions)
- **Audit logging:** Log every sync event with timestamp, username, affected orgs

### Error Handling

**What happens if sync fails?**

- Password change in `public.users` succeeds (user can log into `/admin`)
- Sync failure logged in `password_sync_log.last_error`
- Worker retries on next poll (exponential backoff optional)
- **Recovery:** If failure persists, alert operator via monitoring (e.g., Prometheus metric)

**Acceptable sync delay:**

- For low-security orgs: 60-300 seconds acceptable
- For high-security orgs: requires immediate sync (polling not suitable)

---

## Approach 4: Application-Level Sync

### Design

The `AuthService` explicitly updates all org schemas when a password changes:

```typescript
class AuthService {
  async changePassword(
    currentUsername: string,
    currentPassword: string,
    newPassword: string
  ) {
    // Validate current password
    const user = await getUserByUsername(this.db, currentUsername);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new Error('Current password is incorrect');

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update public.users
    await updateUserPassword(this.db, user.id, newPasswordHash);

    // Find all orgs where user exists (if multi-org membership supported)
    const orgs = await this.db.query(`
      SELECT slug FROM organizations o
      WHERE EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'org_' || o.slug
          AND table_name = 'users'
      )
    `);

    // Update each org schema
    for (const org of orgs) {
      await this.db.query(`
        UPDATE org_${org.slug}.users
        SET password_hash = $1, updated_at = NOW()
        WHERE username = $2
      `, [newPasswordHash, currentUsername]);
    }

    logger.info(`Password changed for user: ${user.username} (propagated to ${orgs.length} orgs)`);
  }
}
```

### Pros

✅ **Explicit control:** Developer can see exactly where password is updated  
✅ **Easy to test:** Logic lives in testable service class, can mock database  
✅ **Transaction-safe:** All updates happen in a single transaction (or with explicit error handling)  
✅ **No background worker:** No deployment complexity, no polling overhead  
✅ **Immediate consistency:** Password change propagates synchronously before returning to user

### Cons

❌ **Auth service must know all user's orgs:** Requires querying `organizations` table and dynamically discovering membership  
❌ **N+1 query problem:** For users in 10 orgs, requires 1 + 10 = 11 UPDATE queries  
❌ **Slow password changes:** User waits for all org updates to complete (latency = N * update_time)  
❌ **Application has write access to all org schemas:** Violates principle of least privilege (app should only access org schema it's currently acting in)

### Security Considerations

- **Application credentials scope:** App connection pool must have write access to all org schemas (increases blast radius if credentials leaked)
- **RBAC enforcement:** Must ensure only the user themselves (or superadmin) can change their password, not other org members
- **Audit logging:** Log every password change with affected orgs

### Error Handling

**What happens if one org update fails?**

**Option A: Rollback entire transaction**

```typescript
await this.db.transaction(async (tx) => {
  await tx.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  for (const org of orgs) {
    await tx.query(`UPDATE org_${org.slug}.users SET password_hash = $1 WHERE username = $2`, [hash, username]);
  }
});
// If any update fails, entire transaction rolls back
```

**Option B: Best-effort with partial failure handling**

```typescript
await updateUserPassword(this.db, user.id, newPasswordHash); // Always succeeds

const failures: string[] = [];
for (const org of orgs) {
  try {
    await this.db.query(`UPDATE org_${org.slug}.users SET password_hash = $1 WHERE username = $2`, [hash, username]);
  } catch (err) {
    failures.push(org.slug);
  }
}

if (failures.length > 0) {
  logger.error(`Password sync failed for orgs: ${failures.join(', ')}`);
  // Queue retry or alert operator
}
```

---

## Recommendation

### Chosen Approach: **Application-Level Sync (Approach 4)**

**Rationale:**

1. **Explicit and testable:** Password sync logic is visible in the codebase, not hidden in database triggers or background workers
2. **Immediate consistency:** Users can log into any org with their new password immediately after changing it
3. **No additional infrastructure:** No background workers to deploy, monitor, or maintain
4. **Transaction-safe:** Can use database transactions to ensure all-or-nothing updates
5. **Audit-friendly:** Application logs every password change and affected orgs

### Why Other Approaches Were Rejected

| Approach | Rejection Reason |
|----------|-----------------|
| **1. Shared Credentials Table** | Cross-schema JOINs on every login hurt performance; breaks schema isolation principle |
| **2. Trigger-Based Sync** | Too complex to debug; error handling is opaque; hard to test |
| **3. Polling-Based Sync** | Eventual consistency window unacceptable for security-critical password changes |

### Implementation Checklist

#### Phase 1: Single-Org Sync (Current Architecture)

For the current architecture (admin belongs to one org at a time):

- [ ] **Modify `AuthService.changePassword()`** to update password in org schema after updating `public.users`
- [ ] **Add org detection logic:** Query `organizations` table to find org where user is admin
- [ ] **Add error handling:** Wrap updates in transaction, rollback on failure
- [ ] **Add audit logging:** Log password change event with org_slug
- [ ] **Add tests:** Unit test for password sync, integration test for transaction rollback

**Estimated effort:** 4-8 hours

#### Phase 2: Multi-Org Sync (Future Enhancement)

For future multi-org membership support:

- [ ] **Add `user_org_memberships` table** to track which users belong to which orgs
- [ ] **Modify `AuthService.changePassword()`** to query memberships and update all org schemas
- [ ] **Add partial failure handling:** Log failures, queue retries, alert operator
- [ ] **Add performance optimization:** Batch UPDATE queries, use connection pooling per org
- [ ] **Add monitoring:** Prometheus metrics for sync latency, failure rate

**Estimated effort:** 16-24 hours

---

## Migration Path

### Step 1: Assess Current State

**Query existing password duplication:**

```sql
-- Find all orgs where admin exists
SELECT o.slug, u.username, u.password_hash AS public_hash, ou.password_hash AS org_hash
FROM organizations o
CROSS JOIN LATERAL (
  SELECT password_hash FROM org_${o.slug}.users WHERE username = 'admin'
) ou
JOIN public.users u ON u.username = 'admin'
WHERE u.is_system_role = true;
```

**Expected result:** All rows should have matching hashes (if no password changes since migration).

### Step 2: Implement Application-Level Sync

1. **Add sync logic to `AuthService.changePassword()`** (see checklist above)
2. **Add integration test:** Change password, verify it works in both public and org schema
3. **Deploy to staging:** Verify password changes propagate correctly

### Step 3: Backfill Historical Changes (If Needed)

If passwords have already drifted (e.g., admin changed password in `public.users` but not org schemas):

```sql
-- Sync passwords from public.users to all org schemas
DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN SELECT slug FROM organizations LOOP
    EXECUTE format('
      UPDATE %I.users u
      SET password_hash = pu.password_hash, updated_at = NOW()
      FROM public.users pu
      WHERE u.username = pu.username
        AND u.password_hash IS DISTINCT FROM pu.password_hash
    ', 'org_' || org_rec.slug);
  END LOOP;
END $$;
```

### Step 4: Monitor and Validate

- **Verify no password drift:** Run drift detection query weekly
- **Monitor sync latency:** Log time taken for password change propagation
- **Alert on failures:** Set up alerting if password sync fails

### Rollback Strategy

If application-level sync causes issues:

1. **Revert code changes:** Restore `AuthService.changePassword()` to pre-sync version
2. **Manual password reset:** Provide CLI tool for admins to manually sync passwords
3. **No data loss:** Reverting code does not corrupt existing data (no schema changes)

### Downtime Requirements

**None.** This is a code-only change, no database migrations required.

---

## Security Considerations

### Password Hash Exposure Surface

**Before this change:**

- Password hash stored in `public.users` and `org_*.users`
- Breach of one org schema exposes password hash for that org's users only

**After this change:**

- Password hash still stored in multiple locations (no change)
- Sync logic ensures all locations have the same hash
- **No increase in exposure surface** (same number of copies)

### RBAC Implications

**Authorization check required:**

Only the user themselves (or superadmin) should be able to change their password:

```typescript
// In password change endpoint
if (req.user.id !== targetUserId && !req.user.isSuperadmin) {
  throw new ForbiddenError('Cannot change another user's password');
}
```

**Already enforced in current `AuthService.changePassword()`** (requires `currentPassword` verification).

### Audit Logging Requirements

**Every password change must be logged:**

```typescript
logger.info({
  event: 'password_changed',
  user_id: user.id,
  username: user.username,
  affected_orgs: orgs.map(o => o.slug),
  timestamp: new Date().toISOString(),
});
```

**Audit log storage:**

- For system admins: log to `public.audit_log` (if SaaS mode enabled)
- For org users: log to `org_*.audit_log` (future enhancement)

### Attack Scenarios

#### Scenario 1: Attacker gains access to org schema

**Before sync:**

- Attacker reads `org_acme.users.password_hash` for user "admin"
- Attacker cannot use this hash to access other orgs (different hash)

**After sync:**

- Attacker reads `org_acme.users.password_hash` for user "admin"
- Attacker cannot use this hash to access other orgs (same hash, but still must crack it first)

**Verdict:** No additional risk (attacker still needs to crack bcrypt hash).

#### Scenario 2: Attacker performs timing attack on password change

**Before sync:**

- Password change takes ~100ms (single UPDATE query)

**After sync:**

- Password change takes ~100ms + (N * 50ms) where N = number of orgs
- Attacker can infer number of orgs user belongs to

**Mitigation:**

- Add constant-time padding to password change response
- Or accept this minor information leak (low risk)

---

## Appendix: Alternative Hybrid Approach

**Not recommended, but documented for completeness:**

### Approach 5: Trigger-Based Sync with Async Retry Queue

Combine immediate trigger-based sync with a background worker that retries failures:

1. **Trigger** attempts to sync password to all org schemas
2. If any org update fails, log failure to `password_sync_failures` table
3. **Background worker** periodically retries failed syncs

**Pros:**

- Most password changes succeed immediately (happy path)
- Partial failures don't block user (degraded UX is temporary)

**Cons:**

- Complexity: requires both trigger logic AND background worker
- Debugging: hard to understand when sync happened via trigger vs. worker

**Verdict:** Not worth the added complexity for this use case.

---

## References

- [Issue #832 - Create default ICS organization](https://github.com/phBassin/allo-scrapper/issues/832)
- [Issue #833 - Password sync design](https://github.com/phBassin/allo-scrapper/issues/833)
- [Deferred Issue D2 - Cross-schema password hash duplication](_bmad-output/implementation-artifacts/deferred-issues-gh-832.md#d2-cross-schema-password-hash-duplication)
- [PostgreSQL Schema-Per-Tenant Best Practices](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Multi-Tenant Data Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/sharding)
