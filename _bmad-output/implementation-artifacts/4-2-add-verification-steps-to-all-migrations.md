# Story 4.2: Add Verification Steps to All Migrations

Status: done

<!-- Auto-generated during BMAD sync 2026-05-01 -->
<!-- PR #951 merged; story implemented outside formal BMAD workflow -->

## Story

Add post-migration verification tests covering populated database rerun scenarios — proving migrations are truly idempotent on databases with existing data. Tests run migrations twice on a seeded database and verify no errors on the second run.

## Agent Record

### Implementation
- **PR**: #951
- **Date merged**: 2026-05-01
- **Method**: Direct implementation + CI validation
- **Tests**: `test(migrations): cover populated database rerun scenarios`

### Notes
- Story file created retroactively during BMAD sync (2026-05-01)
- Acceptance criteria verified through CI: migrations re-run on seeded DB without errors
