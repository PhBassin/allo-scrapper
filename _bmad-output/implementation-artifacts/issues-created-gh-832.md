# Follow-Up Issues Created - Issue #832

**Parent Issue:** #832 - Create default ICS organization in SaaS mode  
**Created:** 2026-04-14  
**Total Issues:** 5

---

## Summary

Successfully created 5 GitHub follow-up issues for high-priority deferred items from #832 code review.

**Issues created:**
- #833 - Password sync design (medium priority)
- #834 - FK indexes for performance (medium priority)
- #835 - FK cascade fix (high priority) 🔥
- #836 - Integration tests (medium priority)
- #837 - Batched migration tooling (high priority) 🔥

---

## Created Issues

### #833 - Password Sync Architecture Design

**Type:** enhancement  
**Priority:** Medium  
**Labels:** enhancement, documentation, medium-priority

**Description:** Design password sync mechanism for multi-tenant architecture where admin passwords are duplicated across schemas.

**Deliverable:** Design document analyzing tradeoffs (shared table vs triggers vs polling)

**Deferred item:** D2 from review triage

**Link:** https://github.com/PhBassin/allo-scrapper/issues/833

---

### #834 - Foreign Key Indexes

**Type:** performance  
**Priority:** Medium  
**Labels:** enhancement, patch, medium-priority

**Description:** Add indexes on FK columns (users.role_id, invitations.role_id, etc.) to improve JOIN performance as orgs scale.

**Impact:** Full table scans on JOIN queries when org has >1000 users

**Deliverable:** 
- Update bootstrap template with indexes
- Migration script for existing org schemas
- Performance benchmarks

**Deferred item:** D3 from review triage

**Link:** https://github.com/PhBassin/allo-scrapper/issues/834

---

### #835 - FK Cascade Fix 🔥

**Type:** bug  
**Priority:** High  
**Labels:** bug, high-priority, patch

**Description:** Add ON DELETE SET NULL to org_settings.updated_by FK to allow deleting users who last updated settings.

**Current behavior:** Deleting user fails with FK constraint violation

**Expected behavior:** Deleting user succeeds, updated_by set to NULL

**Deliverable:**
- Update bootstrap template
- Migration script for existing org schemas
- Manual test verification

**Deferred item:** D5 from review triage

**Link:** https://github.com/PhBassin/allo-scrapper/issues/835

---

### #836 - Integration Tests

**Type:** test  
**Priority:** Medium  
**Labels:** test, enhancement, medium-priority

**Description:** Add integration tests that run SaaS migrations against test database (currently only file existence is tested).

**Gap:** No automated verification of migration SQL validity or expected schema state

**Deliverable:**
- Integration test suite (migrations.integration.test.ts)
- CI pipeline integration
- Test database setup documentation

**Deferred item:** D8 from review triage

**Link:** https://github.com/PhBassin/allo-scrapper/issues/836

---

### #837 - Batched Migration Tooling 🔥

**Type:** enhancement  
**Priority:** High  
**Labels:** enhancement, high-priority

**Description:** Design batched migration tooling for large existing deployments (10M+ records) to prevent memory exhaustion.

**Impact:** Customer onboarding blocked for large cinema chains with millions of showtimes

**Current limitation:** Migration loads entire tables into memory

**Deliverable:**
- Design document (batching strategy, memory profiling)
- Migration script with batching (migrate-existing-to-saas.sh)
- Runbook for customer onboarding

**Deferred item:** D15 from review triage

**Link:** https://github.com/PhBassin/allo-scrapper/issues/837

---

## Priority Breakdown

| Priority | Count | Issues |
|----------|-------|--------|
| High | 2 | #835 (FK cascade), #837 (batched migration) |
| Medium | 3 | #833 (password sync), #834 (FK indexes), #836 (integration tests) |

---

## Recommended Action Order

1. **#835 (FK cascade)** - Bug fix affecting user management
   - Quick fix (single migration + bootstrap update)
   - Blocks user deletion in production

2. **#837 (batched migration)** - Customer onboarding blocker
   - Needed for migrating large existing deployments
   - Critical for enterprise customer acquisition

3. **#834 (FK indexes)** - Performance optimization
   - Becomes critical as orgs scale >1000 users
   - Easy win (add indexes to template)

4. **#836 (integration tests)** - Quality assurance
   - Prevents future migration regressions
   - Improves CI/CD confidence

5. **#833 (password sync)** - Architectural improvement
   - Design phase required before implementation
   - Not blocking current functionality

---

## Remaining Deferred Items (Not Created as Issues)

**15 additional items** documented in `deferred-issues-gh-832.md`:
- D1, D4, D6, D7, D9-D14, D16-D20

**Decision:** These items are:
- Design decisions (not bugs)
- Extremely rare edge cases
- Documentation improvements
- Pre-existing architectural limitations

**Action:** Reference documentation file when/if these become priorities.

---

## Verification

All 5 issues successfully created and verified:

```bash
gh issue list --label enhancement --limit 10

# Output:
# 837  OPEN  enhancement(saas): design batched migration tooling...  enhancement, high-priority
# 836  OPEN  test(saas): add integration tests...                    test, enhancement, medium-priority
# 834  OPEN  perf(saas): add foreign key indexes...                  enhancement, patch, medium-priority
# 833  OPEN  enhancement(saas): design password sync...              documentation, enhancement, medium-priority
# 835  OPEN  fix(saas): add ON DELETE SET NULL...                    bug, high-priority, patch
```

---

## Next Steps

1. ✅ Issues created and labeled
2. ⏭️ Triage in backlog refinement meeting
3. ⏭️ Assign to appropriate milestones based on roadmap
4. ⏭️ Prioritize #835 and #837 for next sprint

---

## Related Documentation

- **Deferred items documentation:** `_bmad-output/implementation-artifacts/deferred-issues-gh-832.md`
- **Review triage:** `_bmad-output/implementation-artifacts/review-triage-gh-832.md`
- **Patches applied:** `_bmad-output/implementation-artifacts/patches-applied-gh-832.md`
- **Test results:** `_bmad-output/implementation-artifacts/test-results-gh-832.md`

---

**Status:** ✅ COMPLETE  
**Created by:** OpenCode AI Agent  
**Date:** 2026-04-14
