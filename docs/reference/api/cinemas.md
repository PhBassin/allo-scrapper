# Cinemas API

**Related:** [Authentication API](./auth.md) for authentication details

## Cinemas

### List All Cinemas

```http
GET /api/cinemas
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "address": "100 Rue Mouffetard",
      "postal_code": "75005",
      "city": "Paris",
      "screen_count": 1,
      "image_url": "https://..."
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/cinemas
```

---

### Get Cinema Details

```http
GET /api/cinemas/:id
```

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response:**
```json
{
  "success": true,
  "data": {
    "showtimes": [
      {
        "id": "W7504-123456-2024-02-15-14:00",
        "date": "2024-02-15",
        "time": "14:00",
        "datetime_iso": "2024-02-15T14:00:00+01:00",
        "version": "VF",
        "format": "2D",
        "experiences": ["Dolby Atmos"],
        "film": {
          "id": 123456,
          "title": "Film Title",
          "original_title": "Original Title"
        }
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/cinemas/W7504"
```

---

### Add Cinema

```http
POST /api/cinemas
```

**Body (JSON):**
```json
{
  "id": "C0099",
  "name": "New Cinema",
  "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "id": "C0099",
    "name": "New Cinema",
    "url": "https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"
  }
}
```

**Error Responses:**
- `400` — Missing required fields (`id`, `name`, `url`)
- `409` — Cinema with this ID already exists

**Example:**
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -d '{"id":"C0099","name":"New Cinema","url":"https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html"}'
```

---

### Update Cinema

```http
PUT /api/cinemas/:id
```

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Body (JSON):** At least one field required.
```json
{
  "name": "Updated Name",
  "url": "https://new-url.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "W7504",
    "name": "Updated Name",
    "url": "https://new-url.com"
  }
}
```

**Error Responses:**
- `400` — No fields provided
- `404` — Cinema not found

**Example:**
```bash
curl -X PUT http://localhost:3000/api/cinemas/W7504 \
  -H "Content-Type: application/json" \
  -d '{"name":"Épée de Bois (updated)"}'
```

---

### Delete Cinema

```http
DELETE /api/cinemas/:id
```

Deletes the cinema and cascades to all its showtimes and weekly programs.

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response (204):**
```json
{ "success": true }
```

**Error Responses:**
- `404` — Cinema not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/cinemas/C0099
```


[← Back to API Reference](./README.md)
