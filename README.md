# 🎬 Allo-Scrapper

[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Cinema showtimes aggregator** that scrapes and centralizes movie screening schedules from the source website cinema pages. Built with Express.js, React, and PostgreSQL, fully containerized with Docker.

> **Latest Version**: 4.3.0 | **Status**: Production Ready ✅

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

- **Automated Scraping**: Scheduled scraping of cinema showtimes with bounded concurrency
- **Scraper Resilience**: Automatic HTTP 429 rate limit detection, graceful shutdown, and 15s upstream fetch timeouts
- **RESTful API**: Complete Express.js backend with TypeScript
- **Modern UI**: React SPA with Vite for fast development
- **Real-time Progress**: Server-Sent Events (SSE) for live scraping updates
- **Weekly Reports**: Track cinema programs and identify new releases
- **White-Label Branding**: Complete customization (site name, logo, colors, fonts, footer) via admin panel
- **User Management**: Role-based access control with comprehensive user CRUD
- **Role Management**: Full CRUD for custom roles with granular permission assignment via admin panel
- **JWT Authentication**: Secure user authentication with token-based sessions
- **Password Management**: Change password functionality for authenticated users
- **Content Security Policy**: Strict CSP without unsafe-inline/unsafe-eval in script-src
- **Session Expiry Handling**: Expired JWTs are invalidated client-side and protected routes redirect to login
- **Rate Limiting**: Comprehensive rate limiting per endpoint type (auth, public, protected)
- **Performance Optimized**: JSON parse caching with LRU eviction (95-99% hit rate)
- **Docker Ready**: Full containerization with multi-stage builds (linux/amd64)
- **CI/CD**: GitHub Actions workflow for automated Docker image builds
- **Scraper Microservice**: Standalone scraper service communicates with the API via Redis job queue and pub/sub
- **Observability**: Prometheus metrics, Grafana dashboards, Loki log aggregation, Tempo distributed tracing
- **Multi-Tenant SaaS Mode**: Optional multi-tenant architecture with organization isolation, usage quotas, and superadmin portal
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
│  API + frontend │────────────────────►│ (ics-scraper)     │
│  only — no      │                    │                   │
│  scraping code  │                    │  ┌─────────────┐  │
│                 │                    │  │ Cron        │  │
│                 │                    │  │ (ics-scraper│  │
│                 │                    │  │  -cron)     │  │
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
              │   Redis  (mandatory)    │  Job queue + progress pub/sub
              └─────────────────────────┘

  Monitoring (--profile monitoring):
  Prometheus :9090 → Grafana :3001
  Loki + Promtail (logs) → Grafana
  Tempo :3200 (traces, OTLP :4317) → Grafana
```

**Data Flow:**
1. Client makes HTTP requests to Express API (`/api/*`)
2. API routes handle business logic and validate requests
3. API publishes scrape jobs to Redis (`scrape:jobs` queue) — the scraper microservice picks them up
4. Scraper fetches data from the source website and writes results directly to PostgreSQL
5. Progress events flow back to the API via Redis pub/sub → SSE → client
6. PostgreSQL stores structured cinema, film, and showtime data
7. Client receives JSON responses and renders UI

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

For detailed user guide, see [Admin Panel Guide](./docs/guides/administration/admin-panel.md).

---

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000 and 5432 available
- OpenSSL installed (for JWT secret generation)
  - Linux/macOS: Pre-installed
  - Windows: Use Git Bash or WSL

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
  - Returns database connectivity status
  - Cached for 5 seconds to prevent connection pool exhaustion
  - Rate limited to 10 req/min per IP (localhost exempt for Docker/K8s probes)

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

### Option C: Local Development (No Docker)

For active development without Docker:

**Prerequisites:**
- Node.js 20.19+ or 22.12+
- PostgreSQL 15+
- Redis (required for scraping operations)

**Setup:**
```bash
# Clone repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Install server dependencies (IMPORTANT: run from server/ directory)
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Setup environment and database
cd ../server
cp .env.example .env

# Generate a secure JWT secret (REQUIRED)
openssl rand -base64 64

# Edit .env with your PostgreSQL, Redis credentials, and paste the JWT secret
# JWT_SECRET=<paste-generated-secret-here>
npm run db:migrate

# Start Redis (required — scraping will not work without it)
# e.g. via Docker: docker run -d -p 6379:6379 redis:7-alpine

# Run development servers (in separate terminals)
# Terminal 1 - API server
cd server && npm run dev    # API on http://localhost:3000

# Terminal 2 - Frontend dev server
cd client && npm run dev    # UI on http://localhost:5173

# Terminal 3 - Scraper microservice (for scraping to work locally)
cd scraper && npm run dev
```

**⚠️ Important:** Always run `npm install` from the `server/` directory, not the root. The `sharp` image processing library requires native binaries that may not install correctly if run from the wrong directory.

**Troubleshooting:**
If you encounter `Cannot find package 'sharp'` errors:
```bash
cd server
rm -rf node_modules
npm install
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

## 🛡️ Rate Limiting

The application includes comprehensive rate limiting to protect against abuse and ensure fair usage. Rate limits can be configured dynamically through the admin interface without server restarts.

### Default Rate Limits

| Endpoint Type | Default Limit | Window | Description |
|--------------|---------------|--------|-------------|
| General API | 100 requests | 15 min | All `/api/*` routes |
| Authentication | 5 attempts | 15 min | Login endpoint (failed attempts only) |
| Registration | 3 attempts | 1 hour | New user registration |
| Protected Endpoints | 60 requests | 15 min | Authenticated user endpoints |
| Scraper Endpoints | 10 requests | 15 min | Expensive scraping operations |
| Public Endpoints | 100 requests | 15 min | Public read endpoints (cinemas, films) |
| Health Check | 10 requests | 1 min | `/api/health` endpoint (localhost exempt) |

### Dynamic Configuration

Rate limits can be managed through the admin interface:

1. Navigate to `/admin?tab=ratelimits` (admin-only)
2. Adjust limits based on your needs
3. Changes take effect within 30 seconds (no restart required)
4. All changes are logged in the audit trail

**Features:**
- ✅ **Hot Reload** - Changes apply within 30 seconds via cache invalidation
- ✅ **Audit Trail** - Complete history of all changes with user attribution
- ✅ **Validation** - Enforced min/max constraints prevent misconfiguration
- ✅ **Backward Compatible** - Falls back to environment variables if database unavailable
- ✅ **Permission-Based** - Granular permissions (read/update/reset/audit)

### Environment Variables (Optional)

Rate limits can also be configured via environment variables (lower priority than database):

```bash
# Global window (milliseconds, 1 min to 1 hour)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Per-endpoint limits (requests per window)
RATE_LIMIT_GENERAL_MAX=100
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_PROTECTED_MAX=60
RATE_LIMIT_SCRAPER_MAX=10
RATE_LIMIT_PUBLIC_MAX=100
RATE_LIMIT_HEALTH_MAX=10

# Registration window (milliseconds, 5 min to 24 hours)
RATE_LIMIT_REGISTER_WINDOW_MS=3600000  # 1 hour
```

**Priority Order:**
1. Database configuration (managed via admin UI)
2. Environment variables (fallback)
3. Default values (hard-coded)

### Key Features

**Authenticated User Bucketing:**
- Protected and scraper endpoints bucket by user ID (from JWT)
- Prevents a single user from exhausting rate limits for all users
- Falls back to IP-based bucketing for unauthenticated requests

**Health Check Protection:**
- Aggressive rate limiting (10 req/min) prevents resource exhaustion
- Localhost/Docker/Kubernetes IPs automatically exempted
- Response caching (5 seconds) reduces database load

**Smart Skip Logic:**
- Rate limiting automatically disabled in test environment
- Successful login attempts don't count toward auth limit

For API documentation, see [API.md](./API.md#rate-limits).

---

## 🏢 Multi-Tenant SaaS Mode (Optional)

Allo-Scrapper can be deployed as a **multi-tenant SaaS platform** with organization isolation, usage quotas, and centralized management.

### Enabling SaaS Mode

```bash
# .env configuration
SAAS_ENABLED=true
VITE_SAAS_ENABLED=true
```

### Key Features

**Multi-Tenancy:**
- **Schema-per-organization**: Each organization has a dedicated PostgreSQL schema
- **Complete data isolation**: Organizations cannot access each other's data
- **Custom domain support**: Organizations can use custom domains (e.g., `mycinema.example.com`)

**Self-Service Onboarding:**
- Organizations register via `/register` page
- Automatic schema provisioning and trial activation
- Email verification and invitation system

**Usage Quotas:**
- Configurable limits per plan (cinemas, users, scraping frequency)
- Automatic quota enforcement in all endpoints
- Real-time usage tracking

**Superadmin Portal:**
- Centralized management dashboard at `/superadmin`
- Organization lifecycle management (suspend/reactivate)
- Usage analytics and audit trail
- Impersonation for support troubleshooting

### Superadmin Portal

**Access:** Navigate to `/superadmin/login`

**Default Credentials:**
```
Username: superadmin
Password: changeme
```

⚠️ **CRITICAL:** Change the default superadmin password immediately after first login.

**Features:**

1. **Dashboard** - Real-time metrics:
   - Total organizations by status (trial/active/suspended/canceled)
   - Total users across all organizations
   - Active scraping operations
   - Revenue metrics (when billing enabled)

2. **Organization Management** - Full lifecycle control:
   - View all organizations with search/filter
   - Suspend/reactivate organizations
   - Change organization plans
   - Reset trial periods
   - View usage statistics (cinemas, users, reports)

3. **Audit Trail** - Complete activity log:
   - All superadmin actions logged with timestamps
   - User attribution for compliance
   - Searchable and filterable

4. **Impersonation** - Temporary access for support:
   - Generate 1-hour temporary access token
   - Troubleshoot issues as the organization admin
   - All impersonation actions logged

**API Endpoints:**

```bash
# Authentication
POST /api/superadmin/login
{
  "username": "superadmin",
  "password": "changeme"
}

# Dashboard metrics
GET /api/superadmin/dashboard
Authorization: Bearer <superadmin-token>

# Organization list (paginated, searchable)
GET /api/superadmin/orgs?page=1&limit=20&search=cinema&status=active
Authorization: Bearer <superadmin-token>

# Organization details
GET /api/superadmin/orgs/:id
Authorization: Bearer <superadmin-token>

# Lifecycle management
POST /api/superadmin/orgs/:id/suspend
POST /api/superadmin/orgs/:id/reactivate
PUT /api/superadmin/orgs/:id/plan
POST /api/superadmin/orgs/:id/reset-trial
Authorization: Bearer <superadmin-token>

# Impersonation
POST /api/superadmin/impersonate
{
  "orgId": 123,
  "reason": "Support ticket #456 - troubleshooting scraper issue"
}
Authorization: Bearer <superadmin-token>

# Audit log (paginated)
GET /api/superadmin/audit-log?page=1&limit=50
Authorization: Bearer <superadmin-token>
```

### Organization Data Export

Organizations can export their complete data for backup or migration:

```bash
# Export endpoint (organization admin only)
GET /api/org/:slug/export
Authorization: Bearer <org-admin-token>
```

**Export Contents:**
- Organization metadata (name, plan, trial status)
- All cinemas and locations
- Last 7 days of showtimes
- Weekly reports
- Settings and customizations

**Use Cases:**
- Backup before major changes
- Migration to another instance
- Compliance with data portability requirements

### Multi-Tenant Observability

**Prometheus Metrics:**

Dedicated metrics endpoint for multi-tenant monitoring:

```bash
# Metrics endpoint (open, unauthenticated)
GET /api/saas/metrics
```

**Available Metrics:**
- `org_total_count` - Total organizations
- `org_status_count{status="active|trial|suspended|canceled"}` - Organizations by status
- `org_trial_expiring_count` - Organizations with trials expiring soon
- `org_quota_exceeded_count{resource="cinemas|users"}` - Quota violations
- `org_usage{org_slug="...", resource="cinemas|users"}` - Per-organization usage

**Grafana Dashboard:**

Pre-configured dashboards available in monitoring profile:

```bash
docker compose --profile monitoring up -d
```

- **SaaS Overview**: High-level metrics, revenue trends, trial conversions
- **Organization Drill-Down**: Per-org usage, quota status, activity
- **Superadmin Actions**: Audit trail visualization

### Security Considerations

**JWT Token Scopes:**
- Superadmin tokens include `scope: 'superadmin'` claim
- Standard organization tokens include `scope: 'user'` and `orgId`
- Impersonation tokens include `scope: 'impersonation'`, `orgId`, and `expiresIn: 1h`

**Authentication Separation:**
- Superadmin login uses dedicated `/superadmin/login` endpoint
- Uses same `JWT_SECRET` with different payload scope
- Superadmin and organization user namespaces are completely separate

**Audit Trail:**
- All superadmin actions logged to `audit_log` table
- Includes: action type, target organization, reason, timestamp, user
- Immutable log (no deletion, append-only)

**Best Practices:**
1. **Change default password** immediately after deployment
2. **Rotate superadmin credentials** regularly (quarterly minimum)
3. **Monitor audit trail** for suspicious activity
4. **Use impersonation** sparingly and always log reason
5. **Backup audit logs** to external storage for compliance

### Migration Path

**From Standalone to SaaS:**

Existing standalone deployments can migrate to SaaS mode:

1. Enable SaaS mode: `SAAS_ENABLED=true`
2. Run SaaS migrations: `npm run db:migrate`
3. Create first organization manually via API or SQL
4. Migrate existing data to organization schema
5. Update frontend environment: `VITE_SAAS_ENABLED=true`

**Backward Compatibility:**

When `SAAS_ENABLED=false`:
- Application functions exactly as before
- No SaaS routes mounted
- No multi-tenant middleware applied
- No performance impact

For complete SaaS architecture documentation, see [SAAS-PLAN.md](./SAAS-PLAN.md).

---

## 📚 Documentation

**📖 [Browse Full Documentation →](./docs/)**

> **Tip for AI Agents:** Use the `@docs-writer` OpenCode agent for all documentation tasks. It's specialized in maintaining our Divio-structured docs with automatic validation.

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
- [**Performance**](./docs/reference/performance.md) - Optimization and caching
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

### 🔗 Backward Compatibility

All documentation has been migrated to the `/docs/` directory. Root-level `.md` files are now **symlinks** that redirect to the new locations for backward compatibility with existing external links and bookmarks.

**Original Files** → **New Locations:**
- `SETUP.md` → [`docs/getting-started/installation.md`](./docs/getting-started/installation.md)
- `DEPLOYMENT.md` → [`docs/guides/deployment/production.md`](./docs/guides/deployment/production.md)
- `API.md` → [`docs/reference/api/README.md`](./docs/reference/api/README.md)
- `AGENTS.md` → [`docs/project/agents.md`](./docs/project/agents.md)
- And more... (see [full documentation structure](./docs/README.md))

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
7. **Add version label** to PR (`major`, `minor`, or `patch`) when targeting `main`
8. Wait for review before merging

**Automated versioning** (PRs to `main` only):
- Add label `major` (breaking changes), `minor` (features), or `patch` (fixes)
- After merge + successful Docker build, version is auto-bumped and tagged
- `CHANGELOG.md` auto-generated from conventional commits
- GitHub release created automatically
- See [AGENTS.md](./AGENTS.md#automated-versioning--releases) for details

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
