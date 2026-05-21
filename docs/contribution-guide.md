# Contribution Guide — allo-scrapper

## Development Workflow (from AGENTS.md)

### 1. Issue First
Every PR must link to an issue. Create one with the appropriate label:
- `bug` — Bug fixes
- `enhancement` — New features
- `documentation` — Docs/chores

### 2. Branch Naming
```
<type>/<issue-number>-<short-description>
```
Types: `feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `refactor/`, `test/`, `perf/`

### 3. RED-GREEN-REFACTOR
1. Write failing test → commit
2. Implement minimal code → commit
3. Refactor if needed

### 4. Conventional Commits
```
<type>(<scope>): <description>
```
Scopes: `scraper`, `api`, `db`, `parser`, `client`, `docker`, `observability`

### 5. Pull Request
- All tests pass
- Code coverage maintained
- Documentation updated
- Version label added (`patch`, `minor`, `major`)

## Code Style
- **TypeScript strict mode** — No implicit any
- **ESLint** — Configured per workspace
- **Prettier** — Consistent formatting
- **Functional components** — React hooks only
- **No class components** — Except ErrorBoundary

## Testing Requirements
- **Vitest** for unit/integration tests
- **Playwright** for E2E tests
- **Coverage targets**: Lines >= 80%, Functions >= 80%, Statements >= 80%, Branches >= 65%
- **Scraper tests**: Use real HTML fixtures from `scraper/tests/fixtures/`

## Documentation Standards
- **README.md** — Updated for API changes
- **AGENTS.md** — Updated for workflow changes
- **WHITE-LABEL.md** — Updated for theme/settings schema changes
- **docs/reference/api/** — Per-endpoint documentation
