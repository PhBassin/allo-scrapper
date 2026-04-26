# Client Workspace

React 19 + Vite frontend for Allo-Scrapper.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:run
npm run preview
```

## Local behavior

- Vite dev server runs on `5173`
- `vite.config.ts` proxies both `/api` and `/test` to the backend target
- SaaS mode is discovered from `GET /api/config`, not from a `VITE_SAAS_ENABLED` compile-time flag

## Key dependencies

- `react`
- `react-router-dom`
- `@tanstack/react-query`
- `axios`
- `zod`

## Related

- Root setup: [`../README.md`](../README.md)
- API config route: [`../docs/reference/api/README.md`](../docs/reference/api/README.md)
