# AGENTS.md CR Findings Remediation Plan

> **For Hermes:** Execute via `majordome-subagent-dev-loop`. This document is a **post-CR GP** only. Do not edit files during review. Apply changes only after an explicit DS/implementation order. After the next `CR`, the mandatory next BMAD step is `GP`, then **WAIT**.

**Goal:** Adjust `AGENTS.md` so the local CR passes by restoring the critical runtime truths and plan-required structure that were lost in the first rewrite, while keeping the file dense and operator-first.

**Architecture:** Keep `AGENTS.md` as a compact operational index, but restore the minimum set of repo truths that the CR identified as too expensive to rediscover. Fix only the documented findings in `AGENTS.md`; do not widen scope into README or adjacent docs during this pass.

**Tech Stack:** Markdown, npm workspaces, Docker Compose, Playwright, Express/TypeScript server, BMAD workflow docs.

---

## Canonical Direction

The corrected `AGENTS.md` must remain **operator-first and compact**, but it must also restore the truths explicitly required by the original optimization plan and flagged by CR:

1. restore **service ownership** in `Repo Topology`
2. restore a distinct **Fast Start / What To Run** section
3. restore **dynamic SaaS loading** in runtime truths
4. restore the **scraper RUN_MODE** / production topology guardrail
5. restore the **Testcontainers / CI integration-test** guardrail
6. restore the **CI branch-prefix** guardrail
7. narrow the **post-GP** wording back to the precise repo contract
8. make the auth/superadmin bullet exact enough to avoid overclaiming

This is a repair pass, not a second redesign.

---

## Biggest Remaining Risk

**Risk:** over-correcting the CR findings could bloat `AGENTS.md` back into a long fact dump and undo the useful scanability gained in the rewrite.

So the implementation must restore only the findings-backed truths, in the shortest wording that remains precise.

---

## Scope

### Modify
- `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

### Read/verify while editing
- `/home/debian/agents/hermes/allo-scrapper/package.json`
- `/home/debian/agents/hermes/allo-scrapper/docker-compose.dev.yml`
- `/home/debian/agents/hermes/allo-scrapper/docker-compose.yml`
- `/home/debian/agents/hermes/allo-scrapper/playwright.config.ts`
- `/home/debian/agents/hermes/allo-scrapper/client/vite.config.ts`
- `/home/debian/agents/hermes/allo-scrapper/scripts/install-hooks.sh`
- `/home/debian/agents/hermes/allo-scrapper/scripts/hooks/pre-push`
- `/home/debian/agents/hermes/allo-scrapper/server/src/index.ts`
- `/home/debian/agents/hermes/allo-scrapper/server/src/services/auth-service.ts`
- `/home/debian/agents/hermes/allo-scrapper/server/src/db/schema.ts`
- `/home/debian/agents/hermes/allo-scrapper/.github/workflows/ci.yml`
- `/home/debian/agents/hermes/allo-scrapper/.github/workflows/version-tag.yml`
- `/home/debian/agents/hermes/allo-scrapper/scraper/src/index.ts`

### Explicitly out of scope for this pass
- `README.md`
- `docs/guides/development/*`
- `docs/project/*`
- workflow YAML changes

Those docs may remain inconsistent after this pass; the immediate target is only to make the `AGENTS.md` CR pass.

---

## Acceptance Target

The next CR should be able to verify all of the following from `AGENTS.md` alone:

- `Repo Topology` tells what `server` and `scraper` actually own/do
- `Fast Start / What To Run` exists as a distinct section
- `Verification Shortcuts` distinguishes quick checks vs CI-like checks clearly enough
- `Runtime Truths That Drift Easily` includes the dynamic SaaS loading truth
- `Runtime Truths` keeps `/api/auth/login` and the exact-enough `superadmin` scope rule
- `Testing / E2E Traps` or verification text preserves the Testcontainers/CI integration-test guardrail
- `Workflow Gates` explicitly preserves the CI branch-prefix guardrail
- post-`GP` wording is narrowed back to the repo-specific lock (`CS`, `DS`, `push-flow`, merge-related actions), not a broad ban on all execution
- the file remains compact and obviously more scanable than the old version

---

## Bite-Sized Execution Tasks

### Task 1: Restore service ownership in Repo Topology

**Objective:** Reintroduce the minimum high-value runtime ownership facts for `server` and `scraper`.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`
- Read: `/home/debian/agents/hermes/allo-scrapper/server/src/index.ts`
- Read: `/home/debian/agents/hermes/allo-scrapper/scraper/src/index.ts`
- Read: `/home/debian/agents/hermes/allo-scrapper/docker-compose.yml`

**Step 1:** Add back a concise `server` bullet saying it initializes DB, subscribes to Redis progress, and conditionally loads SaaS.

**Step 2:** Add back a concise `scraper` bullet saying it is a separate service with `RUN_MODE` support (`oneshot`, `consumer`, `cron`, `direct`).

**Step 3:** If space allows, keep the production `consumer`/`cron` split in the same bullet; otherwise mention it in the shortest possible clause.

**Verification checkpoint:** `Repo Topology` again answers “what owns what?” instead of only “what command runs what?”.

---

### Task 2: Recreate a distinct Fast Start / What To Run section

**Objective:** Match the plan structure and isolate startup decisions from topology facts.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`
- Read: `/home/debian/agents/hermes/allo-scrapper/package.json`
- Read: `/home/debian/agents/hermes/allo-scrapper/docker-compose.dev.yml`

**Step 1:** Move startup commands out of `Repo Topology` into a separate section named exactly `Fast Start / What To Run`.

**Step 2:** Keep only:
- root `npm run dev`
- what dev compose starts
- what it does not start
- how to run scraper separately
- root `npm run build` vs full workspace build if still helpful here

**Step 3:** Keep wording short; no new theory.

**Verification checkpoint:** the section exists as a standalone decision aid and satisfies the original plan structure.

---

### Task 3: Tighten Verification Shortcuts into quick vs CI-like checks

**Objective:** Make validation choices more explicit without adding verbosity.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`
- Read: `/home/debian/agents/hermes/allo-scrapper/scripts/hooks/pre-push`
- Read: `/home/debian/agents/hermes/allo-scrapper/.github/workflows/ci.yml`

**Step 1:** Split or label the bullets so a reader can distinguish:
- fast local checks
- CI-like checks

**Step 2:** Reintroduce the Testcontainers note in the smallest honest wording, e.g. server integration tests rely on Testcontainers; CI does not provision Redis separately.

**Step 3:** Keep the real pre-push gate visible.

**Verification checkpoint:** a reviewer can see both the quick path and the CI-like path, plus the Testcontainers guardrail.

---

### Task 4: Repair runtime truths without overclaiming

**Objective:** Restore missing runtime truths and remove over-broad formulations.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`
- Read: `/home/debian/agents/hermes/allo-scrapper/server/src/index.ts`
- Read: `/home/debian/agents/hermes/allo-scrapper/server/src/services/auth-service.ts`
- Read: `/home/debian/agents/hermes/allo-scrapper/server/src/db/schema.ts`

**Step 1:** Add back the dynamic SaaS loading truth explicitly.

**Step 2:** Refine the superadmin bullet so it does not overstate the condition. It must reflect that the JWT scope is granted for system-role admins with no `org_slug`, specifically on the admin role path.

**Step 3:** Keep the cinema seed bullet precise enough to avoid “table empty” oversimplification if concise wording can preserve truth better.

**Verification checkpoint:** no runtime bullet is materially broader than the code.

---

### Task 5: Repair workflow guardrails precisely

**Objective:** Restore the workflow safety rails removed or weakened by the rewrite.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`
- Read: `/home/debian/agents/hermes/allo-scrapper/.github/workflows/ci.yml`
- Read: `/home/debian/agents/hermes/allo-scrapper/.github/workflows/version-tag.yml`

**Step 1:** Reintroduce the CI push branch-prefix guardrail explicitly: `feat/**`, `fix/**`, `docs/**`, `chore/**`, `ci/**`, `refactor/**`, `test/**`, `perf/**`.

**Step 2:** Narrow the post-`GP` wording back to the repo contract: stop and wait before `CS`, `DS`, `push-flow`, or merge-related action.

**Step 3:** Keep `done = merged into develop`.

**Step 4:** Avoid repeating the version-label rule in two places unless the repetition is justified by a linked anchor requirement.

**Verification checkpoint:** workflow wording is precise, repo-grounded, and no longer broader than neighboring docs.

---

### Task 6: Final density pass

**Objective:** Ensure the corrected file fixes CR findings without regressing to bloated documentation.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

**Step 1:** Remove any duplicate wording introduced while restoring findings.

**Step 2:** Keep source-of-truth pointers aligned with restored truths; add `server/src/index.ts` only if needed to support the reintroduced SaaS/server-ownership claims.

**Step 3:** Prefer bullets that answer operator questions directly in under one line where possible.

**Verification checkpoint:** the file is denser than the old version, but no longer missing CR-critical truths.

---

## Recommended Next BMAD Step

If you approve implementation of this corrective plan, the next step is **DS**.

Per house workflow, this GP ends here and must **WAIT** for your explicit order.
