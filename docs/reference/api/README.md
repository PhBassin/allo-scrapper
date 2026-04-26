# API Reference

Current API surface registered by `server/src/app.ts`.

## Public endpoints

- `GET /api/health`
- `GET /api/theme.css`
- `GET /api/config`
- `GET /api/settings`
- `GET /api/films`
- `GET /api/films/search`
- `GET /api/films/:id`
- `GET /api/cinemas`
- `GET /api/cinemas/:id`
- `POST /api/auth/login`

## Protected endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/change-password`

### Scraper

- `POST /api/scraper/trigger`
- `POST /api/scraper/resume/:reportId`
- `GET /api/scraper/status`
- `GET /api/scraper/progress`
- `GET /api/scraper/dlq`
- `GET /api/scraper/dlq/:jobId`
- `POST /api/scraper/dlq/:jobId/retry`
- `GET /api/scraper/schedules`
- `GET /api/scraper/schedules/:id`
- `POST /api/scraper/schedules`
- `PUT /api/scraper/schedules/:id`
- `DELETE /api/scraper/schedules/:id`
- `POST /api/scraper/schedules/:id/trigger`

Alias path for DLQ operations:

- `/api/admin/scraper/dlq`
- `/api/admin/scraper/dlq/:jobId`
- `/api/admin/scraper/dlq/:jobId/retry`

### Reports

- `GET /api/reports`
- `GET /api/reports/:id`
- `GET /api/reports/:id/details`

### Cinemas

- `POST /api/cinemas`
- `PUT /api/cinemas/:id`
- `DELETE /api/cinemas/:id`

### Settings

- `GET /api/settings/admin`
- `PUT /api/settings`
- `POST /api/settings/reset`
- `POST /api/settings/export`
- `POST /api/settings/import`

### Users

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id/role`
- `POST /api/users/:id/reset-password`
- `DELETE /api/users/:id`

### Roles

- `GET /api/roles/permissions`
- `GET /api/roles/permission-categories`
- `GET /api/roles`
- `GET /api/roles/:id`
- `POST /api/roles`
- `PUT /api/roles/:id`
- `DELETE /api/roles/:id`
- `PUT /api/roles/:id/permissions`

### System

- `GET /api/system/info`
- `GET /api/system/migrations`
- `GET /api/system/health`

## Related pages

- [Overview](./overview.md)
- [Auth](./auth.md)
- [Cinemas](./cinemas.md)
- [Films](./films.md)
- [Scraper](./scraper.md)
- [Reports](./reports.md)
- [Settings](./settings.md)
- [Users](./users.md)
- [Roles](./roles.md)
- [System](./system.md)
- [Health](./health.md)
