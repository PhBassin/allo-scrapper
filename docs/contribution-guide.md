# Contribution Guide — allo-scrapper

> Generated: 2026-05-21

## Workflow Overview

All contributions follow the **RED-GREEN-DOCS-COMMIT-PR** workflow:

```
1. ISSUE   → Verify or create a GitHub issue
2. BRANCH  → Create a dedicated feature branch from develop
3. RED     → Write failing tests first (commit)
4. GREEN   → Write minimal code to pass tests
5. DOCS    → Update README / AGENTS.md if API changed
6. COMMIT  → Atomic commits with Conventional Commits
7. PR      → Open Pull Request, wait for review
```

## Issue First

**Every PR must be linked to an issue.**

```bash
gh issue create --title "feat: description" --body "Details..." --label enhancement
gh issue create --title "fix: description" --body "Details..." --label bug
gh issue create --title "docs: description" --body "Details..." --label documentation
```

## Branch Naming

```
<type>/<issue-number>-<short-description>

Examples:
  feat/259-add-theater-modal
  fix/42-fix-parser-bug
  docs/266-update-readme
```

**Always branch from `develop`**, never from `main` or another feature branch.

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

refs #<issue>
```

### Types
`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `perf`, `ci`, `build`

### Scopes
`scraper`, `api`, `db`, `parser`, `client`, `docker`, `observability`

### Example
```
feat(scraper): add new theater parser strategy

Implements IScraperStrategy for Gaumont theaters.
Supports HTML and JSON-LD parsing.

refs #310
```

## Pull Request

```bash
git push -u origin feat/310-gaumont-strategy
gh pr create --title "feat(scraper): add Gaumont parser strategy"   --body "## Summary
- Added GaumontScraperStrategy
- Supports pagination
- Closes #310"
```

### PR Checklist
- [ ] All tests pass (`npm run test:run`)
- [ ] Code coverage maintained
- [ ] Conventional Commits used
- [ ] Documentation updated
- [ ] Version label added (`patch`, `minor`, or `major`)

## Testing Requirements

### Coverage Targets
- Lines: >= 80%
- Functions: >= 80%
- Statements: >= 80%
- Branches: >= 65%

### Test File Locations
- Co-located with source: `*.test.ts`
- Parser fixtures: `scraper/tests/fixtures/`
- E2E tests: `client/e2e/`

## Code Style

- **TypeScript strict mode** enforced
- **Prettier** for formatting
- **ESLint** for linting
- **Functional components** for React
- **Named exports** preferred

## Getting Help

- Read `AGENTS.md` for AI agent workflow
- Read `docs/` for architecture and API docs
- Use issues for feature requests and bug reports
