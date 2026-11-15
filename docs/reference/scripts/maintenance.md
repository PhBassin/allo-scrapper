# Maintenance Scripts Reference

Reference documentation for maintenance and cleanup scripts.

**Last updated:** March 17, 2026

**Related Documentation:**
- [Docker Guide](../../guides/deployment/docker.md) - Docker configuration

---

## Table of Contents

- [Overview](#overview)
- [delete-ghcr-untagged.sh](#delete-ghcr-untaggedsh)
- [cleanup-old-docker-images.sh](#cleanup-old-docker-imagessh)

---

## Overview

Allo-Scrapper provides scripts for maintaining the Docker registry and system:

| Script | Purpose | Best For |
|--------|---------|----------|
| `delete-ghcr-untagged.sh` | Batch delete untagged and SHA-only images | Registry cleanup |
| `cleanup-old-docker-images.sh` | Keep only N recent images | Registry retention policy |

---

## delete-ghcr-untagged.sh

**Location**: `scripts/delete-ghcr-untagged.sh`

**Purpose**: Batch delete Docker images from GitHub Container Registry that are either **untagged** or have **only SHA tags** (e.g., `sha256-...` or `sha-abc1234`). This helps reclaim storage space by removing intermediate build artifacts.

### Usage

```bash
./scripts/delete-ghcr-untagged.sh [options]
```

**Options**:
- `--dry-run`: Show what would be deleted without actually deleting
- `--force` / `-y`: Skip confirmation prompt (useful for automation)
- `--limit <n>`: Limit the number of images to process per package (default: all)

**Examples**:

```bash
# Preview deletion (Dry Run)
./scripts/delete-ghcr-untagged.sh --dry-run

# Delete first 10 images
./scripts/delete-ghcr-untagged.sh --limit 10

# Delete all untagged/SHA-only images (interactive)
./scripts/delete-ghcr-untagged.sh

# Force delete (non-interactive)
./scripts/delete-ghcr-untagged.sh --force
```

---

### What It Does

1. **Fetches** all package versions for `allo-scrapper` and `allo-scrapper-scraper`.
2. **Identifies** deletable images:
   - **Untagged**: `tags` is empty or null.
   - **SHA-only**: Has tags, but **ALL** tags start with `sha` (e.g., `sha-8f93cd3`).
3. **Protects** meaningful tags:
   - Images with tags like `latest`, `stable`, `v4.1.0`, or `develop` are **never** selected, even if they also have a SHA tag.
4. **Deletes** selected images in parallel (10 concurrent jobs) for speed.

---

### Prerequisites

- **GitHub CLI (`gh`)** installed and authenticated.
- **`jq`** installed.
- **Permissions**: You must have `delete:packages` scope.
  ```bash
  gh auth refresh -h github.com -s delete:packages
  ```

---

## cleanup-old-docker-images.sh

**Location**: `scripts/cleanup-old-docker-images.sh`

**Purpose**: Retention policy script that keeps the N most recent images and deletes older ones, while protecting specific tags (`latest`, `stable`, `main`, `develop`).

### Usage

```bash
./scripts/cleanup-old-docker-images.sh
```

**Configuration**:
Variables at the top of the script control behavior:
- `KEEP_VERSIONS=30`: Number of recent versions to keep.
- `PROTECTED_TAGS`: List of tags to never delete.

---

[← Back to Scripts Reference](./README.md)
