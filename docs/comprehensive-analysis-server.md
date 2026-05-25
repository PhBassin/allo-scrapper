# Comprehensive Analysis — Server (allo-scrapper)

> Generated: 2026-05-21 | Deep analysis of patterns, conventions, and architecture

## Code Patterns

### Route Handler Pattern
Every route file follows a consistent pattern:
1. Import dependencies (express, zod, services, middleware)
2. Define Zod validation schemas
3. Create Express Router
4. Apply middleware per-route (auth, permission, validation)
5. Define handler functions with try/catch
6. Export router

### Service Layer Pattern
Services encapsulate business logic and are injected into routes:
- **Stateless** — No request context stored
- **Async** — All database operations return Promises
- **Error propagation** — Custom error types from `utils/errors.ts`

### Query Module Pattern
Each database table has a dedicated query module:
- Named exports for each operation
- Type-safe using Drizzle's inferred types
- Transaction support where needed

---

## Performance Considerations

### JSON Parse Cache
`utils/json-parse-cache.ts` implements a caching layer for frequently parsed JSON (e.g., theater showtime data from scraper). Benchmark tests exist.

### Database Query Optimization
- Drizzle ORM with PostgreSQL
- Indexed columns on frequently queried fields
- Connection pooling via `postgres` driver

### Redis Caching
- BullMQ for async job processing
- Redis used as message broker between server and scraper

---

## Security Analysis

| Concern | Mitigation |
|---------|-----------|
| XSS | HTML decode via `utils/html-decode.ts` |
| CSRF | JWT tokens, CORS configuration |
| SQL Injection | Drizzle ORM (parameterized queries) |
| Brute Force | Rate limiting per endpoint |
| File Upload | Image validation via `utils/image-validator.ts` |
| Secret Management | Environment variables, JWT secret validation |

---

## Error Handling Strategy

Centralized error handling via `middleware/error-handler.ts`:
1. Custom error classes in `utils/errors.ts`
2. Express error middleware catches all thrown errors
3. Standardized JSON error response format
4. Different detail levels for dev vs production

---

## Testing Strategy

| Type | Location | Framework |
|------|----------|-----------|
| Unit tests | Co-located `*.test.ts` | Vitest |
| Route tests | `routes/*.test.ts` | Vitest + supertest |
| Security tests | `routes/theaters.security.test.ts` | Vitest |
| Validation tests | `routes/theaters.validation.test.ts` | Vitest |
| Benchmark tests | `utils/json-parse-cache.benchmark.test.ts` | Vitest |
| Integration tests | `app.test.ts` | Vitest |

---

## Conventions

- **TypeScript strict mode** enabled
- **ESM modules** (type: "module" in package.json)
- **Conventional commits** enforced
- **Prettier** for formatting
- **ESLint** for linting
- **Zod** for all input validation
- **Drizzle** for all database access
- **Winston** for logging

---

## Dependencies (Key)

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.2 | HTTP framework |
| drizzle-orm | latest | ORM |
| postgres | latest | PostgreSQL driver |
| jsonwebtoken | latest | JWT auth |
| zod | latest | Validation |
| helmet | latest | Security headers |
| cors | latest | CORS |
| bullmq | latest | Redis job queue |
| winston | latest | Logging |
| bcryptjs | latest | Password hashing |
