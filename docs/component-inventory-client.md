# Component Inventory — Client (allo-scrapper)

> Generated: 2026-05-21 | 33 components across 3 categories

## Overview

The client has **33 components** organized into three main categories. Components follow React 19.2 patterns with TypeScript prop types.

---

## Public Components (17)

Components used by end-users browsing showtimes.

### Layout
| Component | File | Description |
|-----------|------|-------------|
| `Layout` | `client/src/components/Layout.tsx` | Main app shell with header, footer, navigation |

### Movie Browsing
| Component | File | Description |
|-----------|------|-------------|
| `MovieCard` | `client/src/components/MovieCard.tsx` | Movie poster, title, schedule summary |
| `MovieSearchBar` | `client/src/components/MovieSearchBar.tsx` | Search/filter movies by title |
| `PasswordRequirements` | `client/src/components/PasswordRequirements.tsx` | Password strength indicator |

### Theater/Cinema
| Component | File | Description |
|-----------|------|-------------|
| `CalendarPopover` | `client/src/components/CalendarPopover.tsx` | Date picker popover |
| `CinemaDateSelector` | `client/src/components/CinemaDateSelector.tsx` | Date selection for cinema view |
| `CinemaShowtimes` | `client/src/components/CinemaShowtimes.tsx` | Showtime listing for a cinema |
| `CinemasQuickLinks` | `client/src/components/CinemasQuickLinks.tsx` | Quick navigation between cinemas |
| `DaySelector` | `client/src/components/DaySelector.tsx` | Day-of-week selector |

### Error Handling
| Component | File | Description |
|-----------|------|-------------|
| `ErrorBoundary` | `client/src/components/ErrorBoundary.tsx` | React error boundary wrapper |

---

## Admin Components (13)

Components used in the admin panel for system management.

### Cinema Management
| Component | File | Description |
|-----------|------|-------------|
| `AddCinemaModal` | `client/src/components/admin/AddCinemaModal.tsx` | Modal form to add new cinema |
| `EditCinemaModal` | `client/src/components/admin/EditCinemaModal.tsx` | Modal form to edit cinema |
| `DeleteCinemaDialog` | `client/src/components/admin/DeleteCinemaDialog.tsx` | Confirmation dialog for cinema deletion |

### User Management
| Component | File | Description |
|-----------|------|-------------|
| `CreateUserModal` | `client/src/components/admin/CreateUserModal.tsx` | Modal form to create user |
| `DeleteUserDialog` | `client/src/components/admin/DeleteUserDialog.tsx` | Confirmation dialog for user deletion |
| `PasswordResetDialog` | `client/src/components/admin/PasswordResetDialog.tsx` | Password reset dialog |

### White-Label / Theming
| Component | File | Description |
|-----------|------|-------------|
| `ColorPicker` | `client/src/components/admin/ColorPicker.tsx` | Color input for theme customization |
| `FontSelector` | `client/src/components/admin/FontSelector.tsx` | Font family selector |
| `FooterLinksEditor` | `client/src/components/admin/FooterLinksEditor.tsx` | Footer links configuration |
| `ImageUpload` | `client/src/components/admin/ImageUpload.tsx` | Logo/favicon image upload |

---

## UI Primitives (3)

Base UI components for consistent design.

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `client/src/components/ui/Button.tsx` | Primary button with variants |
| `IconButton` | `client/src/components/ui/IconButton.tsx` | Icon-only button |
| `LinkButton` | `client/src/components/ui/LinkButton.tsx` | Button styled as link |

---

## Custom Hooks

| Hook | File | Description |
|------|------|-------------|
| `useTheme` | `client/src/hooks/useTheme.ts` | White-label theme management |
| `useDebounce` | `client/src/hooks/useDebounce.ts` | Debounced value for search inputs |
| `useScrapeProgress` | `client/src/hooks/useScrapeProgress.ts` | Real-time scraping progress via polling |

---

## API Modules

Each API module wraps a domain's endpoints:

| Module | File | Endpoints |
|--------|------|-----------|
| `client.ts` | `client/src/api/client.ts` | Axios instance, auth interceptors, base config |
| `theaters.ts` | `client/src/api/theaters.ts` | CRUD theaters |
| `users.ts` | `client/src/api/users.ts` | User management |
| `roles.ts` | `client/src/api/roles.ts` | Role management |
| `settings.ts` | `client/src/api/settings.ts` | App settings, white-label |
| `system.ts` | `client/src/api/system.ts` | Health, metrics |
| `rate-limits.ts` | `client/src/api/rate-limits.ts` | Rate limit configuration |
