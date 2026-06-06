---
project_name: 'allo-scrapper'
user_name: 'Developer'
date: '2026-05-31'
sections_completed: ['technology_stack']
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version | Where |
|---|---|---|
| Node.js | >=24.0.0 | Runtime |
| npm | >=10.0.0 | Package manager |
| TypeScript | 6.0.3 (server, scraper), ~6.0.3 (client) | Language |
| Express.js | 5.2.1 | Backend framework |
| React | 19.2.0 | Frontend framework |
| Vite | 8.0.14 | Client build tool |
| Tailwind CSS | 4.1.18 | Styling |
| PostgreSQL | 15 | Database |
| pg (node-postgres) | 8.21.0 | DB driver |
| Redis | 7 (alpine) | Cache / job queue |
| ioredis | 5.11.0 | Redis client |
| Vitest | 4.1.7 | Unit/integration testing |
| Playwright | 1.60.0 | E2E testing |
| Docker | node:24-alpine | Container runtime |
| Prometheus | prom-client 15.1.x | Metrics |
| Winston | 3.19.0 | Logging |
| Helmet | 8.2.0 | Security headers |
| node-cron | 4.2.1 | Cron scheduling (scraper) |
| cheerio | 1.0.0 | HTML parsing (scraper) |
| puppeteer-core | 25.1.0 | Browser automation (scraper) |
| OpenTelemetry | 0.218.0 / 1.9.1 | Tracing (scraper) |
| Zod | 4.4.3 | Schema validation (client) |
| react-router-dom | 7.15.1 | Client routing |
| @tanstack/react-query | 5.100.14 | Server state management |

### Build & Config Tools

| Tool | Config File | Key Settings |
|---|---|---|
| TypeScript | `server/tsconfig.json`, `scraper/tsconfig.json` | target ES2022, module ESNext, strict, noUnusedLocals, noUnusedParameters, noImplicitReturns |
| TypeScript (client) | `client/tsconfig.app.json` | strict, verbatimModuleSyntax, erasableSyntaxOnly, react-jsx |
| Playwright | `playwright.config.ts` | testDir e2e/, fullyParallel false, workers 1, chrominum only |
| ESLint | `client/eslint.config.js` | Client only |
| PostCSS | `client/postcss.config.js` | @tailwindcss/postcss + autoprefixer |

---

## Critical Implementation Rules

_Documented after discovery phase_
