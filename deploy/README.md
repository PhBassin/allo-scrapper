# allo-scrapper — VPS production deployment

This directory contains the production overlay for deploying allo-scrapper to a
single VPS using Docker Compose + Traefik (TLS) + Watchtower (auto-updates).

```
GitHub (main / tag v*)
  │
  ▼  docker-build-push.yml (existing CI)
ghcr.io/phbassin/allo-scrapper:{stable,v*,latest}
  │
  ▼  polled every 5 min
Watchtower (this VPS)
  │
  ▼  pulls + recreates ics-web / ics-scraper / ics-scraper-cron
docker compose (postgres + redis + app + traefik)
  │
  ▼
Traefik :443 → ics-web:3000  (auto Let's Encrypt, TLS-ALPN-01)
```

## Files

| File                       | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `docker-compose.prod.yml`  | Override on top of `../docker-compose.yaml`. Adds Traefik + Watchtower, hides the 3000 port. |
| `.env.example`             | Template — copy to `.env` and fill in secrets.      |

Routing for `ics-web` is declared via Docker labels directly inside
`docker-compose.prod.yml` (no separate static file). The rollback script lives
at `../scripts/deploy-rollback.sh`.

## Architecture decisions

- **Override, not duplicate.** This file is applied on top of
  `docker-compose.yaml` (the source of truth), so it never repeats what is
  defined there.
- **Images update themselves, compose files don't.** Watchtower swaps images
  but keeps each container's config. Changes to `docker-compose.yaml` or
  `docker-compose.prod.yml` (a new env var, label or service) are installed by
  `scripts/deploy-update.sh` on each release — see
  [Update to a new release](#update-to-a-new-release).
- **Traefik v3 with Docker provider.** Service discovery via Docker labels,
  no static config file. ACME certs via TLS-ALPN-01 (works on port 443 only,
  no special port-80 setup needed).
- **Watchtower with label scope.** Only the three app containers have the
  `watchtower.enable=true` label. Traefik and Watchtower itself are never
  auto-updated — update them explicitly when needed.
- **`:stable` tier.** Follows the latest `vX.Y.Z` tag (set by CI when a semver
  tag is pushed). `develop` pushes go to `:latest` and are NOT auto-deployed.

## Prerequisites on the VPS

- Docker Engine 25+ and Compose v2.17+ (for the `!reset` ports directive)
- A domain with an A record pointing to the VPS public IP
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS) — nothing else

## Bootstrap (one-time, ~30 min)

Run these on the VPS as a non-root user with sudo.

### 1. Harden the host

```bash
# Firewall — only SSH, HTTP, HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSH: key-only, no root login
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# fail2ban
sudo apt update && sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group to take effect
```

### 3. Lay out the deployment directory

Two options:

**Option A — clone the repo (recommended):**
```bash
sudo mkdir -p /opt/allo-scrapper
sudo chown $USER:$USER /opt/allo-scrapper
cd /opt/allo-scrapper
git clone -b develop --depth 1 <repo-url> .
```
You'll get `docker-compose.yaml`, `deploy/`, `scripts/` — everything needed.

**Option B — copy only what you need (smaller footprint):**
```bash
sudo mkdir -p /opt/allo-scrapper/deploy /opt/allo-scrapper/scripts
cd /opt/allo-scrapper
# scp from your machine:
#   docker-compose.yaml
#   deploy/docker-compose.prod.yml
#   deploy/.env.example
#   scripts/deploy-rollback.sh
#   scripts/deploy-update.sh
```

### 4. Configure secrets

```bash
cd /opt/allo-scrapper
cp deploy/.env.example .env
chmod 600 .env

# Generate strong values
openssl rand -base64 32  # → POSTGRES_PASSWORD
openssl rand -base64 64  # → JWT_SECRET

# Edit .env and fill in DOMAIN, ACME_EMAIL, ALLOWED_ORIGINS too
nano .env
```

### 5. First boot

```bash
docker compose -f docker-compose.yaml -f deploy/docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.yaml -f deploy/docker-compose.prod.yml --env-file .env up -d
```

Wait ~60 seconds for the DB to be healthy and migrations to run, then verify:

```bash
docker compose -f docker-compose.yaml -f deploy/docker-compose.prod.yml ps
curl -fsS https://<DOMAIN>/api/health
```

You should see JSON from the API. Traefik will have requested its cert on the
first request — check `docker compose logs traefik` if HTTPS fails.

### 6. (Optional) Enable the Traefik dashboard

The dashboard is **off by default** (good for prod). To enable it temporarily:

```bash
# Add these labels to the traefik service in deploy/docker-compose.prod.yml
#   traefik.http.routers.dashboard.rule: Host(`traefik.<DOMAIN>`)
#   traefik.http.routers.dashboard.entrypoints: websecure
#   traefik.http.routers.dashboard.tls: "true"
#   traefik.http.routers.dashboard.service: api@internal
#
# Protect it with BasicAuth, e.g.:
#   traefik.http.routers.dashboard.middlewares: dashboard-auth
#   traefik.http.middlewares.dashboard-auth.basicauth.users: "<user>:<htpasswd-hash>"
```

## Verify auto-update works

Once bootstrapped, push a new tag from your workstation:

```bash
git tag v4.7.5
git push origin v4.7.5
```

CI builds and tags `:stable`. Within ~10 minutes on the VPS:

```bash
docker compose -f docker-compose.yaml -f deploy/docker-compose.prod.yml logs -f watchtower
```

You should see `Found new image...restarting`. Then `/api/health` will report
the new version.

## Update to a new release

Watchtower brings the new **images**, not the new **compose files**: each
container is recreated with the config it already had. So on every release,
also install that release's `docker-compose.yaml` and
`deploy/docker-compose.prod.yml`:

```bash
cd /opt/allo-scrapper
./scripts/deploy-update.sh --dry-run v4.10.0   # see what would change
./scripts/deploy-update.sh v4.10.0             # apply it (asks for confirmation)
```

The script downloads both files from the release tag, shows the diff, lists
the `${VARS}` they reference for the first time (and whether `.env` sets
them), checks the merged config against `.env`, then installs the files
(previous ones saved in `.compose-backup/<timestamp>/`) and recreates **only**
the services whose config changed. DB and Redis are not touched unless their
own definition changed. Running it when nothing changed is a no-op.

Do it as soon as the release is tagged. Its release PR lists the new or
changed env vars and compose changes: if one needs a value in `.env` (the
script flags it), add it **before** applying. It makes no difference whether
Watchtower has already swapped the image: both orders end in the same state.

The script is not updated by the release either. When a release changes it,
refresh it from the tag first:

```bash
curl -fsSLo scripts/deploy-update.sh https://raw.githubusercontent.com/PhBassin/allo-scrapper/v4.10.0/scripts/deploy-update.sh
chmod +x scripts/deploy-update.sh
```

## Daily operations

All commands assume you're in `/opt/allo-scrapper`.

```bash
# Set a shell alias for brevity:
alias dc='docker compose -f docker-compose.yaml -f deploy/docker-compose.prod.yml --env-file .env'

dc ps                 # status
dc logs -f ics-web    # tail app logs
dc logs -f traefik    # tail reverse proxy logs (incl. ACME)
dc logs -f watchtower # tail auto-update log
dc restart ics-web    # restart one service
dc down               # stop everything (DB data + ACME certs persist in volumes)
dc up -d              # start everything
dc pull && dc up -d   # manual image update (bypass Watchtower)
./scripts/deploy-update.sh <tag>  # install a release's compose files (see above)
```

## Rollback

```bash
./scripts/deploy-rollback.sh v4.7.4
```

Rolls back the three app containers to the requested tag. DB, Redis, Traefik,
and Watchtower are untouched. See the script header for details.

It does not touch the compose files. If the release you are leaving also
changed them, put back the previous ones first: `deploy-update.sh` saved them
in `.compose-backup/<timestamp>/`, or run `./scripts/deploy-update.sh
<previous-tag>`.

## Backups

The repo ships `scripts/backup-db.sh`. On the VPS, schedule it via host cron:

```bash
# crontab -e
0 3 * * * cd /opt/allo-scrapper && ./scripts/backup-db.sh >> /var/log/allo-backup.log 2>&1
```

Backups land in `./backups/`. To enable 7-day rotation, uncomment the
`find ... -mtime +7 -delete` line in `scripts/backup-db.sh`.

For offsite backups (recommended), rsync the `backups/` directory to another
host or push to B2/S3. Not bundled here — choose your own.

## Troubleshooting

**HTTPS doesn't respond / cert fails:**
- Check `docker compose logs traefik` — ACME challenge logs are explicit there
- Traefik uses TLS-ALPN-01 (port 443). Port 80 must still be open for the
  HTTP→HTTPS redirect
- Confirm the A record resolves to this VPS (`dig <DOMAIN> +short`)
- Confirm ufw allows 80 and 443
- For first-time testing, switch ACME to staging (lower rate limits):
  uncomment the `caserver=` line in `deploy/docker-compose.prod.yml`

**Watchtower never updates:**
- Confirm `:stable` tag exists: `docker pull ghcr.io/phbassin/allo-scrapper:stable`
- Confirm the label is set: `docker inspect ics-web | grep watchtower.enable`
- Check Watchtower logs: `dc logs watchtower`

**App container bootloops after update:**
- Check `dc logs ics-web` — most often a missing env var or failed migration
- Rollback: `./scripts/deploy-rollback.sh <previous-tag>`

**Database locked / can't migrate:**
- `dc exec ics-db pg_isready` — must return "accepting connections"
- Check `dc logs ics-db` for disk full or corruption
- Last resort: restore from `./backups/`

## What is NOT included here

- **Staging environment.** There's one prod tier. Test on `develop` images
  locally before tagging.
- **Monitoring stack.** `docker-compose.monitoring.yml` exists and can be
  layered on (`-f docker-compose.monitoring.yml`), but it's not wired into
  the prod overlay by default. Add it once you need Grafana/Prometheus.
- **Offsite backups.** Local only by default — add rsync/B2 yourself.
- **Blue-green / canary.** Single-VPS blue-green adds complexity without much
  benefit at this scale. Rollback via `deploy-rollback.sh` is the safety net.
