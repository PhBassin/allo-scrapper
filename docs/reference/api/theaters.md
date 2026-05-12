# Theaters API

## `GET /api/theaters`

Public endpoint.

Returns the current theater list from the database.

## `GET /api/theaters/:id`

Public endpoint.

Returns theater showtimes for the current `weekStart`.

Response shape:

```json
{
  "success": true,
  "data": {
    "showtimes": [],
    "weekStart": "2026-04-22"
  }
}
```

## `POST /api/theaters`

Protected.

Requires `theaters:create`.

Supported request modes:

### Smart add by URL

```json
{
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"
}
```

This inserts the theater, creates a scrape report, and enqueues an `add_theater` job in Redis.

### Manual add

```json
{
  "id": "C0099",
  "name": "New Theater",
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0099.html"
}
```

## `PUT /api/theaters/:id`

Protected.

Requires `theaters:update`.

Updatable fields include:

- `name`
- `url`
- `address`
- `postal_code`
- `city`
- `screen_count`

## `DELETE /api/theaters/:id`

Protected.

Requires `theaters:delete`.

Returns `204 No Content` on success.

## Current route note

There is no `POST /api/theaters/sync` route in the current server.
