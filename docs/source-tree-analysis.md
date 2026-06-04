# Source Tree Analysis — allo-scrapper

> Generated: 2026-05-21 | Multi-part monorepo structure

## Project Root

```
allo-scrapper/
├── AGENTS.md                 # AI coding agent instructions
├── README.md                 # Project README
├── docker-compose.yaml        # Orchestration
├── package.json              # npm workspaces root
├── docs/                     # Project documentation (85+ files)
│   ├── index.md
│   ├── project-overview.md
│   ├── architecture-*.md
│   ├── api-contracts-server.md
│   ├── data-models-server.md
│   ├── component-inventory-client.md
│   ├── comprehensive-analysis-*.md
│   ├── source-tree-analysis.md
│   ├── integration-architecture.md
│   ├── development-guide.md
│   ├── deployment-guide.md
│   ├── contribution-guide.md
│   ├── reference/
│   ├── guides/
│   ├── getting-started/
│   └── troubleshooting/
├── scripts/                  # Utility scripts
├── server/                   # Part 1: Express API Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── drizzle.config.ts
│   └── src/
│       ├── app.ts
│       ├── index.ts
│       ├── config/
│       ├── db/               # Drizzle ORM + queries
│       ├── middleware/        # Express middleware
│       ├── routes/           # API route handlers
│       ├── services/         # Business logic
│       ├── types/            # TypeScript types
│       └── utils/            # Utilities
├── scraper/                  # Part 2: Scraping Microservice
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── db/               # Local DB access
│       ├── redis/            # Redis/BullMQ client
│       ├── scraper/          # Core scraping + strategies
│       ├── types/
│       └── utils/            # Metrics, tracing, logging
├── client/                   # Part 3: React Frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── api/              # API client modules
│       ├── components/       # Reusable UI components
│       ├── pages/            # Route-level pages
│       ├── hooks/            # Custom React hooks
│       └── utils/
└── packages/                 # Part 4: Shared Libraries
```

## File Count Summary

| Part | Source Files | Test Files | Total TS |
|------|-------------|------------|----------|
| server | 58 | 45 | 103 |
| scraper | 26 | 6 | 32 |
| client | 70 | 40+ | 110+ |
| packages | 0 | 0 | 0 |

**Total TypeScript files:** ~250 (excluding node_modules, dist, build)
