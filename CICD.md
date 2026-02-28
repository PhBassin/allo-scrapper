# 🔄 CI/CD Pipeline Guide

[← Back to README](./README.md)

Complete guide for Continuous Integration and Continuous Deployment (CI/CD).

**Related Documentation:**
- [Docker Deployment](./DOCKER.md) - Container builds
- [Testing Guide](./TESTING.md) - Automated tests
- [Contributing Guide](./CONTRIBUTING.md) - Development workflow

---

## Table of Contents

- [Overview](#overview)
- [GitHub Actions Workflow](#github-actions-workflow)
- [Tag Strategy](#tag-strategy)
- [Release Process](#release-process)
- [Testing Pull Requests](#testing-pull-requests)
- [Setting Up CI/CD](#setting-up-cicd)

---

## Overview

The repository uses GitHub Actions for automated:
- Docker image building
- Testing
- Publishing to GitHub Container Registry (GHCR)
- Image cleanup

**Workflow Files:**
- `.github/workflows/docker-build-push.yml` - Main CI/CD pipeline
- `.github/workflows/cleanup-docker-images.yml` - Cleanup old images
- `.github/workflows/ghcr-cleanup.yml` - Daily GHCR cleanup
- `.github/workflows/sync-main-to-develop.yml` - Auto-sync main → develop

---

## GitHub Actions Workflow

### Main Pipeline: docker-build-push.yml

**Triggers:**
- Push to `main` or `develop` branches
- Version tags (`v*`)
- Manual workflow dispatch
- Pull requests (for testing)

**Steps:**

1. **Checkout Code**
   ```yaml
   - uses: actions/checkout@v4
   ```

2. **Set up Docker Buildx**
   ```yaml
   - uses: docker/setup-buildx-action@v3
   ```

3. **Login to GHCR**
   ```yaml
   - uses: docker/login-action@v3
     with:
       registry: ghcr.io
       username: ${{ github.actor }}
       password: ${{ secrets.GITHUB_TOKEN }}
   ```

4. **Build Docker Image**
   - Multi-platform build (linux/amd64)
   - Layer caching for faster builds
   - Runs automated tests (if configured)

5. **Push to Registry**
   - Publishes to `ghcr.io/phbassin/allo-scrapper`
   - Tags based on branch/version

6. **Output Build Info**
   - Build attestation
   - Image digest
   - Build summary in Actions UI

---

## Tag Strategy

### Tag Mapping

| Git Event | Docker Tags Generated | Use Case |
|-----------|----------------------|----------|
| Push to `main` | `:stable`, `:main`, `:sha-1234567` | Production releases |
| Push to `develop` | `:latest`, `:develop`, `:sha-1234567` | Development builds |
| Version tag `v1.2.3` | `:stable`, `:v1.2.3`, `:v1.2`, `:v1`, `:main` | Versioned releases |
| Pull Request #141 | `:pr-141`, `:sha-1234567` | Testing PRs before merge |

### Tag Descriptions

**Production Tags:**
- `:stable` - **Recommended for production** - Latest stable release from `main` or version tag
- `:v1.2.3` - Specific semantic version
- `:v1.2` - Latest patch version for minor version
- `:v1` - Latest minor version for major version
- `:main` - Latest commit on main branch

**Development Tags:**
- `:latest` - Latest development build from `develop` (may be unstable)
- `:develop` - Alias for `:latest`

**Testing Tags:**
- `:pr-141` - Pull request build (for testing before merge)
- `:sha-1234567` - Specific commit hash (7 characters)

### Tag Strategy v1.1.0+

> **Important Change in v1.1.0:**
> - `:latest` now tracks `develop` (continuous development)
> - `:stable` tracks `main` and version tags (production-ready)
>
> **Migration from v1.0.0:**
> If you used `:latest` in production, switch to `:stable`

**Before (v1.0.0):**
```yaml
image: ghcr.io/phbassin/allo-scrapper:latest  # production
```

**After (v1.1.0+):**
```yaml
image: ghcr.io/phbassin/allo-scrapper:stable  # production
# OR
image: ghcr.io/phbassin/allo-scrapper:latest  # development
```

---

## Release Process

### Creating a New Release

**Step 1: Merge to main**
```bash
# Create PR: develop → main
gh pr create --base main --head develop --title "Release v1.2.0"

# Review and merge PR
gh pr merge --merge
```

**Step 2: Create version tag**
```bash
# Switch to main and pull latest
git checkout main
git pull

# Create and push tag
git tag v1.2.0
git push origin v1.2.0
```

**Step 3: Automated CI/CD**

GitHub Actions automatically:
1. Builds Docker image
2. Runs tests
3. Publishes to GHCR with tags:
   - `:stable` (updated)
   - `:v1.2.0` (new)
   - `:v1.2` (new or updated)
   - `:v1` (new or updated)
   - `:main` (updated)

**Step 4: Create GitHub Release**
```bash
# Create release from tag
gh release create v1.2.0 --title "v1.2.0" --notes-file CHANGELOG.md

# Or manually:
# Go to: https://github.com/PhBassin/allo-scrapper/releases/new
# - Choose tag: v1.2.0
# - Release title: v1.2.0
# - Description: Copy relevant section from CHANGELOG.md
# - Click "Publish release"
```

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.2.0): New features (backward compatible)
- **PATCH** (v1.1.1): Bug fixes (backward compatible)

**Examples:**
```bash
# Bug fix
git tag v1.1.1
git push origin v1.1.1

# New feature
git tag v1.2.0
git push origin v1.2.0

# Breaking change
git tag v2.0.0
git push origin v2.0.0
```

---

## Testing Pull Requests

Every Pull Request automatically builds a Docker image with multiple tags for easy testing.

### PR Tags

| Tag Format | Example | Use Case |
|------------|---------|----------|
| `pr-<number>` | `pr-141` | **Primary PR tag** — easiest to find and use |
| `sha-<short>` | `sha-1353598` | Specific commit (7 characters) |

### Testing a PR

**Step 1: Find PR tag**

1. Open the PR on GitHub
2. Click "Checks" tab
3. Click "Docker Build & Push" workflow
4. View "Summary" tab — the PR tag is highlighted

**Step 2: Pull and run**

```bash
# Pull the PR image (replace 141 with your PR number)
docker pull ghcr.io/phbassin/allo-scrapper:pr-141

# Run it locally
docker run -p 3000:3000 ghcr.io/phbassin/allo-scrapper:pr-141

# Or use with docker-compose
# Edit docker-compose.yml:
services:
  ics-web:
    image: ghcr.io/phbassin/allo-scrapper:pr-141
```

**Step 3: Test the changes**

```bash
# Access the application
open http://localhost:3000

# Run E2E tests against PR image
docker compose up -d
npx playwright test
```

### Example PR Workflow

```bash
# Contributor creates PR
gh pr create --title "feat: add cinema search"

# CI builds image with tag :pr-142

# Reviewer tests PR
docker pull ghcr.io/phbassin/allo-scrapper:pr-142
docker compose up -d
# Test the feature...

# Reviewer approves and merges
gh pr merge 142

# CI builds new :develop and :latest images
```

---

## Setting Up CI/CD

### Prerequisites

1. **Enable GitHub Container Registry** in repository settings
   - Settings → Packages → "Improved container support"

2. **Grant workflow permissions**
   - Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"

3. **Add repository secrets** (if needed)
   ```
   Settings → Secrets and variables → Actions → New repository secret
   ```

### Required Permissions

**GITHUB_TOKEN** (automatically provided by GitHub Actions):
- `contents: write` - Create releases
- `packages: write` - Push to GHCR
- `attestations: write` - Generate build attestations

### Workflow Configuration

Located in `.github/workflows/docker-build-push.yml`:

```yaml
name: Docker Build & Push

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      attestations: write
    steps:
      # ... (see full file for details)
```

### Customizing Workflows

**Change build platform:**
```yaml
# In docker-build-push.yml
platforms: linux/amd64,linux/arm64  # Add ARM64 support
```

**Add build-time tests:**
```yaml
- name: Run tests
  run: |
    docker run --rm ${{ env.IMAGE_NAME }} npm test
```

**Change tag strategy:**
```yaml
# In docker-build-push.yml, modify the "tags" section
tags: |
  type=ref,event=branch
  type=ref,event=pr
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
```

---

## Cleanup Workflows

### Daily GHCR Cleanup

**Workflow:** `.github/workflows/ghcr-cleanup.yml`

**Runs:** Daily at midnight UTC

**Deletes:**
- Untagged images
- Images older than 15 days (except tagged releases)

**Configuration:**
```yaml
# Keep images newer than:
older-than: 15  # days

# Except images with these tags:
keep-at-least: 3
```

### Manual Cleanup

```bash
# Delete specific tag
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/allo-scrapper/versions/VERSION_ID

# List all package versions
gh api \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/allo-scrapper/versions
```

---

## Using Pre-built Images

### Pull Images

```bash
# Pull stable (production-ready) image
docker pull ghcr.io/phbassin/allo-scrapper:stable

# Pull latest development build
docker pull ghcr.io/phbassin/allo-scrapper:latest

# Pull specific version
docker pull ghcr.io/phbassin/allo-scrapper:v1.1.0

# List available local images
docker images | grep allo-scrapper
```

### Browse Images

**GitHub Packages UI:**
```
https://github.com/PhBassin/allo-scrapper/pkgs/container/allo-scrapper
```

**CLI:**
```bash
# List all tags
gh api \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/allo-scrapper/versions \
  | jq -r '.[].metadata.container.tags[]'
```

---

## Monitoring CI/CD

### View Workflow Runs

```bash
# List recent workflow runs
gh run list --workflow=docker-build-push.yml

# View specific run
gh run view RUN_ID

# View logs
gh run view RUN_ID --log
```

### Build Status Badge

Add to README.md:

```markdown
[![Docker Build](https://github.com/PhBassin/allo-scrapper/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/PhBassin/allo-scrapper/actions/workflows/docker-build-push.yml)
```

### Notifications

**Enable email notifications:**
1. GitHub Settings → Notifications
2. Select "Actions" workflows
3. Choose notification preferences

**Slack integration** (optional):
```yaml
# Add to workflow
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Troubleshooting CI/CD

### Build Fails on CI

```bash
# View logs
gh run view --log

# Common issues:
# - npm ci fails: Check package-lock.json is committed
# - Tests fail: Run tests locally first
# - Docker build fails: Check Dockerfile syntax
```

### Image Push Fails

```bash
# Check permissions
# Settings → Actions → General → Workflow permissions
# Must be "Read and write permissions"

# Check authentication
# GITHUB_TOKEN must have packages:write scope
```

### Tag Not Created

```bash
# Check workflow triggers
# .github/workflows/docker-build-push.yml
# Ensure 'tags: ["v*"]' is in the 'on' section

# Verify tag was pushed
git ls-remote --tags origin
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more CI/CD issues.

---

## Related Documentation

- [Docker Deployment](./DOCKER.md) - Container builds and deployment
- [Testing Guide](./TESTING.md) - Automated tests in CI
- [Contributing Guide](./CONTRIBUTING.md) - Development workflow
- [Troubleshooting](./TROUBLESHOOTING.md) - CI/CD issues

---

[← Back to README](./README.md)
