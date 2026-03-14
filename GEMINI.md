# Allo-Scrapper

## Project Overview
Allo-Scrapper is a cinema showtimes aggregator that scrapes and centralizes movie screening schedules from source website cinema pages. It is a full-stack application built with a modern architecture, featuring:
- **Frontend:** React Single Page Application (SPA) built with Vite and TypeScript.
- **Backend API:** Express.js RESTful API handling business logic, user management, and serving the frontend.
- **Scraper Microservice:** A standalone scraper service (Node.js/Playwright) communicating with the API via a Redis job queue and pub/sub.
- **Database:** PostgreSQL for storing structured cinema, film, showtime, and user role data.
- **Infrastructure:** Fully containerized with Docker, featuring comprehensive observability (Prometheus, Grafana, Loki, Tempo).

## Building and Running
The project is set up as a monorepo and heavily utilizes Docker for local development, testing, and deployment. 

**Development (Docker):**
- Start dev environment: `npm run dev`
- Stop dev environment: `npm run dev:down`
- View logs: `npm run dev:logs`

**Manual Scripts:**
- Install all dependencies (root, client, server): `npm run install:all`
- Build the frontend and backend: `npm run build`
- Run Server locally: `npm run server:dev`
- Run Client locally: `npm run client:dev`
- Run Database Migrations: `npm run server:db:migrate`

**Testing:**
- Run backend tests: `npm test`
- Run End-to-End tests (Playwright): `npm run e2e` (or `npm run e2e:ui` for the headed runner)
- Run Integration tests: `npm run integration-test`

## Development Conventions
- **Language:** TypeScript is used extensively across both the frontend (`client`) and backend (`server`/`scraper`) services.
- **Monorepo Structure:** The codebase is logically split into `client`, `server`, and `scraper` directories, with NPM scripts in the root `package.json` orchestrating them.
- **Containerization First:** Docker and Docker Compose are the primary mechanisms for building, running, and testing the application (using files like `docker-compose.yml` and `docker-compose.dev.yml`).
- **Testing:** Playwright is used for E2E testing (located in the root `e2e/` directory), and Vitest is used for unit testing within individual packages.
- **Database Management:** SQL migration files are maintained in the `migrations/` directory to manage schema evolution (e.g., adding user roles and permissions).

## MANDATORY Workflow
When working on this project, you MUST follow this workflow for every task, in order:

1. **ISSUE** → Verify or create a GitHub issue (e.g. `gh issue create --label bug --title "fix: description"`)
2. **BRANCH** → Create a dedicated feature branch from `develop` for this issue (e.g. `feature/<issue-number>-<short-description>`)
3. **RED** → Write failing tests first and commit them before implementing (TDD).
4. **GREEN** → Write minimal code to make tests pass.
5. **DOCS** → Update `README.md` or `AGENTS.md` if the public API, behaviour, or workflow changed.
6. **COMMIT** → Use atomic commits with Conventional Commits format (e.g., `feat(api): ...`, `fix(scraper): ...`).
7. **PR** → Open a Pull Request referencing the issue and wait for review. NEVER push directly to `develop` or `main`.