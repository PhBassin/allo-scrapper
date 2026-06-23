# 0002. Drop `screen_count` — it's not a domain attribute

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

The `theaters` table has a `screen_count INTEGER` column. It was historically scraped from AlloCiné's HTML (via the `data-theater` attribute's `screenCount` field), exposed in the API, displayed on the public Theater detail page (`🎬 X salles`), shown in the admin theater table, and editable via the admin edit form (validated to be an integer in `[1, 50]`).

Despite this, `screen_count` is **never used in any `WHERE`, `ORDER BY`, or aggregation** in the server, scraper, or client. It is only displayed.

## Decision

`screen_count` is **not a domain attribute of a Theater**. It is scrapable metadata that we collect but do not use. Drop it from the model:

- Drop the column from the `theaters` table (migration).
- Remove parsing of `screenCount` from the scraper.
- Remove it from the `Theater` TypeScript type returned by the API.
- Remove it from the admin `EditTheaterModal` form, validation, and the `TheatersTable` column.
- Remove the `🎬 X salles` rendering from `TheaterHeader.tsx`.

The historical data in the column is discarded — there is no migration step that preserves it.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Keep `screen_count` as a domain attribute | It is collected and displayed but never queried. Surface area without value. We don't filter by screen count, sort by it, or report on it. The "5 salles" label is trivia. |
| Move `screen_count` to a `metadata` JSONB column | Same effect as dropping — `metadata` is the bin for "facts we keep but don't model." Dropping is more honest about the choice. |

## Consequences

**Easier:**
- Schema is one column lighter.
- Scraper doesn't need to parse a data attribute it doesn't use.
- API surface area shrinks (one fewer field per Theater).
- Admin form is one field shorter.

**Harder:**
- The "🎬 X salles" affordance on the public Theater detail page is gone. If users were relying on it for "this is a multiplex vs an art-house single-screen" filtering, that's lost. No evidence of user reliance on this affordance.
- Once dropped, the existing `screen_count` values are unrecoverable. If reporting needs emerge later ("average screens per theater per city"), this decision must be revisited *before* production usage accrues — historical values were never preserved.
- A future maintainer may propose re-adding it. This ADR is the explanation for why it was dropped.