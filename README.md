# 🎬 Allo-Scrapper

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Cinema showtimes aggregator** that scrapes and centralizes movie screening schedules from the source website cinema pages. Built with Express.js, React, and PostgreSQL, fully containerized with Docker.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [White-Label Branding](#-white-label-branding)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## ✨ Features

- **Automated Scraping**: Scheduled scraping of cinema showtimes from the source website
- **RESTful API**: Complete Express.js backend with TypeScript
- **Modern UI**: React SPA with Vite for fast development
- **Real-time Progress**: Server-Sent Events (SSE) for live scraping updates
- **Weekly Reports**: Track cinema programs and identify new releases
- **White-Label Branding**: Complete customization (site name, logo, colors, fonts, footer) via admin panel
- **User Management**: Role-based access control (admin/user) with comprehensive user CRUD
- **JWT Authentication**: Secure user authentication with token-based sessions
- **Password Management**: Change password functionality for authenticated users
- **Rate Limiting**: Comprehensive rate limiting per endpoint type (auth, public, protected)
- **Docker Ready**: Full containerization with multi-stage builds (linux/amd64)
- **CI/CD**: GitHub Actions workflow for automated Docker image builds
- **Redis Job Queue**: Scraper microservice mode via Redis pub/sub (`USE_REDIS_SCRAPER=true`)
- **Observability**: Prometheus metrics, Grafana dashboards, Loki log aggregation, Tempo distributed tracing
- **Production Ready**: Health checks, error handling, and database migrations

---

## 🏗 Architecture

```
┌─────────────────┐
│   React SPA     │  Port 80 (production) / 5173 (dev)
│   (Vite + TS)   │
└────────┬────────┘
         │ HTTP API / SSE
         ▼
┌─────────────────┐    Redis pub/sub    ┌───────────────────┐
│  Express.js API │◄───────────────────►│ Scraper           │
│  (TypeScript)   │   scrape:jobs queue │ Microservice      │
│                 │───────────────────►│ (ics-scraper)     │
│  feature flag:  │                    │                   │
│  USE_REDIS_     │    (legacy mode)   │  ┌─────────────┐  │
│  SCRAPER=false  │◄───in-process──────┤  │ Cron        │  │
│  → in-process   │                    │  │ (ics-scraper│  │
│  SCRAPER=true   │                    │  │  -cron)     │  │
│  → Redis queue  │                    │  └─────────────┘  │
└────────┬────────┘                    └────────┬──────────┘
         │ SQL                                  │ SQL
         └──────────────────┬───────────────────┘
                            ▼
              ┌─────────────────────────┐
              │   PostgreSQL  Port 5432 │
              │  cinemas / films /      │
              │  showtimes / reports    │
              └─────────────────────────┘

              ┌─────────────────────────┐
              │   Redis  (in-memory)    │  Message queue + pub/sub
              └─────────────────────────┘

  Monitoring (--profile monitoring):
  Prometheus :9090 → Grafana :3001
  Loki + Promtail (logs) → Grafana
  Tempo :3200 (traces, OTLP :4317) → Grafana
```

**Data Flow:**
1. Client makes HTTP requests to Express API (`/api/*`)
2. API routes handle business logic and validate requests
3. Scraper fetches data from the source website — either in-process (default) or via a Redis job queue (`USE_REDIS_SCRAPER=true`)
4. Progress events flow back to the API via Redis pub/sub → SSE → client
5. PostgreSQL stores structured cinema, film, and showtime data
6. Client receives JSON responses and renders UI

> See [MONITORING.md](./MONITORING.md) for the full observability stack documentation.

---

## 🎨 White-Label Branding

Allo-Scrapper supports complete white-label customization through a comprehensive admin panel. Transform the application to match your brand identity with custom colors, fonts, logo, and more.

### Admin Panel Access

1. Navigate to `/admin/settings` (requires admin role)
2. **Default credentials:**
   - Username: `admin`
   - Password: `admin`

⚠️ **Important:** Change the default admin password immediately after first login (click your username → "Change Password").

### Customization Options

The admin panel provides five tabs for complete branding control:

#### 1. General Settings
- **Site Name**: Displayed in header, page title, and footer
- **Logo**: Custom logo image (PNG/JPG/SVG, max 200KB, min 100x100px)
- **Favicon**: Browser tab icon (ICO/PNG, max 50KB, 32x32 or 64x64px)

#### 2. Color Scheme
Customize 9 color variables with live preview:
- **Primary**: Main brand color (buttons, links, highlights)
- **Secondary**: Header, footer background
- **Accent**: Call-to-action elements
- **Background**: Page background
- **Surface**: Card backgrounds
- **Text Primary**: Main text color
- **Text Secondary**: Muted text (labels, captions)
- **Success**: Success messages and indicators
- **Error**: Error messages and alerts

All colors must be valid hex codes (e.g., `#FECC00`, `#1F2937`, `#FFF`).

#### 3. Typography
- **Heading Font**: Choose from 15+ Google Fonts for headings (h1-h6)
- **Body Font**: Choose font for body text and UI elements
- **Live Preview**: See font changes in real-time

**Available Google Fonts:**
Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, Nunito, PT Sans, Source Sans Pro, Work Sans, Archivo, Manrope, DM Sans, Plus Jakarta Sans

#### 4. Footer Customization
- **Footer Text**: Custom message with dynamic placeholders:
  - `{site_name}` → Site name from General settings
  - `{year}` → Current year
- **Footer Links**: Add unlimited custom links (e.g., Privacy Policy, Contact, About)
  - Each link: Label + URL
  - Drag to reorder

#### 5. Email Branding
- **From Name**: Sender name for system emails
- **From Address**: Sender email address
- **Header Color**: Email template header background
- **Footer Text**: Email template footer message

### Configuration Management

**Export Settings** (backup):
```bash
# Using admin panel: Click "Export Configuration" button

# Using API:
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/settings/export > settings-backup.json
```

**Import Settings** (restore from backup):
```bash
# Using admin panel: Click "Import Configuration" button and select JSON file

# Using API:
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @settings-backup.json \
  http://localhost:3000/api/settings/import
```

**Reset to Defaults**:
- Click "Reset to Defaults" button in admin panel
- Restores original Allo-Scrapper branding

### User Role Management

The system supports two roles:

| Role | Permissions |
|------|-------------|
| **admin** | Full access: Settings, user management, reports, scraping control |
| **user** | Limited access: View cinema schedules only |

**Safety Features:**
- Cannot delete the last admin user
- Cannot demote the last admin to user role
- Admin authentication required to create new users
- Self-deletion prevention

**Managing Users** (admin only):
1. Navigate to `/admin/users`
2. Create, edit, delete users
3. Change user roles
4. Reset user passwords (generates secure random password)

### API Access

Settings and user management are available via REST API:

- **Settings API**: `/api/settings/*` - See [API.md](./API.md#settings-management)
- **Users API**: `/api/users/*` - See [API.md](./API.md#user-management)
- **Theme CSS**: `/api/theme.css` - Dynamically generated CSS with theme variables

For complete API documentation, see [API.md](./API.md).

### Best Practices

1. **Backup before major changes**: Use export feature before making significant branding changes
2. **Test in staging first**: If using multi-environment setup
3. **Use high contrast colors**: Ensure accessibility (WCAG AA minimum)
4. **Optimize images**: Compress logo/favicon before upload to stay under size limits
5. **Change default password**: Critical security step for production deployments
6. **Create backup admin**: Have at least 2 admin users before deleting/demoting accounts

### Troubleshooting

**Images not uploading:**
- Check file size (Logo: 200KB max, Favicon: 50KB max)
- Verify format (PNG, JPG, SVG for logo; ICO, PNG for favicon)
- Ensure dimensions meet minimums (Logo: 100x100px+, Favicon: 32x32 or 64x64)

**Settings not saving:**
- Check browser console for error messages
- Verify JWT token is valid (try logging out and back in)
- Check network tab for API errors

**Theme not applying:**
- Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache
- Check `/api/theme.css` endpoint directly

For detailed user guide and screenshots, see [ADMIN_PANEL.md](./ADMIN_PANEL.md).

---

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000 and 5432 available

### Option A: Using Pre-built Images (Recommended)

The easiest way to deploy is using pre-built Docker images from GitHub Container Registry.

```bash
# Clone the repository (for configuration files)
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Pull the latest image and start services
docker compose up -d

# Initialize database (runs automatically on first startup)
docker compose exec ics-web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

**Access the application:**
- Web UI: http://localhost:3000
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

**Update to latest version:**
```bash
docker compose pull ics-web
docker compose up -d
```

### Option B: Building Locally

If you want to build the Docker image from source:

```bash
# Clone the repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Build and start services
docker compose up --build -d

# Initialize database
docker compose exec ics-web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

For production deployment and advanced configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [DOCKER.md](./DOCKER.md).

---

## ⚙️ Configuration

### Frontend Build Configuration

The frontend application name can be customized via Docker build arguments:

| Variable | Description | Default | Used By |
|----------|-------------|---------|---------|
| `VITE_APP_NAME` | Application name (browser tab, header, footer) | `Allo-Scrapper` | Docker build, GitHub Actions |

**Local Development:**
```bash
# In .env file (root directory)
VITE_APP_NAME=Allo-Scrapper

# Run Vite dev server (reads from .env at runtime)
cd client
npm run dev
```

**Docker Build:**
```bash
# Using docker-compose.yml (reads from .env file)
docker compose build

# Manual build with custom name
docker build --build-arg VITE_APP_NAME="My Cinema App" .
```

**GitHub Actions:**
The app name is set in `.github/workflows/docker-build-push.yml` as a build argument. All images built by CI/CD (develop, main, PR) use the configured name.

For complete environment variable documentation, see [SETUP.md](./SETUP.md).

### Dynamic White-Label Theme

The application supports **runtime theme customization** via the admin panel, allowing you to change branding, colors, fonts, and footer without rebuilding the Docker image.

**Features:**
- ✅ **Site Name & Logo** - Customize the site name and upload a custom logo
- ✅ **Favicon** - Upload a custom favicon
- ✅ **Color Palette** - Customize primary, secondary, accent, and UI colors
- ✅ **Typography** - Choose custom fonts from Google Fonts
- ✅ **Footer** - Custom footer text and links

**How It Works:**
1. Admin logs in and navigates to `/admin/settings`
2. Customizes branding in the admin panel (5 tabs: General, Colors, Typography, Footer, Email)
3. Changes apply **immediately** via `/api/theme.css` dynamic stylesheet
4. Settings stored in database (`app_settings` table)
5. Changes persist across container restarts

**Loading Strategy:**
- App shows loading screen while fetching settings from `/api/settings`
- Theme.css is injected dynamically via `useTheme` hook
- Hardcoded defaults used if API fails (graceful degradation)
- Logo, favicon, and document title update dynamically

**For Admin Panel Documentation:**
See [API.md](./API.md) for Settings API reference (`/api/settings/*` endpoints).

---

## 📚 Documentation

**📖 [Browse Full Documentation →](./docs/)**

Our documentation is organized into the following categories:

### 🚀 [Getting Started](./docs/getting-started/)
New to Allo-Scrapper? Start here for quick setup and configuration.
- [Quick Start](./docs/getting-started/quick-start.md) - Get running in 5 minutes
- [Installation](./docs/getting-started/installation.md) - Detailed setup instructions
- [Configuration](./docs/getting-started/configuration.md) - Environment variables

### 📖 [Guides](./docs/guides/)
Step-by-step tutorials for common tasks.
- [**Deployment**](./docs/guides/deployment/) - Production deployment, Docker, backups, monitoring
- [**Development**](./docs/guides/development/) - Local setup, testing, contributing, CI/CD
- [**Administration**](./docs/guides/administration/) - Admin panel, white-label, user management

### 📋 [Reference](./docs/reference/)
Technical reference documentation.
- [**API**](./docs/reference/api/) - Complete REST API documentation
- [**Database**](./docs/reference/database/) - Schema and migrations
- [**Scripts**](./docs/reference/scripts/) - Automation scripts
- [**Architecture**](./docs/reference/architecture/) - System design

### 🔧 [Troubleshooting](./docs/troubleshooting/)
Solutions to common issues.
- [Common Issues](./docs/troubleshooting/common-issues.md)
- [Database](./docs/troubleshooting/database.md) | [Docker](./docs/troubleshooting/docker.md) | [Networking](./docs/troubleshooting/networking.md) | [Scraper](./docs/troubleshooting/scraper.md)

### 📦 [Project](./docs/project/)
Project meta-documentation.
- [Changelog](./docs/project/changelog.md) - Version history
- [Security](./docs/project/security.md) - Security policies
- [AI Agents](./docs/project/agents.md) - Guidelines for AI coding agents

**Legacy documentation** (root-level `.md` files) will be migrated to `/docs/` in future releases. For now, both locations are maintained for backward compatibility

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code of Conduct
- Development workflow (Issue → Branch → TDD → PR)
- Coding standards
- Commit message conventions (Conventional Commits)
- Testing requirements

For AI coding agents, see [AGENTS.md](./AGENTS.md) for mandatory workflow and TDD requirements.

**Quick contribution checklist:**
1. Create an issue first (bug/feature/task)
2. Create a feature branch from `develop`
3. Write tests before implementation (TDD)
4. Follow Conventional Commits format
5. Ensure all tests pass and Docker builds
6. Create PR referencing the issue
7. Wait for review before merging

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/PhBassin/allo-scrapper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PhBassin/allo-scrapper/discussions)
- **Documentation**: See [Documentation](#-documentation) section above

---

**Made with ❤️ for cinema enthusiasts**
