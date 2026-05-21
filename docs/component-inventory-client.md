# UI Component Inventory — Client (React)

## Overview
- **Framework**: React 19.2 + TypeScript 6.0
- **Styling**: Tailwind CSS 4.1
- **Routing**: React Router 7.13
- **Data Fetching**: TanStack React Query 5.90 + Axios 1.13
- **Validation**: Zod 4.3
- **Testing**: Vitest 4.1 + Testing Library + jsdom

## Page Components (14)

### Public Pages
| Component | Path | File | Description |
|-----------|------|------|-------------|
| HomePage | `/` | `src/pages/HomePage.tsx` | Weekly movies, day selector, cinemas links, search |
| CinemaPage | `/theater/:id` | `src/pages/CinemaPage.tsx` | Single cinema detail, date selector, showtimes |
| MoviePage | `/movie/:id` | `src/pages/MoviePage.tsx` | Movie detail, cast, synopsis, showtimes by cinema |
| LoginPage | `/login` | `src/pages/LoginPage.tsx` | Login form, session-expired detection |
| ChangePasswordPage | `/change-password` | `src/pages/ChangePasswordPage.tsx` | Protected password change + strength validation |

### Admin Pages (under `/admin?tab=...`)
| Component | Tab | File | Description |
|-----------|-----|------|-------------|
| AdminPage | — | `src/pages/admin/AdminPage.tsx` | Permission-gated tab container |
| CinemasPage | cinemas | `src/pages/admin/CinemasPage.tsx` | Cinema CRUD table + scrape |
| SchedulesPage | schedules | `src/pages/admin/SchedulesPage.tsx` | Cron schedule CRUD |
| ReportsPage | rapports | `src/pages/ReportsPage.tsx` | Scrape reports history |
| UsersPage | users | `src/pages/admin/UsersPage.tsx` | User management |
| RoleManagementPage | roles | `src/components/admin/RoleManagementPage.tsx` | Role CRUD + permissions |
| SettingsPage | settings | `src/pages/admin/SettingsPage.tsx` | White-label settings (colors, fonts, logos) |
| RateLimitsPage | ratelimits | `src/pages/admin/RateLimitsPage.tsx` | Rate limit configuration |
| SystemPage | system | `src/pages/admin/SystemPage.tsx` | System health + DB stats |

## Shared Components (10)
| Component | File | Purpose |
|-----------|------|---------|
| Layout | `src/components/Layout.tsx` | App shell: sticky header, nav, user dropdown, footer |
| ProtectedRoute | `src/components/ProtectedRoute.tsx` | Auth guard → redirect to /login |
| RequirePermission | `src/components/RequirePermission.tsx` | Permission guard (single/anyOf/allOf) |
| RequireAdmin | `src/components/RequireAdmin.tsx` | Legacy admin-only guard |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | Render error catch + reload UI |
| MovieCard | `src/components/MovieCard.tsx` | Memoized movie listing card with expandable showtimes |
| MovieSearchBar | `src/components/MovieSearchBar.tsx` | Debounced fuzzy search with dropdown |
| ShowtimeList | `src/components/ShowtimeList.tsx` | Time buttons grouped by version → CalendarPopover |
| DaySelector | `src/components/DaySelector.tsx` | 7-day selector + 'Now' + 'All days' |
| CinemaDateSelector | `src/components/CinemaDateSelector.tsx` | Cinema date picker with showtime counts |
| CinemasQuickLinks | `src/components/CinemasQuickLinks.tsx` | Cinema quick-link chips |
| CinemaShowtimes | `src/components/CinemaShowtimes.tsx` | Showtimes grouped by cinema |
| ScrapeButton | `src/components/ScrapeButton.tsx` | Scrape trigger with loading/success/error |
| ScrapeProgress | `src/components/ScrapeProgress.tsx` | SSE real-time scrape progress bar |
| CalendarPopover | `src/components/CalendarPopover.tsx` | Portal dropdown: Google Calendar / .ics download |
| ScrollToTop | `src/components/ScrollToTop.tsx` | Floating scroll-to-top button |
| PasswordRequirements | `src/components/PasswordRequirements.tsx` | Live password strength checklist |

## UI Primitives (3)
| Component | File | Props |
|-----------|------|-------|
| Button | `src/components/ui/Button.tsx` | variant (primary/secondary/danger), size (sm/md/lg) |
| IconButton | `src/components/ui/IconButton.tsx` | variant (neutral/danger), aria-label required |
| LinkButton | `src/components/ui/LinkButton.tsx` | variant (primary/danger/success/warning) |

## Admin Modals & Forms (10)
| Component | Purpose |
|-----------|---------|
| AddCinemaModal | Smart-add via URL + manual cinema creation |
| EditCinemaModal | Edit cinema metadata (name, URL, address, etc.) |
| DeleteCinemaDialog | Confirm cinema deletion |
| CreateUserModal | User creation with password validation |
| DeleteUserDialog | Confirm user deletion |
| PasswordResetDialog | Show generated password (copy-once) |
| RoleBadge | Visual role badge (admin/custom/system) |
| ColorPicker | Hex color input + preview |
| FontSelector | Google Fonts dropdown with live preview |
| ImageUpload | Logo/favicon upload → base64 with size validation |
| FooterLinksEditor | Dynamic footer links array editor (add/remove/reorder) |
| ScheduleModal | Cron schedule create/edit (simple + advanced mode) |

## Custom Hooks (3)
| Hook | File | Purpose |
|------|------|---------|
| useDebounce | `src/hooks/useDebounce.ts` | Generic debounce for inputs |
| useScrapeProgress | `src/hooks/useScrapeProgress.ts` | SSE subscription to /scraper/progress |
| useTheme | `src/hooks/useTheme.ts` | Dynamic CSS + favicon injection from settings |

## Utilities (8)
| Utility | File | Purpose |
|---------|------|---------|
| getUniqueDates | `src/utils/date.ts` | Extract unique sorted dates from showtimes |
| formatDateLabel | `src/utils/date.ts` | fr-FR locale date formatting with caching |
| buildGoogleCalendarUrl | `src/utils/calendar.ts` | Google Calendar add-event URL builder |
| buildIcsContent | `src/utils/calendar.ts` | RFC 5545 .ics file generator |
| downloadIcsFile | `src/utils/calendar.ts` | Browser .ics download trigger |
| highlightText | `src/utils/highlight.tsx` | Case-insensitive text highlight with <mark> |
| groupPermissionsByCategory | `src/utils/permission-grouping.ts` | Permissions grouped by category for UI |
| ADMIN_PERMISSIONS | `src/utils/adminPermissions.ts` | Exhaustive admin route permission list |
