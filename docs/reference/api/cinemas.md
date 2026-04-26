# Cinemas API

## `GET /api/cinemas`

Public endpoint.

Returns the current cinema list from the database.

## `GET /api/cinemas/:id`

Public endpoint.

Returns cinema showtimes for the current `weekStart`.

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

## `POST /api/cinemas`

Protected.

Requires `cinemas:create`.

Supported request modes:

### Smart add by URL

```json
{
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"
}
```

This inserts the cinema, creates a scrape report, and enqueues an `add_cinema` job in Redis.

### Manual add

```json
{
  "id": "C0099",
  "name": "New Cinema",
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0099.html"
}
```

## `PUT /api/cinemas/:id`

Protected.

Requires `cinemas:update`.

Updatable fields include:

- `name`
- `url`
- `address`
- `postal_code`
- `city`
- `screen_count`

## `DELETE /api/cinemas/:id`

Protected.

Requires `cinemas:delete`.

Returns `204 No Content` on success.

## Current route note

There is no `POST /api/cinemas/sync` route in the current server.
