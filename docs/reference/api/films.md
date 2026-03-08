# Films API

## Films

### List All Films

```http
GET /api/films
```

**Response:**
```json
{
  "success": true,
  "data": {
    "films": [
      {
        "id": 123456,
        "title": "Film Title",
        "original_title": "Original Title",
        "poster_url": "https://...",
        "duration_minutes": 120,
        "release_date": "2024-01-15",
        "genres": ["Drama"],
        "nationality": "France",
        "director": "Director Name"
      }
    ],
    "weekStart": "2024-02-12"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films
```

---

### Get Film Details

```http
GET /api/films/:id
```

**Parameters:**
- `id` (integer): Film ID from the source website

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123456,
    "title": "Film Title",
    "original_title": "Original Title",
    "poster_url": "https://...",
    "duration_minutes": 120,
    "release_date": "2024-01-15",
    "rerelease_date": null,
    "genres": ["Drama", "Thriller"],
    "nationality": "France",
    "director": "Director Name",
    "actors": ["Actor 1", "Actor 2"],
    "synopsis": "Full synopsis text...",
    "certificate": "TP",
    "press_rating": 4.2,
    "audience_rating": 3.8,
    "source_url": "https://www.example-cinema-site.com/film/fichefilm_gen_cfilm=123456.html",
    "cinemas": [
      {
        "id": "W7504",
        "name": "Épée de Bois",
        "address": "100 Rue Mouffetard",
        "postal_code": "75005",
        "city": "Paris",
        "screen_count": 1,
        "image_url": "https://...",
        "showtimes": [
          {
            "id": "W7504-123456-2024-02-15-14:00",
            "date": "2024-02-15",
            "time": "14:00",
            "datetime_iso": "2024-02-15T14:00:00+01:00",
            "version": "VF",
            "format": "2D",
            "experiences": []
          }
        ]
      }
    ]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/films/123456
```

---

### Search Films

```http
GET /api/films/search?q={query}
```

Search for films using fuzzy matching with PostgreSQL trigram similarity. Returns up to 10 results matching the query string.

**Query Parameters:**
- `q` (string, required): Search query (minimum 2 characters)

**Search Behavior:**
- Uses multi-strategy hybrid search combining:
  1. **Exact match** (highest priority): `title = query` or `original_title = query`
  2. **Prefix match**: Title starts with query (e.g., "Mar" → "Marty")
  3. **Trigram similarity** (very permissive, similarity > 0.1): Handles typos and variations
  4. **Partial match** (case-insensitive ILIKE `%query%`): Contains query anywhere
  5. **Original title search**: All strategies applied to `original_title` as well
- Results ordered by relevance using weighted scoring:
  - Exact match: 1.0 (highest)
  - Starts with query: 0.9
  - High trigram similarity (>0.3): 0.6-0.8
  - Low trigram similarity (>0.1): 0.5-0.6 (very permissive!)
  - Contains anywhere: 0.35-0.4
- **Very permissive**: Accepts false positives for maximum coverage (e.g., "mer" finds "Marty", "La Mer", "Merlin")
- Returns up to 10 results

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 123456,
      "title": "The Matrix",
      "original_title": "The Matrix",
      "poster_url": "https://...",
      "duration_minutes": 136,
      "release_date": "1999-06-23",
      "genres": ["Sci-Fi", "Action"],
      "nationality": "USA",
      "director": "Wachowski Brothers"
    }
  ]
}
```

**Error Responses:**
- `400` — Missing or invalid query parameter (e.g., query too short)

**Examples:**
```bash
# Exact match
curl "http://localhost:3000/api/films/search?q=Matrix"

# Fuzzy match (typo)
curl "http://localhost:3000/api/films/search?q=Matirx"

# Partial match
curl "http://localhost:3000/api/films/search?q=Matr"

# Very permissive search (accepts variations)
curl "http://localhost:3000/api/films/search?q=mer"
# → Finds "Marty", "La Mer", "Merlin", etc.

# Original title search
curl "http://localhost:3000/api/films/search?q=The%20Matrix"
# → Finds films with original_title="The Matrix"

# URL-encoded query (with spaces)
curl "http://localhost:3000/api/films/search?q=The%20Dark%20Knight"
```

---

[← Back to API Reference](./README.md)
