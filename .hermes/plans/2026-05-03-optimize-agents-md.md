# AGENTS.md Optimization Plan

> **For Hermes:** Use `majordome-subagent-dev-loop` for execution. Validate each factual claim against source files before editing. After local review (`CR`), the mandatory next BMAD step is `GP`, then **WAIT** for an explicit new order before any further execution or push-related action.

**Goal:** Refactor `AGENTS.md` into a denser, lower-drift operator guide that keeps only repo-critical facts, points readers to canonical deeper docs, and makes verification paths explicit.

**Architecture:** Treat `AGENTS.md` as a high-signal operational index rather than a long-form handbook. Keep only facts that are both high-frequency and high-risk to get wrong; move broad explanatory material behind links to existing docs. Rewrite section structure around decision moments (what to run, what not to assume, where drift usually happens), and verify every retained claim against code/config.

**Tech Stack:** Markdown, npm workspaces, Docker Compose, Playwright, Vite proxy, Express/TypeScript server, BMAD workflow docs.

---

## Why This Optimization Is Worth Doing

The current `AGENTS.md` is already better than the average repo guide, which is a low bar but still. However, it can be improved in three important ways:

1. **Section design is factual but not operator-first.** The file lists truths, but it does not yet prioritize the decisions an agent must make quickly.
2. **Some claims deserve explicit source anchors.** The content is accurate, but future edits will drift unless the plan adds clear verification targets.
3. **The file risks becoming a duplicate of broader docs.** `AGENTS.md` should summarize sharp edges and routing rules, not silently become a second README.

The optimization target is therefore **not** “add more content.” It is:
- compress noise,
- preserve high-value gotchas,
- add maintenance discipline,
- and make contradictions easier to spot.

---

## Canonical Design Choice

**Canonical direction:** `AGENTS.md` should become a **high-density execution index** with concise sections, each tied to concrete source-of-truth files.

That means:
- keep fast truths in `AGENTS.md`
- link outward for depth
- prefer “do / don’t assume / verify here” formatting
- avoid duplicating full workflows already maintained elsewhere unless they are critical gating rules

---

## Biggest Unresolved Risk

**Risk:** Over-optimizing for brevity could strip useful operational detail from `AGENTS.md` and push too much lookup cost into other docs.

This must be balanced in implementation by preserving the handful of facts that repeatedly prevent wasted time:
- Docker dev topology
- missing scraper in dev compose
- Playwright server-start expectation
- `/test` fixture gating
- auth/superadmin login truth
- BMAD order and PR gating semantics

If this balance is mishandled, the file becomes elegant but less useful — the usual crime of documentation cleanup.

---

## Files To Inspect / Modify

### Primary edit target
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

### Verification sources that justify AGENTS.md claims
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/package.json`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/docker-compose.dev.yml`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/playwright.config.ts`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/scripts/install-hooks.sh`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/scripts/hooks/pre-push`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/client/vite.config.ts`
- Read/verify: `/home/debian/agents/hermes/allo-scrapper/server/src/services/auth-service.ts`

### Docs to cross-check for consistency after the AGENTS.md rewrite
- Read/patch if needed later: `/home/debian/agents/hermes/allo-scrapper/README.md`
- Read/patch if needed later: `/home/debian/agents/hermes/allo-scrapper/docs/guides/development/README.md`
- Read/patch if needed later: `/home/debian/agents/hermes/allo-scrapper/docs/guides/development/contributing.md`
- Read/patch if needed later: `/home/debian/agents/hermes/allo-scrapper/docs/project/README.md`
- Read/patch if needed later: `/home/debian/agents/hermes/allo-scrapper/docs/project/agents.md`

---

## Proposed Target Structure For AGENTS.md

Replace the current “fact buckets” layout with the following operator-first structure:

1. **Repo Topology**
   - workspaces
   - real entrypoints
   - what each service actually owns

2. **Fast Start / What To Run**
   - exact dev commands
   - what `npm run dev` really starts
   - what it does **not** start

3. **Verification Shortcuts**
   - smallest trustworthy commands per area
   - separate “fast local checks” from “CI-like checks”

4. **Testing / E2E Traps**
   - Playwright server behavior
   - base URL default
   - explicit test-selection behavior
   - fixture endpoint gating

5. **Runtime Truths That Drift Easily**
   - auto-migrate default
   - cinema seeding condition
   - dynamic SaaS loading
   - auth/superadmin truth
   - Vite `/api` and `/test` proxy behavior

6. **Workflow Gates**
   - issue-first + branch-from-develop
   - PR/body expectations
   - BMAD `done`
   - `DS -> CR -> GP -> WAIT`
   - no auto-advance without explicit order

7. **Source-of-Truth Pointers**
   - one short subsection mapping major claims to exact files
   - this section is meant to reduce future doc drift

---

## Optimization Principles To Apply During Editing

### Principle 1: Keep only expensive-to-rediscover facts
Retain statements that save debugging or wrong assumptions. Remove or compress anything obvious from file names alone.

### Principle 2: Prefer “negative knowledge” where useful
Facts of the form “X does **not** do Y” are unusually valuable in agent docs. Preserve them aggressively.
Examples already worth keeping:
- `docker-compose.dev.yml` does **not** start the scraper
- Playwright does **not** start the web server
- `/test/*` is **not** available outside gated runtimes
- `done` does **not** mean “PR opened”

### Principle 3: Make verification paths visible
Where a claim is easy to drift, pair it mentally — and where concise, textually — with the file that proves it.

### Principle 4: Avoid README duplication
If a paragraph would be equally at home in `README.md`, it is probably too broad for `AGENTS.md`.

### Principle 5: Optimize for scan speed
Use compact bullets, short subsections, and grouped gotchas. A tired agent should find the right truth in under 10 seconds.

---

## Bite-Sized Execution Tasks

### Task 1: Snapshot the current AGENTS.md information architecture

**Objective:** Identify what should be kept, compressed, merged, or moved.

**Files:**
- Read: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

**Step 1: Classify each current section**
Create a quick keep/merge/rewrite matrix for:
- Repo Shape
- Commands That Matter
- Focused Verification
- CI And Hooks
- Testing Quirks
- Runtime Gotchas
- Workflow Conventions
- Current Behavior Worth Trusting Over Older Docs

**Step 2: Mark duplication risk**
For each section, note whether it duplicates README/docs or contains unique operational knowledge.

**Step 3: Verification checkpoint**
Expected result: a concrete edit map saying what survives in the optimized version.

---

### Task 2: Build a claim-to-source map before rewriting

**Objective:** Prevent accidental weakening of accurate guidance.

**Files:**
- Read: `package.json`
- Read: `docker-compose.dev.yml`
- Read: `playwright.config.ts`
- Read: `scripts/install-hooks.sh`
- Read: `scripts/hooks/pre-push`
- Read: `client/vite.config.ts`
- Read: `server/src/services/auth-service.ts`

**Step 1: Map each AGENTS claim to source**
At minimum, map:
- Node/npm engines -> `package.json`
- dev topology -> `docker-compose.dev.yml`
- Playwright runtime assumptions -> `playwright.config.ts`
- hook installation -> `scripts/install-hooks.sh`
- pre-push reality -> `scripts/hooks/pre-push`
- Vite proxy behavior -> `client/vite.config.ts`
- superadmin scope behavior -> `server/src/services/auth-service.ts`

**Step 2: Identify drift-prone claims**
Mark which statements most often rot after refactors.

**Step 3: Verification checkpoint**
Expected result: no AGENTS bullet remains “trust me bro”; each has a proving file.

---

### Task 3: Rewrite AGENTS.md into the target structure

**Objective:** Replace the current layout with the operator-first structure above.

**Files:**
- Modify: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

**Step 1: Rewrite section headers**
Adopt the target structure:
- Repo Topology
- Fast Start / What To Run
- Verification Shortcuts
- Testing / E2E Traps
- Runtime Truths That Drift Easily
- Workflow Gates
- Source-of-Truth Pointers

**Step 2: Compress without losing sharp edges**
Examples of likely compression:
- merge `Repo Shape` + parts of `Runtime Gotchas` into a tighter “topology/runtime” scan
- merge `Commands That Matter` + `Focused Verification` into “what to run” vs “what verifies”
- fold `Current Behavior Worth Trusting Over Older Docs` into “Runtime Truths That Drift Easily”

**Step 3: Preserve high-value negatives**
Ensure the optimized file still explicitly says:
- dev compose does not run scraper
- Playwright does not launch the app
- `/test` fixtures are gated
- `done` means merged into `develop`

**Step 4: Add explicit pointer bullets where justified**
For example:
- “Proxy truth: `client/vite.config.ts`”
- “Auth scope truth: `server/src/services/auth-service.ts`”

**Step 5: Verification checkpoint**
Expected result: shorter or equal length, better scanability, zero loss of critical operational guidance.

---

### Task 4: Run a consistency sweep against adjacent workflow docs

**Objective:** Ensure the optimized AGENTS wording does not reintroduce contradictions elsewhere.

**Files:**
- Read: `README.md`
- Read: `docs/guides/development/README.md`
- Read: `docs/guides/development/contributing.md`
- Read: `docs/project/README.md`
- Read: `docs/project/agents.md`

**Step 1: Compare workflow wording**
Verify the rewritten `AGENTS.md` still aligns with:
- issue-first branching
n- PR/body conventions
- BMAD order
- explicit wait after `GP`

**Step 2: Compare command/runtime claims**
Ensure no neighbor doc now contradicts the optimized AGENTS wording.

**Step 3: Decide whether follow-up patches are required**
If contradictions appear, log them explicitly for a separate docs sync patch rather than silently ignoring them.

**Step 4: Verification checkpoint**
Expected result: AGENTS optimization does not create a split-brain repo.

---

### Task 5: Perform a local review pass focused on density and drift resistance

**Objective:** Review the rewritten file as an operator aid, not as prose.

**Files:**
- Read: `/home/debian/agents/hermes/allo-scrapper/AGENTS.md`

**Step 1: Scan-time review**
Ask:
- Can an agent find the dev topology in under 10 seconds?
- Can an agent find the E2E gotchas in under 10 seconds?
- Can an agent find workflow gates in under 10 seconds?

**Step 2: Drift review**
Ask:
- Which bullets will likely break after config changes?
- Do they have source anchors or concise wording that will age better?

**Step 3: Trim vanity language**
Remove anything that sounds polished but does not change operator behavior.

**Step 4: Verification checkpoint**
Expected result: high signal, low sentimentality, low duplication.

---

## Suggested Editing Patterns

### Example pattern A: operator-first bullets
Prefer:
- `npm run dev` starts `db`, `redis`, `server`, and `client` via `docker-compose.dev.yml`.
- It does **not** start the scraper worker; run scraper separately for scraping flows.

Over:
- “The development environment consists of several coordinated services...”

### Example pattern B: verification-led guidance
Prefer:
- Hook installer: `./scripts/install-hooks.sh`
- Real pre-push checks: `scripts/hooks/pre-push` -> `cd server && npx tsc --noEmit && npm run test:run`

Over:
- “Git hooks are installed to help maintain quality.”

### Example pattern C: drift-resistant truth bullets
Prefer:
- Superadmin login truth: authenticate through `/api/auth/login`; the JWT gets `scope: 'superadmin'` only for system-role admins without an org slug.

Over:
- “Admins use the auth system in the standard way.”

---

## What Success Looks Like

A successful optimization yields an `AGENTS.md` that:
- stays under tight cognitive load,
- keeps only high-value facts,
- reduces future contradiction risk,
- points directly to proving files for fragile claims,
- and is clearly more useful during active implementation/debugging than the current version.

---

## Out of Scope

Do **not** in this change:
- rewrite all repo docs again unless contradictions are discovered
- invent new workflow rules
- add speculative sections for tools or environments not present in source
- convert AGENTS into a full onboarding manual

---

## Verification Commands For The Future Execution Pass

Use these exact commands during implementation/review:

```bash
git diff -- AGENTS.md
```

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('AGENTS.md').read_text()
print('lines=', len(text.splitlines()))
print('chars=', len(text))
PY
```

```bash
gh pr status || true
```

Expected: no accidental PR-side claim changes are implied by the doc rewrite alone.

---

## Recommended Next BMAD Step

This plan is now ready.

**Recommended next step:** `DS` only if you explicitly want me to execute the `AGENTS.md` optimization now.

Under the house workflow, I stop here after `GP` and wait for your order.