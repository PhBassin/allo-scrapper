# Domain docs

This repo uses a **single-context** layout. All engineering skills that need to read the project's domain language or past architectural decisions should look in one place.

## Expected locations

- **Domain language / ubiquitous vocabulary:** `CONTEXT.md` at the **repo root**.
- **Architectural Decision Records:** `docs/adr/` at the **repo root**, with files named `NNNN-short-title.md` (e.g. `0001-use-redis-for-queue.md`).

## Consumer rules

- If `CONTEXT.md` does not exist yet, the skill should either prompt the user to create it (one-screen primer on what a domain context contains) OR fall back to `docs/project-overview.md` and `docs/architecture-*.md` and proceed. Do not silently invent domain terms.
- If `docs/adr/` does not exist, the skill should treat it as "no ADRs on record" and proceed without error.
- Both files are written **only** by the user or by the `domain-modeling` / `grill-with-docs` skills. Other skills are read-only on these paths.