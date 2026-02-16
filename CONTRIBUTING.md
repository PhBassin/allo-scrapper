# Contributing Guide

Thank you for your interest in contributing to Allo-Scrapper! This document outlines the development workflow and standards we follow.

---

## Table of Contents

- [Development Workflow](#development-workflow)
- [Issue First](#issue-first)
- [Test-Driven Development (TDD)](#test-driven-development-tdd)
- [Conventional Commits](#conventional-commits)
- [Atomic Commits](#atomic-commits)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Style](#code-style)
- [Documentation](#documentation)

---

## Development Workflow

Every contribution should follow this workflow:

```
1. Issue First    → Create or find an existing issue
2. Plan           → Break down into tasks, identify tests needed
3. TDD            → Write tests BEFORE implementation
4. Implement      → Write minimal code to pass tests
5. Atomic Commits → One logical change per commit
6. Documentation  → Update README if needed
7. Pull Request   → Open PR, reference issue, follow checklist
```

---

## Issue First

**Before writing any code, ensure there is a GitHub issue.**

### Why?
- Tracks the reason for changes
- Enables discussion before implementation
- Provides traceability in commit history
- Helps prioritize work

### Issue Types

| Type | Use Case | Label |
|------|----------|-------|
| Bug Report | Something is broken | `bug` |
| Feature Request | New functionality | `enhancement` |
| Task | Technical chore, refactoring | `chore` |

### Creating an Issue

1. Check if an issue already exists
2. Use the appropriate issue template
3. Provide clear description and context
4. Add relevant labels

### Referencing Issues

In commits and PRs, reference the issue:
- `refs #123` - References issue without closing
- `closes #123` - Closes issue when PR is merged
- `fixes #123` - Same as closes (for bug fixes)

---

## Test-Driven Development (TDD)

**We follow TDD: write tests BEFORE implementation.**

### The TDD Cycle

```
1. RED    → Write a failing test
2. GREEN  → Write minimal code to pass the test
3. REFACTOR → Improve code while keeping tests green
4. REPEAT
```

### Coverage Targets

| Metric | Target |
|--------|--------|
| Lines | >= 80% |
| Functions | >= 80% |
| Statements | >= 80% |
| Branches | >= 65% |

### Running Tests

```bash
cd server

# Watch mode (recommended for development)
npm test

# Single run
npm run test:run

# With coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Test Guidelines

- Write tests for public API functions first
- Cover edge cases and error handling
- Use descriptive test names: `should extract cinema address correctly`
- Group related tests in `describe()` blocks
- Use fixtures for realistic data (see `server/tests/fixtures/`)

For detailed testing documentation, see [`server/tests/README.md`](./server/tests/README.md).

---

## Conventional Commits

**All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.**

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(scraper): add support for UGC cinemas` |
| `fix` | Bug fix | `fix(api): handle missing film poster gracefully` |
| `docs` | Documentation only | `docs(readme): update API examples` |
| `test` | Adding/updating tests | `test(parser): add edge cases for empty HTML` |
| `chore` | Maintenance tasks | `chore(deps): update vitest to v1.2.0` |
| `refactor` | Code refactoring (no behavior change) | `refactor(db): extract query builders` |
| `style` | Formatting, whitespace | `style(scraper): fix indentation` |
| `perf` | Performance improvement | `perf(parser): cache regex patterns` |
| `ci` | CI/CD changes | `ci(actions): add test coverage step` |
| `build` | Build system changes | `build(docker): optimize multi-stage build` |

### Scopes (Optional but Recommended)

| Scope | Area |
|-------|------|
| `scraper` | Scraping service |
| `api` | REST API endpoints |
| `db` | Database queries/schema |
| `parser` | HTML parsing |
| `client` | React frontend |
| `docker` | Docker configuration |
| `deps` | Dependencies |

### Examples

```bash
# Feature with scope
feat(scraper): add retry logic for failed requests

# Bug fix referencing issue
fix(api): return 404 for unknown cinema IDs

Closes #42

# Breaking change (use ! or BREAKING CHANGE footer)
feat(api)!: change film endpoint response format

BREAKING CHANGE: The /api/films/:id endpoint now returns
nested showtime objects instead of flat arrays.

# Multiple-line body
refactor(parser): extract date parsing into utility

- Move date parsing logic to utils/date.ts
- Add ISO format validation
- Improve error messages for invalid dates
```

---

## Atomic Commits

**Each commit should represent one logical, self-contained change.**

### Principles

1. **Single Responsibility**: One commit = one purpose
2. **Testable**: Each commit should pass all tests
3. **Deployable**: Each commit should be deployable (no broken states)
4. **Reviewable**: Easy to understand and review in isolation

### Good Examples

```bash
# Commit 1: Add test
test(parser): add test for cinema with no films

# Commit 2: Implement feature
feat(parser): handle cinemas with no films showing

# Commit 3: Update docs
docs(readme): document empty cinema behavior
```

### Bad Examples

```bash
# Too broad
feat: add new scraper features and fix bugs and update docs

# WIP commits
wip: working on parser

# Mixing unrelated changes
fix: fix parser bug and update dependencies
```

### When to Split Commits

Split into separate commits when:
- Adding tests vs implementing features
- Fixing unrelated bugs
- Updating documentation
- Changing dependencies
- Refactoring vs adding functionality

---

## Pull Request Guidelines

### Before Opening a PR

- [ ] All tests pass: `npm run test:run`
- [ ] Code follows style guidelines
- [ ] Documentation updated (if applicable)
- [ ] Commits follow Conventional Commits format
- [ ] Commits are atomic and logical
- [ ] Issue is referenced

### PR Title

Follow the same Conventional Commits format:

```
feat(scraper): add support for MK2 cinema chain
fix(api): correct showtime timezone handling
docs: add deployment troubleshooting section
```

### PR Description

Use the PR template which includes:
- Summary of changes
- Related issue reference
- Type of change
- Checklist

### Review Process

1. Open PR against `develop` branch
2. Ensure CI checks pass
3. Request review from maintainers
4. Address feedback with new commits (don't force-push during review)
5. Squash if requested before merge

---

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Export types from dedicated files

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `theater-parser.ts` |
| Functions | camelCase | `parseTheaterPage()` |
| Classes | PascalCase | `HttpClient` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `Cinema`, `FilmData` |

### File Organization

```
server/src/
├── config/       # Configuration files
├── db/           # Database queries and schema
├── routes/       # Express route handlers
├── services/     # Business logic
├── types/        # TypeScript type definitions
└── utils/        # Utility functions
```

### Comments

- Add comments for complex business logic
- Use JSDoc for public functions
- Avoid obvious comments (`// increment counter`)
- Explain "why", not "what"

---

## Documentation

### When to Update README

Update `README.md` when:
- Adding new API endpoints
- Changing environment variables
- Modifying database schema
- Adding new features
- Changing deployment process

### When to Update DEPLOYMENT.md

Update `DEPLOYMENT.md` when:
- Changing Docker configuration
- Modifying CI/CD pipeline
- Adding new deployment options
- Changing infrastructure requirements

### Documentation Standards

- Keep documentation up-to-date with code
- Include code examples where helpful
- Use consistent formatting
- Test commands before documenting

---

## Questions?

If you have questions:
1. Check existing documentation
2. Search closed issues/PRs
3. Open a Discussion on GitHub
4. Create an issue if it's a bug or feature request

---

**Thank you for contributing!**
