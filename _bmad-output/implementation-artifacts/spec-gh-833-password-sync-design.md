---
title: 'Design password sync mechanism for multi-tenant architecture'
type: 'chore'
created: '2026-04-14'
status: 'done'
baseline_commit: '85346215f029fb397713b988b73918c49bbb6d1a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin password hash is duplicated across schemas (`public.users` and `org_*.users`). Password changes in one location don't propagate to other schemas, creating security and UX issues.

**Approach:** Analyze tradeoffs between multiple password sync approaches (shared table, triggers, polling, app-level) and produce a design document recommending the best solution for the schema-per-tenant architecture.

## Boundaries & Constraints

**Always:**
- Analyze security implications of each approach
- Consider migration path for existing deployments
- Document tradeoffs (complexity vs reliability vs performance)
- Recommend a single approach with clear rationale
- Follow schema-per-tenant architecture (no org_id columns in shared tables)

**Ask First:**
- If recommended approach requires significant refactoring of existing auth system
- If migration requires downtime or complex data migration

**Never:**
- Implement code (this is design-only)
- Break schema-per-tenant isolation model
- Store plaintext passwords
- Create circular FK dependencies between public and org schemas

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| System admin changes password | Password updated in `public.users`, admin is member of 3 orgs | Password hash synced to all 3 org schemas | Design must address sync failure handling |
| Org admin changes password | Password updated in `org_acme.users`, user exists in multiple orgs | Design must clarify: does this user exist in multiple orgs? | Design must address cross-org user identity |
| Password sync fails mid-propagation | Password updated in `public.users`, sync fails to 1 of 3 org schemas | Design must address partial failure recovery | Design must specify retry/rollback strategy |
| New org created | System admin already exists in `public.users`, new org bootstrap runs | New org gets current password hash | Design must clarify: sync on bootstrap or lazy? |

</frozen-after-approval>

## Code Map

- `packages/saas/migrations/saas_008_create_default_ics_org.sql` (lines 384-399) -- Current password hash duplication pattern
- `packages/saas/migrations/org_schema/000_bootstrap.sql` (lines 23-33) -- Org users table definition
- `server/src/services/auth-service.ts` -- Authentication service (password hashing logic)
- `packages/saas/src/routes/register.ts` -- Org registration (user creation pattern)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/saas/docs/password-sync-design.md` -- Create design document analyzing 4 approaches with tradeoffs, security implications, and recommended solution -- Provides architectural guidance for future implementation

**Acceptance Criteria:**
- Given the design document, when a developer reads it, then they understand the tradeoffs between all 4 approaches (shared table, triggers, polling, app-level)
- Given the design document, when a developer reads it, then they can implement the recommended approach without ambiguity
- Given the design document, when a security reviewer reads it, then they can validate the security implications are addressed
- Given the design document, when a DevOps engineer reads it, then they understand the migration path for existing deployments

## Spec Change Log

## Design Notes

**Document Structure:**

The design document should follow this structure:

1. **Problem Statement**
   - Current duplication issue
   - Security implications (password drift)
   - UX implications (change password in wrong place)

2. **Approach 1: Shared Credentials Table**
   - Design: `public.user_credentials (username, password_hash)`, soft references from org schemas
   - Pros: Single source of truth, no sync delay, simple queries
   - Cons: Cross-schema JOIN performance, breaks full isolation
   - Security: Credentials accessible from any org schema connection

3. **Approach 2: Trigger-Based Sync**
   - Design: Postgres triggers on `public.users` INSERT/UPDATE propagate to all org schemas
   - Pros: Immediate consistency, transparent to application
   - Cons: Trigger complexity, hard to debug, potential cascade failures
   - Security: Triggers run with elevated permissions

4. **Approach 3: Polling-Based Sync**
   - Design: Background worker periodically checks for password changes and propagates
   - Pros: Decoupled from transaction, retryable, observable
   - Cons: Eventual consistency (sync delay), polling overhead
   - Security: Requires secure storage of "last synced" state

5. **Approach 4: Application-Level Sync**
   - Design: Auth service updates all schemas when password changes
   - Pros: Explicit control, easy to test, transaction-safe
   - Cons: Auth service must know all user's orgs, N+1 query problem
   - Security: Application has write access to all org schemas

6. **Recommendation**
   - Which approach to use (with rationale)
   - Why other approaches were rejected
   - Implementation checklist

7. **Migration Path**
   - How to migrate existing deployments
   - Rollback strategy
   - Downtime requirements (if any)

8. **Security Considerations**
   - Password hash exposure surface
   - RBAC implications
   - Audit logging requirements

## Verification

**Commands:**
- `ls packages/saas/docs/password-sync-design.md` -- expected: file exists

**Manual checks:**
- Document is readable and well-structured
- All 4 approaches are analyzed with pros/cons
- Recommendation is clear and justified
- Migration path is documented
- Security implications are addressed
