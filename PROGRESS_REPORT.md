# Allo-Scrapper Migration Progress Report

**Date:** February 15, 2026  
**Project:** Migration from Astro Static Site to React + Express Full-Stack App  
**Status:** Phase 1 Complete, Phase 2 50% Complete

---

## 🎯 Project Goals

Migrate the Allociné cinema showtime aggregator from a static Astro site to a dynamic full-stack application with:
- **Backend:** Express.js API + integrated scraper service
- **Frontend:** React + Vite + TailwindCSS (SPA)
- **Database:** PostgreSQL (already configured)
- **Infrastructure:** Docker containers (web + db)
- **New Features:** Manual scraping button + automatic cron job scraping

---

## ✅ Completed Work

### Phase 1: Backend Express Setup (100% Complete)

#### 1. Project Structure
```
server/
├── src/
│   ├── db/                     # Database layer
│   │   ├── client.ts           # PostgreSQL connection pool
│   │   ├── schema.ts           # Extended with scrape_reports table
│   │   └── queries.ts          # All DB queries + report queries
│   ├── routes/                 # API endpoints
│   │   ├── films.ts            # GET /api/films, /api/films/:id
│   │   ├── cinemas.ts          # GET /api/cinemas, /api/cinemas/:id
│   │   ├── scraper.ts          # POST /api/scraper/trigger, GET /api/scraper/status, GET /api/scraper/progress (SSE)
│   │   └── reports.ts          # GET /api/reports, /api/reports/:id
│   ├── services/
│   │   ├── scraper/            # Scraping logic with progress tracking
│   │   │   ├── index.ts        # Main scraper with progress events
│   │   │   ├── allocine-client.ts
│   │   │   ├── theater-parser.ts
│   │   │   └── film-parser.ts
│   │   ├── progress-tracker.ts # SSE event manager
│   │   ├── scrape-manager.ts   # Singleton scrape state manager
│   │   └── cron.ts             # Cron job scheduler
│   ├── types/
│   │   ├── scraper.ts          # Scraper types
│   │   └── api.ts              # API response types
│   ├── utils/
│   │   └── date.ts             # Date utilities
│   ├── config/
│   │   └── cinemas.json        # Cinema configuration
│   ├── app.ts                  # Express app configuration
│   └── index.ts                # Entry point
├── package.json
└── tsconfig.json
```

#### 2. Database Schema Extension
- **New table:** `scrape_reports` with JSONB columns for errors and progress logs
- **Indexes:** Optimized for querying by status and date
- **Retention:** Keep all reports forever (as requested)

#### 3. API Endpoints Implemented

**Films:**
- `GET /api/films` - List weekly films with cinemas
- `GET /api/films/:id` - Film details

**Cinemas:**
- `GET /api/cinemas` - List all cinemas
- `GET /api/cinemas/:id` - Cinema weekly schedule

**Scraper:**
- `POST /api/scraper/trigger` - Start manual scrape (409 if already running)
- `GET /api/scraper/status` - Current scrape status
- `GET /api/scraper/progress` - SSE endpoint for real-time progress

**Reports:**
- `GET /api/reports` - Paginated list with filters (status, triggerType)
- `GET /api/reports/:id` - Detailed report with errors

#### 4. Features Implemented

✅ **Progress Tracking:**
- Server-Sent Events (SSE) for real-time updates
- Granular events: per-cinema AND per-film (as requested)
- Heartbeat to keep connections alive
- Events stored in database for historical analysis

✅ **Scrape Management:**
- Singleton scrape manager prevents concurrent scrapes
- Returns 409 Conflict if scrape already running
- Tracks session state (reportId, triggerType, startedAt)

✅ **Error Handling:**
- All errors logged to database with cinema context
- Progress log stored as JSONB for debugging
- Partial success status when some cinemas fail

✅ **Cron Job:**
- Schedule: Every Wednesday at 8:00 AM
- Timezone: Europe/Paris (as requested)
- Graceful shutdown handling
- Prevents overlap with manual scrapes

✅ **Production Ready:**
- Serves React static files in production mode
- CORS enabled for development
- Helmet security headers
- Morgan logging
- Graceful shutdown on SIGTERM/SIGINT

#### 5. Dependencies Installed
- express, cors, helmet, morgan
- node-cron (for scheduling)
- pg (PostgreSQL driver)
- cheerio (HTML parsing)
- dotenv (environment variables)
- TypeScript + all type definitions

---

### Phase 2: Frontend React Setup (50% Complete)

#### 1. Project Initialized
- Vite + React + TypeScript
- TailwindCSS configured with custom Allociné colors
- Dependencies installed (react-router-dom, axios, clsx)

#### 2. API Layer Created
- **client.ts:** Axios instance with all API methods
- **useScrapeProgress.ts:** Custom hook for SSE subscription
- **types/index.ts:** Complete TypeScript definitions

#### 3. Remaining Frontend Work
❌ React components (FilmCard, ShowtimeList, Layout)
❌ Pages (Home, Cinema, Film, Reports)
❌ ScrapeButton + ScrapeProgress components
❌ React Router setup
❌ Main App.tsx with routing

---

## 🚧 Next Steps

### Immediate Priority: Docker Setup & Backend Testing

1. **Create .env.example** with all required variables
2. **Update docker-compose.yml** for new architecture
3. **Create multi-stage Dockerfile** (build server → production)
4. **Test backend independently:**
   - Start PostgreSQL container
   - Run migrations
   - Start Express server
   - Test API endpoints with curl/Postman
   - Test manual scrape trigger
   - Test SSE progress stream
   - Verify cron job schedule

### After Backend Validation

5. **Complete React frontend** (remaining 50%)
6. **Test full stack integration**
7. **Final Docker deployment test**

---

## 📊 Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Scrape Concurrency** | No concurrent scrapes | Simpler, avoids resource contention |
| **Progress Granularity** | Both cinema + film level | Maximum user visibility |
| **Report Retention** | Keep forever | Full historical data |
| **Authentication** | None (open) | Simplify initial launch |
| **Real-time Communication** | Server-Sent Events | Native browser support, simple |
| **Cron Timezone** | Europe/Paris | Cinema data is France-specific |

---

## 🔧 Configuration Required

### Environment Variables Needed
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=allo_scrapper
DB_USER=postgres
DB_PASSWORD=postgres

# Server
NODE_ENV=development
PORT=3000
TZ=Europe/Paris

# Optional
SCRAPE_CRON_SCHEDULE=0 8 * * 3
SCRAPE_DELAY_MS=1000
```

---

## 📝 Testing Checklist

### Backend API Tests
- [ ] Health check: `GET /api/health`
- [ ] Get films: `GET /api/films`
- [ ] Get cinemas: `GET /api/cinemas`
- [ ] Trigger scrape: `POST /api/scraper/trigger`
- [ ] Check scrape status: `GET /api/scraper/status`
- [ ] Subscribe to progress: `GET /api/scraper/progress` (SSE)
- [ ] List reports: `GET /api/reports`
- [ ] Test 409 conflict on duplicate scrape
- [ ] Test error logging in database
- [ ] Verify cron job registration (logs)

### Database Tests
- [ ] Schema created successfully
- [ ] Scrape reports table exists
- [ ] Indexes created
- [ ] JSONB columns working

### Integration Tests
- [ ] Full scrape cycle (manual trigger)
- [ ] Progress events received in correct order
- [ ] Errors logged to database
- [ ] Report created with summary
- [ ] Cron job can trigger scrape

---

## 📈 Estimated Completion

- **Backend Testing:** ~1 hour
- **Complete Frontend:** ~3-4 hours
- **Final Integration:** ~1 hour
- **Total Remaining:** ~5-6 hours

---

## 🎯 Success Criteria

✅ Express server runs and serves API endpoints  
✅ Database schema migrated  
✅ Scraper works with progress tracking  
✅ Cron job scheduled correctly  
✅ SSE streaming functional  
⬜ React frontend consumes API  
⬜ Manual scrape button works  
⬜ Progress displayed in real-time  
⬜ Reports page shows history  
⬜ Docker deployment successful  

---

**Next Action:** Proceed with Docker setup and backend testing.
