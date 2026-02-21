# GitHub Actions Workflows

This directory contains automated workflows for CI/CD and maintenance tasks.

## Workflows Overview

### 1. 🐳 `docker-build-push.yml` - Docker Build & Push

**Purpose**: Build and push Docker images to GitHub Container Registry (ghcr.io)

**Triggers**:
- Push to `main` or `develop` branches
- Push tags matching `v*` (e.g., v1.0.0)
- Pull requests to `main` or `develop`
- Manual trigger (`workflow_dispatch`)

**Jobs**:

#### `build-and-push`
- Builds multi-platform Docker images (linux/amd64)
- Pushes to `ghcr.io/phbassin/allo-scrapper`
- Generates image tags:
  - Branch name (e.g., `main`, `develop`)
  - PR number (e.g., `pr-29`)
  - Semver versions (e.g., `1.1.0`, `1.1`)
  - Commit SHA (e.g., `sha-abc1234`)
  - `latest` — only for the default branch (`develop`); tracks continuous development
  - `stable` — only for `main` branch pushes and version tags (`v*`); tracks production-ready releases

#### Tag Strategy

| Tag | Source | Use case |
|-----|--------|----------|
| `:stable` | `main` branch + `v*` tags | **Production** — tested, reviewed code |
| `:latest` | `develop` branch (default) | Development / bleeding edge |
| `:v1.1.0` | Version tags | Pinned release |
| `:main`, `:develop` | Branch names | Branch-specific tracking |
| `:sha-abc1234` | Commit SHA | Exact commit reference |

#### `cleanup-after-production-build`
- **Runs after production builds** — triggered on push to `main` OR version tags (`v*`)
- Cleans up old untagged Docker images
- **Mode**: DRY-RUN (shows what would be deleted without actually deleting)
- **Policy**: Keep 10 versions maximum, delete only untagged versions
- **Protected**: All tagged versions (`v*`, `stable`, `latest`, branch names)

---

### 2. 🧹 `cleanup-docker-images.yml` - Docker Image Cleanup

**Purpose**: Periodic cleanup of old Docker images from ghcr.io registry

**Triggers**:
- Push to `main` branch (automatic)
- Manual trigger with dry-run control

**Cleanup Policy**:
- **Keep**: 10 versions maximum
- **Delete**: Only untagged versions (SHA-based images without explicit tags)
- **Protected**: All tagged versions (v*, latest, branch names, etc.)

**Dry-Run Mode**:
- **Default**: Enabled (safe mode)
- Shows what would be deleted without actually deleting
- Can be disabled via manual trigger:
  1. Go to Actions tab
  2. Select "Cleanup Docker Images" workflow
  3. Click "Run workflow"
  4. Set `dry-run` to `false`

**When to Disable Dry-Run**:
- After verifying dry-run logs show correct behavior
- When you're confident the cleanup policy is correct
- When you understand which images will be deleted

---

### 3. 🔄 `sync-main-to-develop.yml` - Branch Synchronization

**Purpose**: Automatically sync main branch into develop

**Triggers**:
- Push to `main` branch
- Manual trigger (`workflow_dispatch`)

**Behavior**:
- Merges `main` into `develop` with `--no-ff` (preserves merge history)
- Aborts gracefully on merge conflicts
- Requires `develop` branch to exist on remote

---

## Registry Management

### Current Image: `ghcr.io/phbassin/allo-scrapper`

### Viewing Images
```bash
# List all versions
gh api /user/packages/container/allo-scrapper/versions

# View package details
gh api /user/packages/container/allo-scrapper
```

### Manual Cleanup (if needed)
```bash
# Delete a specific version
gh api --method DELETE /user/packages/container/allo-scrapper/versions/VERSION_ID

# List untagged versions
gh api /user/packages/container/allo-scrapper/versions | jq '.[] | select(.metadata.container.tags | length == 0)'
```

---

## Troubleshooting

### Cleanup Workflow Not Running

**Problem**: Workflow doesn't trigger after push to main

**Solutions**:
1. Check GitHub Actions is enabled for the repository
2. Verify workflow file syntax is valid
3. Check workflow logs in Actions tab

### Too Many Images

**Problem**: Registry has too many untagged images

**Solutions**:
1. Run `cleanup-docker-images.yml` manually with `dry-run: false`
2. Adjust `min-versions-to-keep` in workflow (currently 10)
3. Clean up manually using `gh` CLI or GitHub API

### Build Failures

**Problem**: Docker build fails with "invalid tag" error

**Solutions**:
1. Check tag format in `docker-build-push.yml` metadata action
2. Verify branch names don't contain invalid characters
3. Review build logs for specific error messages

---

## Best Practices

### 1. **Always Test in Dry-Run First**
- New cleanup workflows start in dry-run mode
- Review logs before enabling actual deletion
- Verify correct versions would be kept/deleted

### 2. **Tag Important Builds**
- Use semantic versioning tags (v1.0.0, v2.0.0, etc.)
- Tagged versions are never deleted automatically
- Helps track production releases

### 3. **Monitor Registry Size**
- Check ghcr.io usage periodically
- Adjust cleanup frequency if needed
- Set appropriate `min-versions-to-keep` value

### 4. **Keep Development Images**
- Don't set `min-versions-to-keep` too low
- Keep enough versions for debugging
- Balance storage vs. history needs

---

## Permissions Required

All workflows need these permissions:

```yaml
permissions:
  contents: read      # Read repository code
  packages: write     # Push/delete Docker images
  attestations: write # Generate build attestations
  id-token: write     # OIDC token for attestations
```

These are configured at the job level in each workflow.

---

## Maintenance

### Updating Cleanup Policy

1. Edit `.github/workflows/cleanup-docker-images.yml`
2. Modify `min-versions-to-keep` value
3. Test with dry-run enabled
4. Push changes to trigger workflow

### Disabling Cleanup

To temporarily disable cleanup:
- Comment out the trigger in workflow file
- Or add a condition: `if: false`

To re-enable:
- Uncomment or remove the condition
- Push changes

---

## Related Documentation

- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Actions delete-package-versions](https://github.com/actions/delete-package-versions)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

---

**Last Updated**: 2026-02-20
