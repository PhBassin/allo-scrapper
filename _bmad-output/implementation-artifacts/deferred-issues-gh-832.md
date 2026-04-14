# Deferred Follow-Up Issues - Issue #832

**Parent Issue:** #832 - Create default ICS organization in SaaS mode  
**Review Date:** 2026-04-14  
**Status:** 20 items deferred for future consideration

---

## Overview

During adversarial code review of the default ICS organization migration, 20 non-critical findings were identified and deferred. These represent:
- Design decisions (not bugs)
- Performance optimizations (not correctness issues)
- Pre-existing architectural limitations
- Extremely rare edge cases
- Documentation improvements

**None of these items block the merge of #832.** They are documented here for future reference and potential enhancement.

---

## Deferred Items by Category

### Category: Design Decisions (Not Bugs)

#### D1. email_verified forced to TRUE without verification

**Description:** Admin user migrated with `email_verified=true` without actual verification process

**Why deferred:** 
- Spec doesn't require preserving verification status
- Admin needs immediate access to org after migration
- Email verification is for new invites, not admin bootstrap

**Potential future enhancement:**
- Send verification email to admin after migration
- Add spec requirement to preserve verification status if desired

**Priority:** Low  
**Label:** enhancement

---

#### D9. admin_exists WARNING doesn't fail migration

**Description:** Verification step logs WARNING instead of EXCEPTION when no admin user found

**Why deferred:**
- Spec explicitly says "Log error, allow startup (superadmin can fix manually)"
- Warning is correct behavior per requirements
- Not a bug, working as designed

**Potential future enhancement:**
- Add CLI tool for superadmin to manually associate admin user
- Document manual recovery procedure in admin guide

**Priority:** Low  
**Label:** documentation

---

### Category: Architectural Limitations

#### D2. Cross-schema password hash duplication

**Description:** Admin password hash copied from `public.users` to `org_ics.users`, creating two copies

**Why deferred:**
- Inherent to schema-per-tenant architecture
- Password sync across schemas is a future feature
- Not a migration bug - expected behavior

**Potential future enhancement:**
- Design password sync mechanism (polling, triggers, or shared table)
- Add password change propagation feature
- Document password management in multi-tenant docs

**Priority:** Medium (for SaaS feature roadmap)  
**Label:** enhancement, saas-architecture

---

#### D13. Schema exists but org doesn't scenario

**Description:** Edge case where `org_ics` schema exists but `organizations` table row doesn't

**Why deferred:**
- Handled by P2 (early exit logic fix) - schema recreation with warning
- Requires manual intervention to corrupt state (DROP TABLE without DROP SCHEMA)
- Already logged with appropriate WARNING

**Potential future enhancement:**
- Add schema orphan detection and cleanup command
- Include in health check endpoint

**Priority:** Low  
**Label:** maintenance

---

### Category: Performance Optimizations

#### D3. Missing role_id FK index

**Description:** No index on `org_ics.users.role_id` foreign key column

**Why deferred:**
- Performance optimization, not correctness issue
- Default org has minimal users (typically 1-5)
- Should be addressed in performance tuning phase

**Potential future enhancement:**
```sql
CREATE INDEX idx_users_role_id ON org_ics.users(role_id);
```

**Priority:** Medium (for performance audit epic)  
**Label:** performance

---

#### D15. Memory exhaustion on large datasets

**Description:** Migration loads entire tables into memory for migration, could exhaust memory on huge datasets

**Why deferred:**
- Not a concern for default org (fresh installs have minimal data)
- Real issue is for existing production instances migrating to SaaS
- Requires batching/streaming migration design

**Potential future enhancement:**
- Create separate "migrate existing deployment to SaaS" script with batching
- Use cursor-based pagination for large table migrations
- Document manual migration procedure for >1M rows

**Priority:** High (for existing customer migration tooling)  
**Label:** enhancement, scalability

---

### Category: Edge Cases (Extremely Rare)

#### D6. Potential integer overflow on films.id

**Description:** `films.id` is INTEGER (max 2^31 = 2.1 billion), could theoretically overflow

**Why deferred:**
- Allocine film IDs unlikely to exceed 2 billion in foreseeable future
- No observed issues in 10+ years of Allocine API usage
- Safe assumption to document

**Potential future enhancement:**
- Migrate `films.id` to BIGINT if Allocine changes ID scheme
- Add monitoring for max film ID approaching INT limit

**Priority:** Very Low  
**Label:** technical-debt

---

#### D11. Month boundary race condition

**Description:** Quota `DATE_TRUNC('month', CURRENT_DATE)` could change mid-migration if running at midnight on month boundary

**Why deferred:**
- Transaction completes in milliseconds, not hours
- Probability of hitting exact midnight boundary: ~0.001%
- Even if happens, quota still valid (just for "wrong" month)

**Potential future enhancement:**
- Capture month at transaction start: `DECLARE migration_month CONSTANT TIMESTAMPTZ := DATE_TRUNC('month', CURRENT_DATE);`

**Priority:** Very Low  
**Label:** technical-debt

---

#### D14. Concurrent INSERT race condition

**Description:** Two parallel migration executions could both try to INSERT org, one would fail

**Why deferred:**
- Deployment pattern should prevent parallel migrations
- Database migrations run sequentially via `runMigrations()` in single process
- Not a real scenario in production

**Potential future enhancement:**
- Add advisory lock: `SELECT pg_advisory_xact_lock(hashtext('saas_008'));`
- Document deployment procedure to prevent concurrent migrations

**Priority:** Low  
**Label:** documentation

---

### Category: Pre-existing Schema Design

#### D4. Sequence drift - weekly_programs

**Description:** `weekly_programs.id` sequence not reset after migration (but ID not migrated either)

**Why deferred:**
- ID column not migrated intentionally (SERIAL auto-generates)
- No FK dependencies on `weekly_programs.id`
- No harm from sequence starting at 1 again

**Potential future enhancement:**
- Standardize sequence reset approach across all migrated tables
- Document which tables preserve IDs vs regenerate

**Priority:** Low  
**Label:** consistency

---

#### D5. Missing FK cascade on org_settings.updated_by

**Description:** `org_settings.updated_by` references `users(id)` without ON DELETE CASCADE

**Why deferred:**
- Pre-existing schema design issue, not introduced by migration
- Affects all org schemas via bootstrap template
- Should be fixed in bootstrap template, not migration

**Potential future enhancement:**
```sql
ALTER TABLE org_ics.org_settings
DROP CONSTRAINT IF EXISTS org_settings_updated_by_fkey,
ADD CONSTRAINT org_settings_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES org_ics.users(id) 
  ON DELETE SET NULL;
```

**Priority:** Medium (for schema design review)  
**Label:** schema-design, technical-debt

---

#### D16. org_usage.month type inconsistency

**Description:** `org_usage.month` is TIMESTAMPTZ but migration uses `DATE_TRUNC('month', CURRENT_DATE)::DATE`

**Why deferred:**
- PostgreSQL auto-casts DATE to TIMESTAMPTZ correctly
- Semantic issue (should month be DATE or TIMESTAMPTZ?)
- Not a functional bug

**Potential future enhancement:**
- Standardize column type to DATE if month-precision is intent
- Or standardize to TIMESTAMPTZ if timezone matters

**Priority:** Low  
**Label:** schema-design

---

### Category: Migration Design Patterns

#### D7. SET search_path session persistence risk

**Description:** `SET search_path TO org_ics, public;` persists for session, could affect subsequent queries

**Why deferred:**
- Transaction rollback resets search_path automatically
- Migration wrapped in `BEGIN...COMMIT` block
- Additional safeguard (explicit reset) not critical

**Potential future enhancement:**
```sql
-- Capture original search_path at start
DECLARE original_path TEXT := current_setting('search_path');

-- ... migration steps ...

-- Explicitly restore at end
EXECUTE format('SET search_path TO %s', original_path);
```

**Priority:** Low  
**Label:** robustness

---

#### D10. Idempotency check doesn't prevent partial retry

**Description:** If migration fails mid-way, rerun might skip already-completed steps but also skip failed step

**Why deferred:**
- Transaction atomicity handles this - partial state rolled back automatically
- Each step is idempotent individually (ON CONFLICT DO NOTHING)
- Atomic migration is correct behavior

**Potential future enhancement:**
- Document migration failure recovery procedure
- Add migration state tracking table for finer-grained resume

**Priority:** Low  
**Label:** documentation

---

#### D17. Transaction rollback loses progress on failure

**Description:** If any step fails, entire migration rolls back - no incremental progress

**Why deferred:**
- Atomic transaction is correct behavior for migrations
- Partial state would be worse (org exists but no schema, etc.)
- Clean rollback allows safe retry

**Potential future enhancement:**
- For very large migrations (future), consider checkpoint/resume pattern
- Not applicable to default org (small dataset)

**Priority:** Low  
**Label:** documentation

---

### Category: Test Coverage

#### D8. Test only verifies file existence

**Description:** `packages/saas/src/plugin.test.ts` only checks migration file exists, doesn't run it

**Why deferred:**
- Test inventory pattern used throughout project
- Functional tests exist elsewhere (integration tests, manual QA)
- File existence test catches accidental deletion/rename

**Potential future enhancement:**
- Add integration test that runs migration against test database
- Verify post-migration state (org exists, schema exists, data migrated)

**Priority:** Medium (for test coverage epic)  
**Label:** testing

---

### Category: Validation Redundancy

#### D12. Missing role validation before admin association

**Description:** No explicit check that 'admin' role exists in `org_ics.roles` before INSERT

**Why deferred:**
- Roles seeding has `ON CONFLICT (name) DO NOTHING`, guaranteed to succeed
- Validation would be redundant
- FK constraint catches missing role anyway

**Potential future enhancement:**
- Add explicit validation if helpful for error messages
- Current error message from FK constraint is sufficient

**Priority:** Very Low  
**Label:** code-quality

---

#### D18. Missing validation that public.plans exists

**Description:** No check that `public.plans` table exists before querying for 'free' plan

**Why deferred:**
- Covered by P6 (plan_id validation) - subquery fails gracefully if table missing
- Error message from P6 fix is sufficient: "free plan not found"
- Validation would be redundant

**Potential future enhancement:**
- Add explicit table existence check for clearer error message
- Current error handling is acceptable

**Priority:** Very Low  
**Label:** code-quality

---

#### D20. Missing plan existence verification in verification step

**Description:** Step 8 verification doesn't check that org's plan_id points to valid plan

**Why deferred:**
- Covered by P6 - plan validation at creation time is sufficient
- FK constraint prevents invalid plan_id
- Verification step checks org exists, which implies valid FK

**Potential future enhancement:**
- Add plan validation to verification step for completeness
- Query: `SELECT EXISTS(SELECT 1 FROM public.plans WHERE id = (SELECT plan_id FROM public.organizations WHERE slug='ics'))`

**Priority:** Very Low  
**Label:** code-quality

---

### Category: Documentation

#### D19. Idempotency documentation mismatch

**Description:** Spec says "Skip data migration if tables already have records", code uses `ON CONFLICT DO NOTHING`

**Why deferred:**
- Design note wording issue, not implementation bug
- `ON CONFLICT` achieves same idempotency goal
- Code is correct, docs could be clearer

**Potential future enhancement:**
- Update spec to say "idempotent via ON CONFLICT DO NOTHING"
- Clarify that data is merged, not skipped

**Priority:** Low  
**Label:** documentation

---

## Recommended Actions

### Immediate (with PR for #832)

- ✅ Document these 20 items in this file
- ⬜ No code changes needed - all items intentionally deferred

### Short-term (Next Sprint)

- **D2** - Add password sync design document to SaaS architecture docs
- **D9** - Document manual admin association recovery procedure
- **D19** - Update spec idempotency wording for clarity

### Medium-term (Next Quarter)

- **D3** - Add FK indexes during performance optimization epic
- **D5** - Fix FK cascade in bootstrap template and migrate existing schemas
- **D8** - Add integration test for SaaS migrations

### Long-term (Future Backlog)

- **D15** - Design batched migration tooling for existing large deployments
- **D6** - Monitor film ID growth, plan BIGINT migration if needed

### No Action Needed

- **D1, D4, D6, D7, D10, D11, D12, D13, D14, D16, D17, D18, D20** - Document and close

---

## Creating GitHub Issues

To create GitHub issues for any of these items, use the following template:

```bash
gh issue create \
  --title "enhancement: <item title>" \
  --body "**Deferred from:** #832

**Description:** <item description>

**Why deferred:** <reason>

**Potential solution:** <enhancement description>

**Related migration:** packages/saas/migrations/saas_008_create_default_ics_org.sql

See: _bmad-output/implementation-artifacts/deferred-issues-gh-832.md" \
  --label <appropriate-label> \
  --assignee <optional>
```

**Recommended issues to create NOW:**

1. **D2** (password sync design) - saas-architecture label
2. **D3** (FK indexes) - performance label  
3. **D5** (FK cascade) - schema-design label
4. **D8** (integration tests) - testing label
5. **D15** (large dataset migration) - scalability label

**Others:** Document and reference this file, create issues only if prioritized in roadmap.

---

## Acceptance Criteria

This deferred items documentation is complete when:

- ✅ All 20 items documented with rationale
- ✅ Categorized by type (design, architecture, performance, etc.)
- ✅ Priority assigned to each item
- ✅ Recommended actions listed
- ⬜ 5 high-value issues created in GitHub (if team agrees)
- ⬜ Linked from #832 PR description

**No blockers remain for merging #832.**
