# Refactor: Replace Brand-Specific References with Neutral Terminology

## 🎯 Objective

Remove all brand-specific references (Allociné) from the codebase and replace them with neutral terminology to improve code maintainability, reusability, and professionalism.

## 📦 Changes Summary

### Database & Configuration
- **Database name**: `allocine` → `cinema_showtimes` 
- **Column name**: `allocine_url` → `source_url`
- Updated in all Docker Compose files (production, dev, build)
- Updated in `.env.example`

### Code Refactoring
- **File renamed**: `allocine-client.ts` → `http-client.ts`
- Updated all imports to reference the renamed file
- Updated TypeScript type definitions
- Neutralized comments and documentation strings

### Documentation
- **README.md**: Replaced "Allociné" with "source website" / "external provider"
- **DEPLOYMENT.md**: Updated all database references to `cinema_showtimes`
- **package.json**: Removed brand-specific keywords
- Updated example URLs to use generic placeholders

### Type System Updates
```typescript
// Before
interface Film {
  allocine_url: string;
}

// After
interface Film {
  source_url: string;
}
```

## 🔧 Files Modified

| Category | Files | Changes |
|----------|-------|---------|
| Configuration | `.env.example`, `docker-compose*.yml` (3 files) | Database name updated |
| Database | `server/src/db/schema.ts`, `server/src/db/queries.ts` | Column name changed |
| Code | `server/src/services/scraper/*.ts` (3 files) | File renamed, types updated |
| Types | `server/src/types/scraper.ts` | Interface properties renamed |
| Documentation | `README.md`, `DEPLOYMENT.md`, `package.json` | Brand references removed |

**Total**: 13 files changed, 68 insertions(+), 68 deletions(-)

## ⚠️ Breaking Changes

### Database Schema Change

**Column renamed in `films` table:**
```sql
-- Before
CREATE TABLE films (
  ...
  allocine_url TEXT NOT NULL
);

-- After
CREATE TABLE films (
  ...
  source_url TEXT NOT NULL
);
```

**Database name change:**
```env
# Before
POSTGRES_DB=allocine

# After
POSTGRES_DB=cinema_showtimes
```

## 🔄 Migration Guide

### For New Deployments
✅ No action needed - use the latest version directly

### For Existing Deployments

#### Option A: Fresh Start (Recommended for Development)
```bash
# Stop and remove all containers and volumes
docker compose down -v

# Pull latest changes
git pull

# Update .env file
sed -i 's/POSTGRES_DB=allocine/POSTGRES_DB=cinema_showtimes/' .env

# Start with new database
docker compose up -d
docker compose exec web npm run db:migrate

# Re-scrape data
curl -X POST http://localhost:3000/api/scraper/trigger
```

#### Option B: Migrate Existing Data (For Production)

**Step 1: Backup existing database**
```bash
./scripts/backup-db.sh
# Creates backup in backups/ directory
```

**Step 2: Create migration SQL script**
```sql
-- Save as migration-neutralize-v2.0.1.sql

-- Rename column
ALTER TABLE films RENAME COLUMN allocine_url TO source_url;

-- Optionally rename database (requires reconnection)
-- CREATE DATABASE cinema_showtimes WITH TEMPLATE allocine OWNER postgres;
-- Then update .env and restart services
```

**Step 3: Apply migration**
```bash
# Update .env file
nano .env  # Change POSTGRES_DB=allocine to POSTGRES_DB=cinema_showtimes

# Apply column rename only (no database rename)
docker compose exec db psql -U postgres -d allocine -f migration-neutralize-v2.0.1.sql

# OR for full database rename:
# 1. Backup: docker compose exec -T db pg_dump -U postgres allocine > backup.sql
# 2. Create new DB: docker compose exec db psql -U postgres -c "CREATE DATABASE cinema_showtimes;"
# 3. Restore: docker compose exec -T db psql -U postgres cinema_showtimes < backup.sql
# 4. Apply column rename
# 5. Update .env and restart
```

**Step 4: Restart services**
```bash
docker compose restart web
```

## 🧪 Testing & Verification

### Build Verification
✅ TypeScript compilation successful
```bash
cd server && npm run build
# ✓ No errors
```

### Manual Testing Checklist
- [ ] Database schema applied successfully
- [ ] API endpoints respond correctly
- [ ] Film data includes `source_url` field
- [ ] Scraper runs without errors
- [ ] Frontend displays cinema/film data correctly

### Test Commands
```bash
# Health check
curl http://localhost:3000/api/health

# Verify database schema
docker compose exec db psql -U postgres -d cinema_showtimes -c "\d films"

# Check data structure
curl http://localhost:3000/api/films | jq '.[0]' | grep source_url
```

## 📝 Technical Notes

### URLs Preserved
The following URLs remain unchanged as they are functional requirements:
- `http-client.ts`: Source website URLs (required for scraping)
- `server/src/config/cinemas.json`: Cinema URLs (configuration data)

### TypeScript Changes
All type definitions updated to reflect new property names:
- `allocine_url` → `source_url` in all interfaces
- Updated JSDoc comments to use neutral terminology
- No changes to business logic or functionality

### Backward Compatibility
⚠️ **Not backward compatible** - requires database migration

## 🎁 Benefits

- ✅ **More generic codebase**: Easier to adapt to other data sources
- ✅ **Improved professionalism**: Neutral terminology throughout
- ✅ **Better maintainability**: Clear separation of concerns
- ✅ **Documentation clarity**: No brand confusion in public docs
- ✅ **Reusability**: Code can be forked for other cinema sites

## 📋 Checklist

- [x] All brand-specific references removed from public documentation
- [x] Database schema updated
- [x] Type definitions updated
- [x] All imports updated
- [x] Build successful
- [x] `.env.example` updated
- [x] Migration guide provided
- [x] Breaking changes documented

## 🔗 Related

- Previous PR: #26 (Configure Docker Compose to use GitHub Container Registry)
- Issue: N/A (proactive refactoring)

## 📸 Screenshots

### Before
```typescript
interface Film {
  allocine_url: string; // Allociné film page URL
}
```

### After
```typescript
interface Film {
  source_url: string; // Source website URL
}
```

---

## ⚡ Quick Merge Checklist

For reviewers:
- [ ] Review breaking changes
- [ ] Verify migration guide completeness
- [ ] Check that functional URLs are preserved
- [ ] Confirm TypeScript build passes
- [ ] Approve database name changes

**Recommended**: Merge during maintenance window due to database schema changes.
