# Contributing to allo-scrapper

Thanks for helping out! This guide explains how a change goes from idea to merged pull request. It applies to everyone, human or AI agent.

New to the project? Start with the [README](./README.md) to get the stack running locally.

## Workflow at a glance

1. **Issue** — find or open a GitHub issue describing the change.
2. **Branch** — create a dedicated branch from `develop`.
3. **Red** — write a failing test first, and commit it.
4. **Green** — write the minimal code that makes it pass.
5. **Docs** — update the README or the relevant page in `docs/` if behavior or the API changed.
6. **Commit** — keep commits atomic and follow Conventional Commits.
7. **Pull request** — open a PR against `develop` and wait for review.

## Start with an issue

Every pull request must be linked to an issue. Search the existing ones first; if none fits, open one with the matching label:

```bash
gh issue create --title "feat: description" --body "Details..." --label enhancement
gh issue create --title "fix: description" --body "Details..." --label bug
gh issue create --title "docs: description" --body "Details..." --label documentation
```

## Name your branch

```
main         ← Production releases
  └─ develop ← Integration branch
       └─ feat/*  ← Feature branches
       └─ fix/*   ← Bug fix branches
       └─ docs/*  ← Documentation
```

Always branch from `develop`, never from `main` or from another feature branch. Use the pattern `<type>/<issue-number>-<short-description>`:

```
feat/259-add-theater-modal
fix/42-fix-parser-bug
docs/266-update-readme
```

## Write commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

refs #<issue>
```

- **Types:** `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `perf`, `ci`, `build`
- **Scopes:** `scraper`, `api`, `db`, `parser`, `client`, `docker`, `observability`

For example:

```
feat(scraper): add new theater parser strategy

Implements IScraperStrategy for Gaumont theaters.
Supports HTML and JSON-LD parsing.

refs #310
```

The same format applies to your **PR title**: whichever merge method is used, the PR title becomes the commit subject on `develop`.

## Before you push

A `pre-push` Git hook runs most of the checks for you and **blocks the push if any of them fails**. It is installed automatically by `npm install` (through husky's `prepare` script). The checks, in order:

1. Build the shared protocol package: `npm run build --workspace=allo-scrapper-scraper-protocol`. The server and scraper type-checks need its compiled `dist/`, which is not committed.
2. Type-check the server and the scraper (`cd server && npx tsc --noEmit`, same in `scraper/`), and the client (`cd client && npx tsc -b`).
3. Run the server tests (`npm run test:run`) and the coverage check (`npm run test:coverage`), both in `server/`.
4. Run the scraper tests (`npm run test:run` in `scraper/`).

The hook runs everything **except the client type-check**, which only CI runs. If you changed anything in `client/`, run `cd client && npx tsc -b` yourself before pushing.

In a real emergency you can skip the hook with `git push --no-verify`. CI re-runs the type-checks and the server tests and coverage, but **not the scraper tests**, so only skip the hook when you are sure they pass.

## Open a pull request

Push your branch and open the PR against `develop`, mentioning the issue it closes:

```bash
git push -u origin feat/310-gaumont-strategy
gh pr create --title "feat(scraper): add Gaumont parser strategy" --body "## Summary
- Added GaumontScraperStrategy
- Supports pagination
- Closes #310"
```

Before asking for review, check that:

- [ ] The checks in [Before you push](#before-you-push) pass
- [ ] Code coverage is maintained
- [ ] Commits follow Conventional Commits
- [ ] The PR title follows Conventional Commits (it becomes the commit subject on `develop`)
- [ ] Documentation is updated
- [ ] Release PRs (`develop`→`main`) only: a version label is added (`patch`, `minor`, or `major`)

## Merge your PR

Two merge methods are allowed into `develop`:

- **Squash** small PRs, and any PR whose commits are noise (wip, fixups).
- Use a **merge commit** for a feature branch whose commits are atomic and meaningful, for example one per sub-issue. Keeping them lets `git bisect`, `git blame` and partial reverts work at that granularity. Such a branch must contain only clean Conventional Commits; if it doesn't, squash it.

## Multi-part work

When a piece of work is split into sub-issues that depend on each other, **don't stack pull requests** (one PR targeting another PR's branch): every merge then needs a manual retarget, and every fix a rebase cascade. Instead:

1. Create one feature branch for the parent issue: `feat/<parent#>-<desc>`.
2. Make one commit (or a few) per sub-issue, referencing it with `Refs #<sub#>`.
3. Open a single PR to `develop` that closes the parent and every sub-issue, and merge it with a merge commit.

Sub-issues that are independent of each other get their own branch and PR off `develop`, as usual.

## Releases and versioning

Releases happen by merging a **release PR** from `develop` into `main`. On that merge, CI bumps the version, tags it, updates `CHANGELOG.md`, publishes the GitHub release and triggers the Docker build. `main` is then merged back into `develop` automatically.

The bump type comes from the release PR only:

1. its `major`, `minor` or `patch` label, if present;
2. otherwise its title: `BREAKING CHANGE:` or `[major]` → major, `feat:` → minor, `fix:` → patch;
3. otherwise patch.

Release PRs are titled `chore(release): …`, which matches no rule, so **always label them**. Labels on PRs into `develop` have no effect on the version.

## Testing expectations

Server coverage is enforced per file, and the push is blocked below these thresholds:

| Metric | Minimum |
|---|---|
| Lines | 80% |
| Functions | 80% |
| Statements | 80% |
| Branches | 65% |

Where tests live:

- Unit tests sit next to the code they cover, as `*.test.ts`.
- Parser fixtures go in `scraper/tests/fixtures/`.
- End-to-end Playwright tests live in `e2e/` at the repository root.

## Code style

- TypeScript strict mode everywhere.
- Functional components for React.
- Prefer named exports.
- The client is linted with ESLint (`npm run lint --workspace=client`).

## Getting help

- Architecture and API docs live in [`docs/`](./docs/README.md).
- Use issues for feature requests and bug reports.
- AI coding agents also read [`AGENTS.md`](./AGENTS.md), which covers agent-specific guidance.
