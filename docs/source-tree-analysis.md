# Source Tree Analysis — allo-scrapper

```
allo-scrapper/                          # Monorepo root (npm workspaces)
├── AGENTS.md                           # AI agent instructions (BMAD workflow)
├── CHANGELOG.md                        # Full release changelog
├── Dockerfile                          # Multi-stage: client build + server + static serve
├── Dockerfile.scraper                  # Scraper microservice image
├── LICENSE                             # MIT
├── README.md                           # Project overview (English)
├── WHITE-LABEL.md                      # White-label customization guide
├── docker-compose.yml                  # Production stack (DB, Redis, web, scraper, monitoring)
├── docker-compose.dev.yml              # Development stack with hot-reload
├── docker-compose.build.yml            # Build-only compose
├── package.json                        # Workspace root (version 4.6.7, Node >=24)
├── playwright.config.ts                # E2E test configuration
│
├── client/                             # [PART: web] React Frontend (Vite)
│   ├── package.json                    # React 19.2, Vite 8, Tailwind 4, Vitest
│   ├── vite.config.ts                  # Vite configuration with API proxy
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── tailwind.config.js / postcss.config.js
│   ├── index.html                      # Entry HTML
│   ├── public/                         # Static assets
│   └── src/
│       ├── main.tsx                    # App entry: providers + router
│       ├── App.tsx                     # Route definitions + auth guards
│       ├── api/                        # API client layer (Axios)
│       │   ├── client.ts              # Axios instance + JWT interceptor + all endpoints
│       │   ├── theaters.ts            # Theater-specific API functions
│       │   ├── users.ts               # User management API
│       │   ├── settings.ts            # Settings API
│       │   ├── roles.ts               # Roles API (Zod-validated)
│       │   ├── rate-limits.ts         # Rate limit admin API
│       │   └── system.ts              # System info/health API
│       ├── components/
│       │   ├── Layout.tsx             # App shell (header, nav, footer)
│       │   ├── ProtectedRoute.tsx     # Auth guard
│       │   ├── RequirePermission.tsx  # Permission guard
│       │   ├── RequireAdmin.tsx       # Legacy admin guard
│       │   ├── ErrorBoundary.tsx      # Error boundary
│       │   ├── MovieCard.tsx          # Movie listing card
│       │   ├── MovieSearchBar.tsx     # Debounced fuzzy search
│       │   ├── ShowtimeList.tsx       # Showtime buttons → CalendarPopover
│       │   ├── DaySelector.tsx        # 7-day date selector
│       │   ├── CinemaDateSelector.tsx # Cinema date picker
│       │   ├── CinemasQuickLinks.tsx  # Quick-link chips
│       │   ├── CinemaShowtimes.tsx    # Showtimes by cinema
│       │   ├── ScrapeButton.tsx       # Scrape trigger button
│       │   ├── ScrapeProgress.tsx     # SSE progress display
│       │   ├── CalendarPopover.tsx    # Google Calendar / .ics popover
│       │   ├── ScrollToTop.tsx        # Floating button
│       │   ├── PasswordRequirements.tsx # Password strength UI
│       │   ├── ui/                    # UI primitives
│       │   │   ├── Button.tsx
│       │   │   ├── IconButton.tsx
│       │   │   └── LinkButton.tsx
│       │   └── admin/                 # Admin components
│       │       ├── AddCinemaModal.tsx
│       │       ├── EditCinemaModal.tsx
│       │       ├── DeleteCinemaDialog.tsx
│       │       ├── CreateUserModal.tsx
│       │       ├── DeleteUserDialog.tsx
│       │       ├── PasswordResetDialog.tsx
│       │       ├── RoleBadge.tsx
│       │       ├── ColorPicker.tsx
│       │       ├── FontSelector.tsx
│       │       ├── ImageUpload.tsx
│       │       ├── FooterLinksEditor.tsx
│       │       ├── ScheduleModal.tsx
│       │       └── RoleManagementPage.tsx
│       ├── contexts/
│       │   ├── AuthContext.tsx         # JWT auth + localStorage
│       │   └── SettingsContext.tsx     # White-label theme context
│       ├── hooks/
│       │   ├── useDebounce.ts
│       │   ├── useScrapeProgress.ts
│       │   └── useTheme.ts
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── CinemaPage.tsx
│       │   ├── MoviePage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── ChangePasswordPage.tsx
│       │   └── admin/
│       │       ├── AdminPage.tsx       # Tab router
│       │       ├── CinemasPage.tsx
│       │       ├── SchedulesPage.tsx
│       │       ├── ReportsPage.tsx
│       │       ├── UsersPage.tsx
│       │       ├── SettingsPage.tsx
│       │       ├── RateLimitsPage.tsx
│       │       └── SystemPage.tsx
│       └── utils/
│           ├── date.ts                # Date formatting (fr-FR)
│           ├── calendar.ts            # Google Calendar / .ics
│           ├── highlight.tsx          # Text highlighting
│           ├── permission-grouping.ts # Permission category grouping
│           └── adminPermissions.ts    # Admin permission list
│
├── server/                             # [PART: backend] Express API
│   ├── package.json                    # Express 5.2, pg 8.20, ioredis 5.10, JWT, Helmet
│   ├── tsconfig.json / vitest.config.ts
│   ├── tests/                          # Integration tests
│   └── src/
│       ├── index.ts                    # Server entry: Express app + DB init
│       ├── app.ts                      # Express app: middleware, routes, static files
│       ├── routes/
│       │   ├── auth.ts                # Login, register, change-password
│       │   ├── movies.ts             # Weekly movies, search, detail
│       │   ├── theaters.ts           # Theater CRUD + schedule
│       │   ├── scraper.ts            # Trigger, status, progress (SSE), schedules
│       │   ├── reports.ts            # Scrape report history
│       │   ├── settings.ts           # White-label settings CRUD + export/import
│       │   ├── users.ts             # User management
│       │   ├── roles.ts             # Role CRUD + permissions
│       │   ├── system.ts            # System info, health, migrations
│       │   └── admin/
│       │       └── rate-limits.ts    # Rate limit admin
│       ├── services/
│       │   ├── auth-service.ts       # bcrypt + JWT + timing-safe login
│       │   ├── movie-service.ts      # Movie aggregation + search
│       │   ├── theater-service.ts    # Theater CRUD + smart-add
│       │   ├── scraper-service.ts    # Redis job publishing + SSE
│       │   ├── redis-client.ts       # Singleton Redis (pub/sub)
│       │   ├── progress-tracker.ts   # SSE event broadcaster
│       │   ├── system-info.ts        # Health metrics
│       │   └── theme-generator.ts    # Dynamic CSS generation
│       ├── middleware/
│       │   ├── auth.ts               # JWT verification (requireAuth)
│       │   ├── permission.ts         # RBAC permission check
│       │   ├── rate-limit.ts         # 7 pre-configured rate limiters
│       │   ├── rate-limiter.ts       # Custom rate limiter factory
│       │   └── error-handler.ts      # Global error handler
│       ├── db/
│       │   ├── pool.ts               # pg Pool connection
│       │   ├── migrations.ts         # Automatic migration runner
│       │   ├── theater-queries.ts    # Theater DB queries
│       │   ├── movie-queries.ts      # Movie DB queries
│       │   ├── showtime-queries.ts   # Showtime + weekly_programs queries
│       │   ├── report-queries.ts     # Scrape report queries
│       │   ├── scrape-attempt-queries.ts
│       │   ├── schedule-queries.ts   # Scrape schedule queries
│       │   ├── user-queries.ts       # User queries
│       │   ├── role-queries.ts       # Role + permission queries
│       │   ├── settings-queries.ts   # App settings queries
│       │   └── rate-limit-queries.ts # Rate limit config queries
│       ├── config/
│       │   ├── theaters.json         # Seed: 24 Parisian theaters
│       │   └── rate-limits.ts        # Rate limit config loader
│       └── utils/
│           ├── date.ts / url.ts / security.ts
│           ├── cors-config.ts
│           ├── image-validator.ts
│           ├── json-parse-cache.ts
│           └── showtimes.ts
│
├── scraper/                            # [PART: backend] Scraping Microservice
│   ├── package.json                    # Cheerio, Puppeteer, node-cron, OpenTelemetry
│   ├── tsconfig.json / vitest.config.ts
│   ├── tests/
│   │   └── fixtures/                   # Real HTML fixtures for parser tests
│   └── src/
│       ├── index.ts                    # Entry: consumer/cron/oneshot modes
│       ├── scraper/
│       │   ├── theater-parser.ts      # Cheerio HTML parser
│       │   ├── theater-json-parser.ts # JSON API parser
│       │   ├── movie-parser.ts        # Movie detail parser
│       │   └── allocine-strategy.ts   # Allocine scraper orchestration
│       ├── queue/
│       │   ├── redis-consumer.ts      # BLPOP job consumer
│       │   ├── redis-publisher.ts     # Progress events publisher
│       │   ├── redis-subscriber.ts    # Schedule changes subscriber
│       │   └── jobs.ts               # Job type definitions
│       ├── scheduler/
│       │   └── cron-scheduler.ts      # Dynamic cron scheduler
│       ├── db/
│       │   └── pool.ts               # pg Pool (write operations)
│       ├── observability/
│       │   ├── logger.ts             # Winston JSON logger
│       │   ├── tracer.ts             # OpenTelemetry setup
│       │   └── metrics.ts            # prom-client metrics
│       ├── health/                    # Express health endpoint
│       └── types.ts                   # Shared type definitions
│
├── packages/                           # [PART: library] Shared Libraries
│   ├── logger/                         # Winston-based shared logger
│   │   └── dist/                      # Compiled output
│   └── saas/                           # SaaS multi-tenant extensions
│       └── dist/
│           └── server/src/
│               ├── middleware/         # rate-limit, auth, permission, org-boundary
│               └── services/          # scraper, cinema, film, theme, redis
│
├── e2e/                                # Playwright E2E tests
│   ├── auth-flow.spec.ts
│   ├── admin-system.spec.ts
│   ├── add-theater.spec.ts
│   ├── movie-search.spec.ts
│   ├── showtime-buttons.spec.ts
│   ├── theme-application.spec.ts
│   ├── user-management.spec.ts
│   ├── scrape-progress.spec.ts
│   ├── reports-navigation.spec.ts
│   ├── day-filter.spec.ts
│   ├── database-schema.spec.ts
│   ├── change-password.spec.ts
│   └── theater-scrape.spec.ts
│
├── migrations/                         # SQL migration files (applied by server)
│   ├── 001_neutralize_references.sql through 023_rename_cinema_to_theater.sql
│   └── README.md
│
├── scripts/                            # Operational scripts
├── docker/                             # Docker auxiliary configs
│   ├── init.sql
│   ├── tempo.yml
│   └── grafana/
│       ├── datasources/
│       └── dashboards/
│
├── .github/                            # CI/CD
│   ├── workflows/
│   │   ├── ci.yml                     # PR checks (lint, test, build)
│   │   ├── docker-build-push.yml      # Docker build + push to GHCR
│   │   ├── version-tag.yml            # Auto version tagging
│   │   ├── sync-main-to-develop.yml   # Merge-back workflow
│   │   ├── ghcr-cleanup.yml           # Old image cleanup
│   │   └── cleanup-docker-images.yml  # Docker image pruning
│   ├── ISSUE_TEMPLATE/                # Bug report, feature request, task
│   ├── pull_request_template.md
│   └── dependabot.yml
│
└── docs/                               # Project documentation (existing + generated)
    ├── README.md
    ├── documentation-roadmap.md
    ├── getting-started/                # Quick start, installation, configuration
    ├── reference/                      # API, architecture, database, scripts
    ├── guides/                         # Development, deployment, administration
    ├── troubleshooting/                # Common issues, Docker, scraper, DB
    └── project/                        # Changelog, security, white-label-plan
```

## Critical Folders Summary
| Folder | Part | Role |
|--------|------|------|
| `client/src/pages/` | client | 14 route-based page components |
| `client/src/components/` | client | 26 shared + admin components |
| `client/src/api/` | client | 47 Axios endpoint functions |
| `server/src/routes/` | server | 10 route files → 52 endpoints |
| `server/src/services/` | server | 8 business logic services |
| `server/src/middleware/` | server | 5 middleware (auth, RBAC, rate-limit, errors) |
| `server/src/db/` | server | 11 query files → 16 tables |
| `scraper/src/scraper/` | scraper | 3 parsers + strategy |
| `scraper/src/queue/` | scraper | Redis consumer/producer/subscriber |
| `scraper/src/observability/` | scraper | Winston, OpenTelemetry, prom-client |
| `packages/logger/` | packages | Shared Winston logger |
| `packages/saas/` | packages | Multi-tenant server extensions |
| `migrations/` | infra | 23 sequential SQL migrations |
| `.github/workflows/` | infra | 6 CI/CD pipelines |
