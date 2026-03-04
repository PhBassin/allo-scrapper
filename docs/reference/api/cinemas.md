# Cinemas API

**Related:** [Authentication API](./auth.md) for authentication details

## Cinemas

### List All Cinemas

```http
GET /api/cinemas
```

No authentication required.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "W7504",
      "name": "Épée de Bois",
      "url": "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html",
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

No authentication required.

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

🔒 **Requires authentication (admin role)**

This endpoint supports two modes:

#### Smart Add (Recommended)
Provide only a URL and the server will automatically scrape cinema details from AlloCiné:

**Body (JSON):**
```json
{
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "id": "C0072",
    "name": "UGC Ciné Cité Les Halles",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html",
    "address": "7 Place de la Rotonde",
    "postal_code": "75001",
    "city": "Paris",
    "screen_count": 27
  }
}
```

#### Manual Add
Provide all cinema details manually:

**Body (JSON):**
```json
{
  "id": "C0099",
  "name": "New Cinema",
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0099.html"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "id": "C0099",
    "name": "New Cinema",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0099.html"
  }
}
```

**Error Responses:**
- `400` — Invalid AlloCiné URL (must be `https://www.allocine.fr/...`)
- `400` — Missing required fields for manual add (`id`, `name`, `url`)
- `409` — Cinema with this ID already exists

**Example (Smart Add):**
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"}'
```

**Example (Manual Add):**
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"id":"C0099","name":"New Cinema","url":"https://www.allocine.fr/seance/salle_gen_csalle=C0099.html"}'
```

---

### Update Cinema

```http
PUT /api/cinemas/:id
```

🔒 **Requires authentication (admin role)**

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Body (JSON):** At least one field required.
```json
{
  "name": "Updated Name",
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html",
  "address": "New Address",
  "postal_code": "75001",
  "city": "Paris",
  "screen_count": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "W7504",
    "name": "Updated Name",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html",
    "address": "New Address",
    "postal_code": "75001",
    "city": "Paris",
    "screen_count": 5
  }
}
```

**Error Responses:**
- `400` — No fields provided
- `400` — Invalid AlloCiné URL (must be `https://www.allocine.fr/...`)
- `404` — Cinema not found

**Example:**
```bash
curl -X PUT http://localhost:3000/api/cinemas/W7504 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Épée de Bois (updated)"}'
```

---

### Delete Cinema

```http
DELETE /api/cinemas/:id
```

🔒 **Requires authentication (admin role)**

Deletes the cinema and cascades to all its showtimes and weekly programs.

**Parameters:**
- `id` (string): Cinema ID (e.g., `W7504`)

**Response (204 No Content):**
(empty - no response body)

**Note:** A 204 status indicates successful deletion with no response body.

**Error Responses:**
- `404` — Cinema not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/cinemas/C0099 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Last updated:** March 4, 2026

[← Back to API Reference](./README.md)
