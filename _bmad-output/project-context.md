---
project_name: 'allo-scrapper'
user_name: 'Opelkad'
date: '2026-05-24'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 21
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Client (Frontend)**
  - React 19.2.0
  - Vite 8.0.14
  - TanStack Query (React Query) 5.90.21
  - TailwindCSS + Autoprefixer
- **Server (Backend API)**
  - Express 5.2.1
  - PostgreSQL (pg 8.20.0)
  - Redis (ioredis 5.10.0)
- **Scraper (Microservice)**
  - Playwright 1.58.2
  - Express 5.2.1
  - node-cron 4.2.1
  - PostgreSQL & Redis (same as server)
- **Language & Testing**
  - TypeScript 6.0.2 (across all packages)
  - Vitest 4.1.1 (Unit/Integration testing)
  - Playwright (E2E testing)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript/Node.js)

- **Strict Typing:** TypeScript strict mode is enabled globally (`"strict": true`). Agents must ensure type safety, avoid `any` unless explicitly justified, and properly type all parameters and return values.
- **Export/Import Conventions:** Prefer named exports (e.g., `export const functionName`) over default exports for better refactoring and discoverability. Use `esModuleInterop: true`.
- **Error Handling:** Use explicit `try...catch` blocks for all async operations. Do not swallow errors; pass them to centralized error handling middleware or log them appropriately.
- **Async/Await:** Prefer `async/await` syntax over raw Promises (`.then().catch()`) for readability, especially in Express controllers and background jobs.

### Framework-Specific Rules

- **React (Client):**
  - **State Management:** Use TanStack Query (React Query) for server state and data fetching (`useQuery`, `useMutation`). Avoid using `useEffect` for data fetching. Use React Context for global UI state only (e.g., Auth, Settings).
  - **Component Structure:** Colocate tests with components (e.g., `Component.tsx` and `Component.test.tsx` side-by-side). Use functional components and hooks.
  - **Styling:** Use TailwindCSS utility classes directly in `className`.
- **Express (Server):**
  - **Routing:** Organize routes in `server/src/routes/` and mount them in `app.ts`. Use express routers (`express.Router()`).
  - **Middleware:** Apply rate limiting middleware (e.g., `authLimiter`, `generalLimiter`) from `src/middleware/rate-limit.ts` to relevant routes. Use role/permission middleware for protected routes.

### Testing Rules

- **TDD (RED-GREEN-REFACTOR) is MANDATORY:** You must write a failing test first, commit it (`test(scope): ...`), and then write the implementation to make it pass.
- **Test Framework:** Use Vitest for unit/integration tests across all packages (`npm run test:run`). Use Playwright for E2E tests (`npm run e2e`).
- **Coverage Targets:** Maintain coverage. Lines: >= 80%, Functions: >= 80%, Statements: >= 80%, Branches: >= 65%.
- **Test Colocation:** Place `.test.ts` or `.test.tsx` files directly next to the file they are testing in `src/` (e.g., `server/src/utils/date.test.ts`).
- **Environment:** Server tests run in `node` environment, client tests run in `jsdom` with `@testing-library/react`. Mock external dependencies using `vi.mock()`.

### Code Quality & Style Rules

- **Linting & Formatting:** ESLint is configured with strict TypeScript and React recommended rules. Fix all linter warnings before committing.
- **Naming Conventions:** Use `PascalCase` for React components and `camelCase` for variables, functions, and hooks.
- **Documentation:** Update `README.md` and `AGENTS.md` if public APIs, workflows, or behaviors change. Comment complex logic to explain "why" (not "what").

### Development Workflow Rules

- **Branch Naming:** One branch per issue. Use `<type>/<issue-number>-<short-description>` (e.g., `feat/259-add-theater-modal`). Base branches strictly off `develop`.
- **Commit Messages:** Follow Conventional Commits exactly: `<type>(<scope>): <description>`. For breaking changes, include `BREAKING CHANGE: <description>` in the body.
- **Atomic Commits:** Separate test commits (RED), implementation (GREEN), and documentation (DOCS).
- **Pull Requests:** Ensure all PRs are linked to a GitHub issue. Add a version label (`major`, `minor`, `patch`) before merging to trigger automated releases. Never push directly to `main` or `develop`.

### Critical Don't-Miss Rules

- **Idempotent DB Migrations:** All SQL migrations MUST be idempotent (e.g., use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) to prevent failures on fresh installs vs incremental updates.
- **JWT Security:** The server will crash intentionally if `JWT_SECRET` is missing, <32 chars, or matches default insecure values. Always generate secure keys for testing and deployment.
- **Dynamic Permissions:** Do NOT edit React UI code to add new role permissions. Create a DB migration inserting the permission (and category if new). The frontend loads them dynamically.
- **Health Check Limits:** `/api/health` is rate-limited (10 req/min) and cached (5s) to prevent DB resource exhaustion. Internal IPs (127.0.0.1) are exempt.

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

Last Updated: 2026-05-24
