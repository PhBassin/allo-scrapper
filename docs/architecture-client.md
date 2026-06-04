# Architecture — Client (allo-scrapper)

> Generated: 2026-05-21 | React 19.2 + Vite 8 + Tailwind CSS 4.1 + TanStack Query 5.90

## Overview

The client is a **Single Page Application (SPA)** built with React 19.2. It consumes the server REST API and provides theater showtime browsing, admin management, and white-label configuration.

**Tech Stack:**
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 8 | Build tool & dev server |
| Tailwind CSS | 4.1 | Utility-first CSS |
| TanStack Query | 5.90 | Server state & caching |
| TypeScript | 6.0 | Type safety |
| React Router | latest | Client-side routing |

---

## Directory Structure

```
client/src/
├── App.tsx               # Root component, router setup
├── main.tsx              # Entry point, ReactDOM render
├── api/                  # API client layer
│   ├── client.ts         # Axios/fetch wrapper, base config
│   ├── theaters.ts       # Theater API calls
│   ├── users.ts          # User management API
│   ├── roles.ts          # Role management API
│   ├── settings.ts       # Settings API
│   ├── system.ts         # System info API
│   └── rate-limits.ts    # Rate limit config API
├── components/           # Reusable UI components
│   ├── Layout.tsx        # Main layout wrapper
│   ├── MovieCard.tsx     # Movie display card
│   ├── MovieSearchBar.tsx
│   ├── CalendarPopover.tsx
│   ├── CinemaDateSelector.tsx
│   ├── CinemaShowtimes.tsx
│   ├── CinemasQuickLinks.tsx
│   ├── DaySelector.tsx
│   ├── ErrorBoundary.tsx
│   ├── PasswordRequirements.tsx
│   ├── admin/            # Admin-specific components
│   │   ├── AddCinemaModal.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── CreateUserModal.tsx
│   │   ├── DeleteCinemaDialog.tsx
│   │   ├── DeleteUserDialog.tsx
│   │   ├── EditCinemaModal.tsx
│   │   ├── FontSelector.tsx
│   │   ├── FooterLinksEditor.tsx
│   │   ├── ImageUpload.tsx
│   │   └── PasswordResetDialog.tsx
│   └── ui/               # Primitive UI components
│       ├── Button.tsx
│       ├── IconButton.tsx
│       └── LinkButton.tsx
├── pages/                # Route-level page components
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── MoviePage.tsx
│   ├── CinemaPage.tsx
│   ├── ChangePasswordPage.tsx
│   ├── ReportsPage.tsx
│   └── admin/            # Admin pages
│       ├── AdminPage.tsx
│       ├── CinemasPage.tsx
│       ├── RateLimitsPage.tsx
│       ├── SchedulesPage.tsx
│       ├── SettingsPage.tsx
│       ├── SystemPage.tsx
│       └── UsersPage.tsx
├── hooks/                # Custom React hooks
│   ├── useDebounce.ts
│   ├── useScrapeProgress.ts
│   └── useTheme.ts
└── utils/                # Utility functions
```

---

## Routing Structure

| Path | Page | Auth |
|------|------|------|
| `/` | HomePage | Public |
| `/login` | LoginPage | Public |
| `/movie/:id` | MoviePage | Public |
| `/cinema/:id` | CinemaPage | Public |
| `/change-password` | ChangePasswordPage | Authenticated |
| `/reports` | ReportsPage | Admin |
| `/admin` | AdminPage | Admin |
| `/admin/cinemas` | CinemasPage | Admin |
| `/admin/users` | UsersPage | Admin |
| `/admin/rate-limits` | RateLimitsPage | Admin |
| `/admin/schedules` | SchedulesPage | Admin |
| `/admin/settings` | SettingsPage | Admin |
| `/admin/system` | SystemPage | Admin |

---

## State Management

### TanStack Query (Server State)
All API data is managed via **TanStack Query 5.90**:
- Automatic caching and background refetching
- Optimistic updates for mutations
- Pagination and infinite queries
- Stale-while-revalidate pattern

### Local State
- **useTheme** — White-label theming (colors, fonts, logos)
- **useDebounce** — Input debouncing for search
- **useScrapeProgress** — Real-time scrape progress via polling

### Auth State
- JWT tokens stored in localStorage/memory
- Auth context/provider pattern
- Automatic token refresh via interceptors

---

## Data Flow

```
User Action
  → React Component (pages/ or components/)
  → TanStack Query Hook (useQuery/useMutation)
  → API Module (api/*.ts)
  → Axios/Fetch (api/client.ts)
  → Server REST API (Express)
  → Response cached by TanStack Query
  → Component re-renders
```

---

## Styling

- **Tailwind CSS 4.1** for utility-first styling
- White-label support via CSS custom properties (theme colors, fonts)
- Responsive design (mobile-first)
- Dark/light mode support

---

## Build & Dev

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

**Vite Config:** `client/vite.config.ts`  
**TypeScript Config:** `client/tsconfig.json`  
**Tailwind Config:** `client/tailwind.config.ts`
