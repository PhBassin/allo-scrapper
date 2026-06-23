# 0001. Closed Theaters are hard-deleted (history is lost)

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

Theater rows represent physical cinema venues. They close — renovation, permanent shutdown, brand exit — and the question is how to represent a closed Theater in the data model. The current `theaters` table has no soft-delete column (`is_active`, `closed_at`, `deleted_at`, `archived_at`). The only way to remove a Theater today is `DELETE`, which cascades to all of its `showtimes` and `weekly_programs` rows.

## Decision

A closed Theater is **hard-deleted**. There is no soft-delete / closed-state column. Closing a Theater means `DELETE FROM theaters WHERE id = $1`, and the `ON DELETE CASCADE` foreign keys remove all historical `showtimes` and `weekly_programs` rows for that Theater.

We accept the **loss of historical data** (no "showtimes for UGC Bercy in 2024" after the venue closes) in exchange for schema simplicity. The team has reviewed three alternatives and chosen this one deliberately:

| Alternative | Why rejected |
|---|---|
| `closed_at TIMESTAMP NULL` | Best of both worlds (preserves history + records *when* it closed), but adds a column and scraper-skip logic. Rejected as more complexity than the current need justifies. |
| `is_active BOOLEAN` | Simpler than `closed_at` but loses the *when*. Same complexity cost as `closed_at` for less information. |
| Status quo (this ADR) | Match current code. Accept history loss for simplicity. |

## Consequences

**Easier:**
- Schema stays minimal — no soft-delete columns to maintain.
- No scraper code to skip "closed" rows.
- `DELETE` does what it says. No surprising soft-delete semantics.

**Harder:**
- Historical reporting per-Theater is bounded by the Theater's lifetime. Once a Theater closes, its data is gone.
- A future maintainer will likely propose `closed_at` to "fix" the history loss. This ADR is the explanation for why we have not.
- If historical reporting becomes a real product need, this decision must be revisited *before* a Theater closes — once the data is gone, it cannot be recovered.