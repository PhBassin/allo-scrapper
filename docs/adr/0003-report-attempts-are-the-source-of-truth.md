# 0003. A report's attempts are the source of truth for its status and its resumability

- **Status:** Accepted
- **Date:** 2026-11-15
- **Implemented by:** #1365 (part of #1364)

## Context

A ScrapeReport tracks one scrape run. It holds two kinds of information:

- **run counters** (`total_theaters`, `successful_theaters`, `failed_theaters`, movie and showtime totals, the `errors` list), filled from the run's `ScrapeSummary`;
- **ScrapeAttempts**, one row per `(theater, date)` pair, each with its own status, error type, HTTP code and message.

Until now the report status came from the counters alone (`failed_theaters === 0` → `success`, some successful theaters → `partial_success`, otherwise `failed`). The rule had three copies in `scraper/src/index.ts` (consumer, cron and direct runs). It could never produce `rate_limited`, although the database allows it (migration 017). A run that hit a 429 and cascaded `not_attempted` to the remaining theaters therefore showed up as `partial_success`, like a run with one broken date.

The UI tied Resume to that status: the button only appeared on `rate_limited` reports, so no report ever offered it. Report #20 had a 429 on one theater and a cascade on the last ones. It showed « Succès partiel », one error, and nothing the user could act on.

The counters cannot tell these cases apart. "One theater failed" does not say whether its dates failed, were throttled or were never tried. The attempts do say it, pair by pair, and Resume already works from them: `getPendingScrapeAttempts` re-scrapes the `failed | rate_limited | not_attempted` pairs.

## Decision

A report's ScrapeAttempts are the source of truth for both its **status** and its **resumability**.

**Status.** One shared function, `deriveReportStatus` (`scraper/src/scraper/report-status.ts`), derives the final status of every run (consumer, cron, direct), in this priority:

1. `rate_limited` if any attempt is `rate_limited`;
2. `success` if every attempt is `success`;
3. `failed` if no attempt delivered data (today: no `success`);
4. `partial_success` otherwise.

A run that recorded **no attempt** keeps the counter rule. The counters stay on the report as run statistics; they no longer decide its status.

`scrape_schedules.last_run_status` keeps its domain (`success | failed | partial_success`) and records a `rate_limited` run as `partial_success`.

**Resumability.** A report is resumable when it has at least one attempt in `failed | rate_limited | not_attempted`. That set is defined once (`RESUMABLE_ATTEMPT_STATUSES`, `server/src/db/scrape-attempt-queries.ts`). It drives both what a Resume sends (`getPendingScrapeAttempts`) and what the report details offer (`resumable_count`). The UI offers « Reprendre (N dates) » whenever `resumable_count > 0` and the user holds `scraper:trigger`, whatever the report status.

For the attempts to stand as the truth, a run accounts for every pair it plans:

- it records its attempts under its own report id;
- a theater whose metadata cannot be loaded gets a `failed` attempt for each planned date;
- a resume run only plans the parent's pending pairs, including in its rate-limit cascade.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Keep the counter rule and just show the Resume button on `partial_success` too | The status would still hide a 429. A `partial_success` report may have nothing left to resume, and a `success` one may have (e.g. a `failed` date on a theater that otherwise succeeded). The button must follow the attempts anyway. |
| Mix both: counters for the status, attempts for the button | Two sources that can disagree (a report « Succès » with a « Reprendre » button and no explanation). One source is simpler to explain and to test. |
| Use `ScrapeSummary.status = 'rate_limited'` (set by the run) for the report status | Only covers the 429 case and lives only in memory. The attempts are persisted and also cover failed and never-tried pairs. |

## Consequences

**Easier:**
- A 429 run now reads as `rate_limited`, and any report with unfinished pairs can be resumed from its page.
- The status rule has one implementation and one test suite instead of three copies.
- New attempt statuses (e.g. a future `partial`) only need to join the "delivered data" set or the resumable set.

**Harder:**
- The status depends on the attempts being written. A run that writes none (no report id, or the attempts query fails at the end) falls back to the counters, so the two rules must both be kept.
- Reports finished before this change keep their counter-based status; only new runs are derived from attempts.
- A run that dies before finishing leaves its report `running` with `pending` attempts. This decision does not cover that case.
