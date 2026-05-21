# Comprehensive Analysis — Client (React Frontend)

## Architecture Pattern
**Component-based SPA** with centralized state management via React Context + TanStack React Query.

## State Management (11 Patterns)
1. **React Query** — Server state: movies, theaters, schedules, reports, roles, users. `staleTime=0`, `refetchOnWindowFocus=true`
2. **AuthContext** — Auth state: token, user, isAdmin, hasPermission. Persisted to localStorage. JWT expiry detection + auto-logout
3. **SettingsContext** — White-label settings: publicSettings (no auth), adminSettings (on demand). Theme propagation
4. **useState (local)** — Modal visibility, form state, search/filter, date selection
5. **useSearchParams** — Admin tab selection (`?tab=cinemas`), pagination (`?page=X`)
6. **useMutation** — Cinema CRUD with query invalidation, scrape resume
7. **useMemo** — MovieCard, DaySelector, CinemaDateSelector, ShowtimeList performance
8. **SSE (EventSource)** — useScrapeProgress: real-time scrape progress stream
9. **JWT Interceptor** — Axios Bearer token injection + 401 detection (`auth:unauthorized` event)
10. **Zod Validation** — Runtime API response validation (roles, permissions)
11. **ErrorBoundary** — Class-based render error catcher

## Routing Structure
```
/                          → HomePage (public)
/login                     → LoginPage (public)
/change-password           → ChangePasswordPage (auth required)
/theater/:id               → CinemaPage (public)
/movie/:id                 → MoviePage (public)
/admin?tab=cinemas         → CinemasPage (admin: theaters:list)
/admin?tab=schedules       → SchedulesPage (admin: schedules:list)
/admin?tab=rapports        → ReportsPage (admin: reports:list)
/admin?tab=users           → UsersPage (admin: users:list)
/admin?tab=roles           → RoleManagementPage (admin: roles:list)
/admin?tab=settings        → SettingsPage (admin: settings:read)
/admin?tab=ratelimits      → RateLimitsPage (admin: ratelimits:read)
/admin?tab=system          → SystemPage (admin: system:info)
```

## Client → Server Integration (47 endpoints consumed)
The client calls 47 distinct API endpoints via Axios with JWT interceptor:
- Movies: GET /movies, /movies?date, /movies/:id, /movies/search
- Theaters: full CRUD + get schedule
- Scraper: trigger, status, progress (SSE), resume, schedules CRUD
- Reports: list (paginated), detail, detail-with-attempts
- Settings: public, admin, update, reset, export, import
- Auth: login, change-password
- Users: list, get, create, change-role, reset-password, delete
- Roles: list, create, update, delete, set-permissions, permissions-list, categories
- Rate Limits: get, update, reset, audit, constraints
- System: info, migrations, health
- Theme: GET /api/theme.css (dynamic stylesheet)

## Performance Patterns
- **Memoization**: MovieCard, DaySelector, CinemaDateSelector, CinemasQuickLinks, ShowtimeList
- **Cached Intl.DateTimeFormat**: formatDateLabel, formatUptime, formatDate
- **ETag caching**: /api/theme.css (If-None-Match, 1h Cache-Control)
- **Debounced search**: MovieSearchBar (300ms)
- **Lazy loading**: React Query with loading/error states
- **Portal rendering**: CalendarPopover (avoids overflow clipping)
