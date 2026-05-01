# Allo-Scrapper Client

React SPA frontend for the Allo-Scrapper cinema showtimes aggregator.

## Stack

- **React 19** with TypeScript
- **Vite 8** for dev server and bundling
- **Tailwind CSS 4** for styling
- **React Router 7** for client-side routing
- **TanStack React Query 5** for server state management
- **Axios** for HTTP requests
- **Zod 4** for schema validation

## Quick Start

```bash
# Install dependencies
cd client
npm install

# Start dev server (default: http://localhost:5173)
npm run dev
```

The Vite dev server proxies `/api` and `/test` requests to the backend (default `http://localhost:3000`). Override with `VITE_PROXY_TARGET`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest single run |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Backend API base URL |
| `VITE_PROXY_TARGET` | derived from API URL | Vite proxy target origin |
| `VITE_APP_NAME` | `Allo-Scrapper` | Application name (browser tab, header) |

## Architecture

The client is a single-page application with these key areas:

- **Public pages**: Login, register, cinema schedules
- **Admin panel**: `/admin/*` — user management, settings, reports, rate limits
- **White-label theming**: Dynamic CSS via `/api/theme.css`, `useTheme` hook
- **Real-time updates**: SSE connection for live scraping progress

## Testing

```bash
# Run all tests (Vitest + jsdom)
npm run test:run

# Watch mode
npm test
```

Tests use `@testing-library/react`, `@testing-library/user-event`, and `jsdom`.

## Related Documentation

- [Main README](../README.md)
- [API Reference](../docs/reference/api/)
- [Admin Panel Guide](../docs/guides/administration/admin-panel.md)
