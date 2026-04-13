---
project_name: 'allo-scrapper'
user_name: 'opelkad'
date: '2026-04-13'
sections_completed: ['technology_stack', 'language_specific_rules', 'framework_specific_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 38
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core Technologies:**
- Node.js >= 24.0.0
- TypeScript 6.0.2
- PostgreSQL (via pg 8.20.0)
- Redis (via ioredis 5.10.0)

**Backend (Server):**
- Express.js 5.2.1
- JWT Auth: jsonwebtoken 9.0.3
- Password Hashing: bcryptjs 3.0.3
- Security: helmet 8.1.0
- Rate Limiting: express-rate-limit 8.3.1
- Logging: winston 3.19.0
- Testing: vitest 4.1.4

**Frontend (Client):**
- React 19.2.0
- Routing: react-router-dom 7.13.1
- State/Data: @tanstack/react-query 5.90.21
- HTTP: axios 1.13.6
- Styling: tailwindcss 4.1.18
- Validation: zod 4.3.6
- Build: vite 8.0.0

**Scraper (Microservice):**
- Scraping: puppeteer-core 24.39.1, cheerio 1.0.0
- Scheduling: node-cron 4.2.1
- Observability: OpenTelemetry
- Concurrency: p-limit 3.1.0

**Architecture:**
- Monorepo: npm workspaces (server, client, scraper, packages/saas, packages/logger)
- All packages use ESM (`"type": "module"`)
- TypeScript project references for shared packages

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript/JavaScript)

**TypeScript Configuration:**
- **Strict Mode Mandatory**: All packages use strict mode with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` - this is a security layer for multi-tenancy, not just code quality
- **No `any` in Security Contexts**: Never use `any` for tenant isolation (org_id, tenant_id), JWT payloads, or permission checks - use explicit types or branded types
- **Runtime Validation**: Use Zod schemas for external data validation; TypeScript types alone are insufficient for untrusted inputs

**Module System (ESM):**
- **ESM Only**: All packages use `"type": "module"` - no `require()`, use `import` only
- **Module Resolution**: Server/scraper use `moduleResolution: "bundler"`, client uses project references
- **Dynamic Imports for Features**: Optional modules (e.g., `@allo-scrapper/saas`) use dynamic imports with proper error handling and feature flag checks

**Import/Export Patterns:**
- **Named Imports Preferred**: Use named imports over default exports for better refactoring
- **Type-Only Imports**: Use `import type` for type-only imports to reduce bundle size
- **Organized Imports**: Types/interfaces first, then functions/classes

**Error Handling:**
- **Never Silence Errors**: Always log or propagate - use structured logging (Winston) not console.log
- **Preserve Error Context**: Wrap errors with `cause` to maintain stack traces; include org_id/user_id/endpoint context
- **Async Error Handling**: Use try/catch with async/await; handle all rejections explicitly

**Performance-Critical Code:**
- **Scraper Optimizations**: Avoid unnecessary allocations in parsing loops; profile hot paths with console.time in dev
- **Document Performance Constraints**: Add comments for performance-sensitive functions (e.g., "must process <100ms per page")

**Security-Critical Patterns:**
- **Explicit JWT Typing**: Never cast JWT payloads as `any` - use explicit interfaces
- **Branded Types**: Use branded types for IDs to prevent mixing tenant_id/org_id/user_id
- **Feature Flag Checks**: Always verify feature flags before dynamic imports; log unauthorized access attempts

---

### Framework-Specific Rules

**React (Frontend):**
- **Data Fetching**: Use TanStack Query for all server state - automatic caching, background updates, and error handling
- **Custom Hooks**: Place reusable logic in `client/src/hooks/` - keep components thin
- **Global State**: Use Context API for auth (AuthContext) and tenant (TenantProvider) - avoid prop drilling
- **Component Organization**: Pages in `client/src/pages/`, reusable components in `client/src/components/`
- **Test Colocation**: Place `.test.tsx` files next to components they test
- **Route Protection**: Use RequireAuth wrapper for protected routes; separate admin/superadmin/public route groups

**Express (Backend):**
- **Route Structure**: All routes in `server/src/routes/` - keep handlers focused, delegate to services
- **Business Logic Separation**: Services in `server/src/services/` contain business logic - routes/controllers only handle HTTP
- **Middleware Chain**: Apply in order: helmet → CORS → rate limiting → authentication → route handlers
- **Error Handling**: Use centralized error handling middleware - structured error responses with consistent status codes
- **Rate Limiting**: Configure per-endpoint with express-rate-limit - different limits for auth vs public endpoints

---

### Testing Rules

**Test Organization:**
- **Naming Convention**: Use `*.test.ts` for server/scraper, `*.test.tsx` for React components
- **Test Colocation**: Place test files next to the code they test - easier to maintain
- **Test Framework**: Vitest for all packages (server, client, scraper) - consistent tooling

**Coverage Requirements:**
- **Minimum Thresholds**: Lines >= 80%, Functions >= 80%, Statements >= 80%, Branches >= 65%
- **Coverage Commands**: `npm run test:coverage` in each workspace to verify
- **No Coverage Exemptions**: All new code must meet thresholds - no exceptions

**TDD Workflow (MANDATORY):**
- **RED Phase**: Write failing test BEFORE implementation - commit test first
- **GREEN Phase**: Write minimal code to pass test - no premature optimization
- **Test-First Commits**: Always commit test before implementation code

**Test Types:**
- **Unit Tests Preferred**: Test business logic in isolation - mock external dependencies
- **Integration Tests**: Use supertest for API routes - test full request/response cycle
- **E2E Tests**: Use Playwright for critical user workflows - sparingly, only for high-value paths

**Mock Strategy:**
- **Mock External Dependencies**: Database, Redis, HTTP calls, file system
- **Don't Mock Internal Logic**: Keep business logic tests pure - no mocking internal functions
- **React Testing**: Use Testing Library with user-centric queries - test behavior not implementation

---

### Code Quality & Style Rules

**Linting/Formatting:**
- **ESLint for Client**: React-specific rules enabled - follow ESLint warnings
- **TypeScript Strict as Linter**: Server/scraper rely on strict TypeScript compiler - no separate linter
- **No Prettier**: Manual formatting - follow existing code style in each file

**File and Folder Structure:**
- **Server**: `config/`, `db/`, `middleware/`, `routes/`, `services/`, `types/`, `utils/`
- **Client**: `api/`, `components/`, `contexts/`, `hooks/`, `pages/`, `schemas/`, `types/`, `utils/`
- **Scraper**: `db/`, `redis/`, `scraper/`, `types/`, `utils/`
- **Shared Packages**: `packages/logger`, `packages/saas` - workspace dependencies

**Naming Conventions:**
- **Files**: kebab-case for utils/config/services, PascalCase for React components
- **Variables/Functions**: camelCase
- **Types/Interfaces**: PascalCase (e.g., `UserProfile`, `JwtPayload`)
- **Constants**: UPPER_SNAKE_CASE for environment variables and global constants

**Documentation Requirements:**
- **JSDoc Comments**: Add for complex public functions - explain why, not what
- **README.md Updates**: Update when API endpoints or behavior changes
- **AGENTS.md Updates**: Document new gotchas, workflow changes, critical patterns

---

### Development Workflow Rules

**Git/Branch Workflow (MANDATORY):**
- **Issue First**: Every PR MUST link to a GitHub issue - create issue before coding
- **Branch Naming**: `<type>/<issue-number>-<description>` (e.g., `feat/123-add-cinema-modal`)
- **Branch Types**: feat/, fix/, docs/, chore/, ci/, refactor/, test/, perf/
- **Branch from develop**: Always branch from `develop`, never from `main` or other feature branches
- **One Issue = One Branch = One PR**: No mixing unrelated changes

**Commit Message Format (Conventional Commits):**
- **Format**: `<type>(<scope>): <description>` with optional body
- **Types**: feat, fix, docs, test, chore, refactor, style, perf, ci, build
- **Scopes**: scraper, api, db, parser, client, docker, observability
- **Issue Reference**: Include `refs #<issue-number>` in commit body
- **Atomic Commits**: Each commit = one logical change

**PR Requirements:**
- **Link Issue**: Use `Closes #<issue-number>` in PR body
- **All Tests Pass**: Run `npm run test:run` before requesting review
- **Coverage Maintained**: Verify coverage thresholds met
- **Docs Updated**: Update README.md/AGENTS.md if API or behavior changed
- **Version Label**: Add `patch`, `minor`, or `major` label to PR

**Deployment & Versioning:**
- **Automated Versioning**: PR merge to main triggers version bump based on label
- **Docker Images**: Built automatically with version tags (vX.Y.Z, vX.Y, vX, stable, latest)
- **Changelog**: Auto-generated from conventional commits

---

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**
- **NEVER install from project root**: Always `cd server && npm install` - native modules fail otherwise
- **NEVER push to develop/main**: Always use feature branch + PR workflow
- **NEVER skip RED phase**: Test commit MUST come before implementation commit
- **NEVER use `any` in security**: Explicit types for auth, permissions, tenant isolation
- **NEVER use console.log**: Use Winston structured logging for production code

**Database & Migration Gotchas:**
- **Migrations MUST be idempotent**: Use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ BEGIN ... END $$`
- **Test on fresh AND existing DBs**: Prevent schema drift between init.sql and migrations
- **Update migration tests**: Add new migrations to `server/src/db/system-queries.test.ts` inventory

**Docker & Deployment Gotchas:**
- **Install all workspaces**: Docker MUST use `npm install --workspaces` for SaaS dynamic imports
- **Build before push**: Run `docker compose build` if Dockerfile or dependencies changed
- **JWT_SECRET validation**: >= 32 chars required, no default values, unique per environment

**Security Critical:**
- **Shared admin credentials**: Superadmin and admin use same password hash in `public.users`
- **Health endpoint rate-limited**: 10 req/min per IP (localhost exempt for Docker probes)
- **Multi-tenant isolation**: ALWAYS filter queries by org_id/tenant_id - never trust client input

**Performance Critical:**
- **Scraper parsing**: Target <100ms per page - avoid allocations in loops
- **Hot path optimization**: Reuse buffers, profile with console.time in dev

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-13
