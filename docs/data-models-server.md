# Data Models — Server (PostgreSQL)

## Database: PostgreSQL 15
- **ORM**: Raw SQL via `pg` (8.20) — no ORM
- **Migrations**: Automatic sequential SQL files with SHA-256 checksums
- **Connection**: Pool-based with configurable pool size
- **Extensions**: pg_trgm (fuzzy search)

## Tables (16)

### Core Business Tables

#### theaters
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PRIMARY KEY (Allocine ID, e.g. C0089) |
| name | TEXT | |
| address | TEXT | |
| postal_code | TEXT | |
| city | TEXT | |
| screen_count | INTEGER | |
| image_url | TEXT | |
| url | TEXT | |

#### movies
| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PRIMARY KEY |
| title | TEXT | |
| original_title | TEXT | |
| poster_url | TEXT | |
| duration_minutes | INTEGER | |
| release_date | TEXT | |
| rerelease_date | TEXT | |
| genres | JSONB | Array of genre strings |
| nationality | TEXT | |
| director | TEXT | |
| screenwriters | JSONB | Array of writer names |
| actors | JSONB | Array of actor names |
| synopsis | TEXT | |
| certificate | TEXT | |
| press_rating | REAL | |
| audience_rating | REAL | |
| source_url | TEXT | |
| trailer_url | TEXT | |

#### showtimes
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PRIMARY KEY |
| movie_id | INTEGER | FK → movies.id |
| theater_id | TEXT | FK → theaters.id |
| date | TEXT | |
| time | TEXT | |
| datetime_iso | TEXT | ISO 8601 |
| version | TEXT | VF, VO, VOSTFR, etc. |
| format | TEXT | 2D, 3D, IMAX, etc. |
| experiences | JSONB | Array of experience tags |
| week_start | TEXT | |

#### weekly_programs
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| theater_id | TEXT | FK → theaters.id |
| movie_id | INTEGER | FK → movies.id |
| week_start | TEXT | |
| is_new_this_week | BOOLEAN | |
| scraped_at | TIMESTAMPTZ | |
| | | UNIQUE(theater_id, movie_id, week_start) |

### Scraping Tables

#### scrape_reports
| Column | Type | Description |
|--------|------|------------|
| id | SERIAL | PK |
| started_at / completed_at | TIMESTAMPTZ | |
| status | TEXT | running, success, partial_success, failed |
| trigger_type | TEXT | manual, cron |
| total_theaters / successful_theaters / failed_theaters | INTEGER | |
| total_movies_scraped / total_showtimes_scraped | INTEGER | |
| errors | JSONB | |
| progress_log | JSONB | |
| parent_report_id | INTEGER | Self-FK for resume chains |

#### scrape_attempts
| Column | Type | Description |
|--------|------|------------|
| id | SERIAL | PK |
| report_id | INTEGER | FK → scrape_reports |
| theater_id | TEXT | FK → theaters |
| date | TEXT | |
| status | TEXT | pending, success, failed, rate_limited, not_attempted |
| error_type / error_message / http_status_code | TEXT/INTEGER | |
| movies_scraped / showtimes_scraped | INTEGER | |
| attempted_at | TIMESTAMPTZ | |
| | | UNIQUE(report_id, theater_id, date) |

#### scrape_schedules
| Column | Type | Description |
|--------|------|------------|
| id | SERIAL | PK |
| name | TEXT | UNIQUE |
| description | TEXT | |
| cron_expression | TEXT | |
| enabled | BOOLEAN | |
| target_theaters | JSONB | Theater IDs array |
| created_by / updated_by | INTEGER | FK → users |
| last_run_at / last_run_status | TIMESTAMPTZ/TEXT | |

### Auth & RBAC Tables

#### users
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PK |
| username | TEXT | UNIQUE |
| password_hash | TEXT | bcrypt |
| role_id | INTEGER | FK → roles |
| created_at | TIMESTAMPTZ | |

#### roles
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PK |
| name | TEXT | UNIQUE |
| description | TEXT | |
| is_system | BOOLEAN | Protects core roles |
| created_at | TIMESTAMPTZ | |

#### permissions
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PK |
| name | TEXT | UNIQUE (e.g. 'users:create') |
| description | TEXT | |
| category | TEXT | |
| created_at | TIMESTAMPTZ | |

#### role_permissions
| Column | Type |
|--------|------|
| role_id | INTEGER FK → roles |
| permission_id | INTEGER FK → permissions |
| | PRIMARY KEY(role_id, permission_id) |

#### permission_category_labels
| Column | Type |
|--------|------|
| id | SERIAL PK |
| category_key | TEXT UNIQUE |
| label_en / label_fr | TEXT |
| created_at / updated_at | TIMESTAMPTZ |

### Configuration Tables

#### app_settings
| Column | Type | Description |
|--------|------|------------|
| id | INTEGER | PK (singleton, row=1) |
| site_name | TEXT | |
| logo_base64 / favicon_base64 | TEXT | |
| color_primary / color_secondary / color_accent | TEXT | Hex colors |
| color_background / color_surface | TEXT | |
| color_text_primary / color_text_secondary | TEXT | |
| color_success / color_error | TEXT | |
| font_primary / font_secondary | TEXT | Google Fonts |
| footer_text | TEXT | |
| footer_links | JSONB | Array of {label, url} |
| email_from_name / email_from_address | TEXT | |
| updated_at / updated_by | TIMESTAMPTZ/INTEGER | |

#### rate_limit_configs
| Column | Type | Description |
|--------|------|------------|
| id | INTEGER | PK (singleton, row=1) |
| window_ms | INTEGER | Default: 900000 (15 min) |
| general_max | INTEGER | Default: 100 |
| auth_max | INTEGER | Default: 5 |
| register_max / register_window_ms | INTEGER | |
| protected_max | INTEGER | Default: 60 |
| scraper_max | INTEGER | Default: 10 |
| public_max | INTEGER | Default: 100 |
| health_max / health_window_ms | INTEGER | |
| updated_at / updated_by / environment | TIMESTAMPTZ/INTEGER/TEXT | |

#### rate_limit_audit_log
| Column | Type |
|--------|------|
| id | SERIAL PK |
| changed_at | TIMESTAMPTZ |
| changed_by / changed_by_username / changed_by_role | INTEGER/TEXT/TEXT |
| field_name | TEXT |
| old_value / new_value | TEXT |
| user_ip / user_agent | TEXT |

#### schema_migrations
| Column | Type | Description |
|--------|------|------------|
| version | TEXT | PK (e.g. '001_neutralize_references') |
| checksum | TEXT | SHA-256 of migration file |
| applied_at | TIMESTAMPTZ | |

## Database Relationships
```
users ──→ roles ──→ role_permissions ←── permissions
                          ↓
              permission_category_labels

theaters ──→ showtimes ←── movies
  │              ↓
  │         weekly_programs
  │
  └──→ scrape_attempts ──→ scrape_reports
  └──→ scrape_schedules

app_settings (singleton)
rate_limit_configs (singleton) → rate_limit_audit_log
schema_migrations (ledger)
```
