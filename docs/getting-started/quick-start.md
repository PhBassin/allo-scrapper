# Quick Start

Get Allo-Scrapper up and running in 5 minutes using Docker Compose.

## Prerequisites

- **Docker Desktop** or Docker Engine + Docker Compose
- **Git** (to clone the repository)

That's it! No need to install Node.js, PostgreSQL, or any other dependencies.

---

## 🚀 Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# (Optional) Edit .env if you want to customize settings
# The defaults work out of the box for local development
```

### 3. Start All Services

```bash
npm run dev
```

This command starts:
- **PostgreSQL database** (port 5432)
- **Express API server** (port 3000) with hot-reload
- **React client dev server** (port 5173) with Vite HMR

**First startup takes ~1 minute** to pull images and initialize the database.

### 4. Access the Application

Open your browser to:

**http://localhost:5173**

You should see the Allo-Scrapper interface.

---

## ✅ Verify Installation

### Check API Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-01T20:00:00.000Z",
    "database": "connected"
  }
}
```

### View Running Services

```bash
docker compose ps
```

You should see:
- `ics-db` - PostgreSQL (healthy)
- `ics-web` - API server (healthy)
- `ics-client` - React dev server (healthy)

---

## 🎬 Trigger Your First Scrape

### Option 1: Using the Web Interface

1. Navigate to **http://localhost:5173**
2. Click the **"Start Scrape"** button
3. Watch real-time progress as cinemas are scraped
4. View showtimes when complete

### Option 2: Using the API

```bash
curl -X POST http://localhost:3000/api/scraper/start
```

**Note:** The first scrape may take several minutes depending on the number of configured cinemas.

---

## 📊 View the Results

After scraping completes:

### Web Interface

- **Home page**: View all cinemas and their showtime counts
- **Cinema details**: Click a cinema to see its complete schedule
- **Reports**: View statistics and aggregated data

### API

```bash
# Get all cinemas
curl http://localhost:3000/api/cinemas

# Get showtimes report
curl http://localhost:3000/api/reports/showtimes

# Get all films
curl http://localhost:3000/api/films
```

---

## 🛠️ Common Commands

### View Logs

```bash
# All services
npm run dev:logs

# Follow logs in real-time
docker compose logs -f

# Specific service only
docker compose logs -f ics-web
```

### Stop Services

```bash
npm run dev:down
```

### Restart Services

```bash
# Stop and start
npm run dev:down && npm run dev

# Or just restart web service
docker compose restart ics-web
```

### Clean Restart (Reset Database)

```bash
npm run dev:down
docker compose down -v  # Remove volumes (deletes database data)
npm run dev
```

---

## 🔧 Customization

### Add Your Own Cinemas

Edit the cinema configuration file:

```bash
# File: server/src/config/cinemas.json
nano server/src/config/cinemas.json
```

Add a cinema entry:
```json
{
  "id": "C0001",
  "name": "My Local Cinema",
  "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0001.html"
}
```

Restart the API server:
```bash
docker compose restart ics-web
```

### Change Scrape Schedule

Edit `.env`:
```bash
# Every day at 3 AM
SCRAPE_CRON_SCHEDULE=0 3 * * *

# Every 6 hours
SCRAPE_CRON_SCHEDULE=0 */6 * * *
```

Restart services:
```bash
npm run dev:down && npm run dev
```

---

## 🐛 Troubleshooting

### Port Already in Use

If ports 3000, 5173, or 5432 are already in use, edit `.env`:

```bash
PORT=8080                    # API server
VITE_PORT=3001              # Client dev server
POSTGRES_PORT=5433          # PostgreSQL
```

### Database Connection Errors

```bash
# Check database is running
docker compose ps ics-db

# View database logs
docker compose logs ics-db

# Restart database
docker compose restart ics-db
```

### Services Not Starting

```bash
# View all logs
docker compose logs

# Check for port conflicts
docker compose down
lsof -i :3000
lsof -i :5173
lsof -i :5432
```

For more troubleshooting, see [Troubleshooting Guide](../../troubleshooting/).

---

## 📚 Next Steps

Now that you're up and running:

- **[Installation Guide](./installation.md)** - Detailed installation options (manual setup, production)
- **[Configuration Guide](./configuration.md)** - Complete environment variable reference
- **[API Reference](../../reference/api/)** - Explore the REST API
- **[Development Setup](../../guides/development/setup.md)** - Set up for development and contributing
- **[Production Deployment](../../guides/deployment/production.md)** - Deploy to production

---

## 💡 Tips

- **Hot Reload**: Code changes in `server/` and `client/` automatically reload
- **Database GUI**: Use [pgAdmin](https://www.pgadmin.org/) or [DBeaver](https://dbeaver.io/) to connect to `localhost:5432`
- **API Testing**: Use [Postman](https://www.postman.com/) or [HTTPie](https://httpie.io/) for API exploration
- **Monitoring**: Enable the monitoring stack with `docker compose --profile monitoring up -d`

---

[← Back to Getting Started](./README.md) | [Next: Installation →](./installation.md)
