# Dependabot Grouped Updates Configuration

## Overview

This document explains our Dependabot configuration strategy for the allo-scrapper monorepo.

**Problem Solved:** Previously, Dependabot created 7+ individual PRs per week (one per dependency), requiring manual consolidation. See PRs #843-#849 consolidated into #856 as an example.

**Solution:** Configured Dependabot to use grouped updates, reducing PR count to 2-3 per week.

---

## Configuration Strategy

### 📦 **NPM Dependencies**
- **Group 1: Minor & Patch Updates** → Single PR
  - Examples: `1.0.0 → 1.1.0`, `1.0.0 → 1.0.1`
  - Safe, non-breaking changes
  - All workspaces updated together (client, server, scraper, packages/*)
  
- **Group 2: Major Updates** → Separate PR
  - Examples: `1.9.9 → 2.0.0`
  - Potential breaking changes requiring careful review
  - Isolated for easier rollback if needed

### ⚙️ **GitHub Actions**
- **Group 3: Workflow Updates** → Separate PR
  - Examples: `actions/checkout@v3 → v4`
  - Different testing requirements than code dependencies
  - Isolated to prevent CI/CD disruption

---

## How It Works

### Weekly Schedule
```
Every Monday at 09:00 Europe/Paris:
├── Dependabot scans for npm updates
├── Groups by update type (minor/patch vs major)
├── Creates 1-2 PRs for npm dependencies
├── Scans for GitHub Actions updates
└── Creates 1 PR for workflow updates
```

### PR Naming Convention
- **npm minor/patch:** `chore(deps): update npm dependencies`
- **npm major:** `chore(deps): update npm major dependencies`
- **GitHub Actions:** `ci(deps): update GitHub Actions dependencies`

### Labels Applied
- `dependencies` - All dependency PRs
- `npm` - npm package updates
- `github-actions` - Workflow updates
- `ci` - CI/CD related changes

---

## Monorepo Support

### Automatic Workspace Detection
Dependabot's npm ecosystem **automatically discovers and updates all npm workspaces** when configured at the root directory (`/`).

**Workspaces managed:**
- `client` - React frontend
- `server` - Express.js backend
- `scraper` - Cinema scraper microservice
- `packages/saas` - SaaS multi-tenancy features
- `packages/logger` - Shared logging utilities

**Why we removed individual workspace configurations:**
- Previous config had separate entries for `/server`, `/client`, `/scraper`
- This caused duplicate PRs for the same dependency across workspaces
- Root-level config handles all workspaces in a single update

---

## Expected PR Volume

### Before Grouped Updates
```
Week 1:
├── PR #1: bump lru-cache (root)
├── PR #2: bump @playwright/test (dev)
├── PR #3: bump @tanstack/react-query-devtools (client)
├── PR #4: bump @types/node (server)
├── PR #5: bump p-limit (server)
├── PR #6: bump p-limit (scraper)
└── PR #7: bump actions/github-script

Total: 7 PRs → Manually consolidated into 1
```

### After Grouped Updates
```
Week 1:
├── PR #1: chore(deps): update npm dependencies (minor/patch)
│   └── Contains: lru-cache, @playwright/test, @tanstack/react-query-devtools, @types/node, p-limit (all workspaces)
├── PR #2: chore(deps): update npm major dependencies
│   └── Contains: (only if major versions available)
└── PR #3: ci(deps): update GitHub Actions dependencies
    └── Contains: actions/github-script

Total: 2-3 PRs (no manual consolidation needed)
```

---

## Customization Options

### Ignore Specific Dependencies
```yaml
ignore:
  - dependency-name: "typescript"
    # Don't update TypeScript (we manage this manually)
  - dependency-name: "react"
    versions: ["19.x"]
    # Skip React 19.x (not ready for production)
```

### Create Custom Groups
```yaml
groups:
  # Group by technology stack
  react-ecosystem:
    patterns:
      - "react*"
      - "@tanstack/*"
      - "vite*"
  
  # Group by dependency type
  testing-tools:
    patterns:
      - "vitest*"
      - "@vitest/*"
      - "@playwright/*"
```

### Change Update Frequency
```yaml
schedule:
  interval: monthly  # Options: daily, weekly, monthly
  day: monday        # Options: monday-sunday
  time: "09:00"      # 24-hour format
  timezone: "Europe/Paris"
```

---

## Troubleshooting

### Issue: PRs Not Being Grouped
**Symptom:** Dependabot still creates individual PRs

**Causes:**
1. Configuration not yet applied (takes effect on next scheduled run)
2. YAML syntax error (check GitHub Security tab for warnings)
3. Group patterns don't match dependencies

**Solution:**
```bash
# Validate YAML syntax locally
cat .github/dependabot.yml | python -m yaml

# Check Dependabot alerts in GitHub
# Settings → Security → Dependabot alerts → Configuration
```

### Issue: Too Many Dependencies in One PR
**Symptom:** Single PR updates 20+ packages, difficult to review

**Solutions:**

**Option A: Split by dependency type**
```yaml
groups:
  production-dependencies:
    dependency-type: "production"
  development-dependencies:
    dependency-type: "development"
```

**Option B: Split by scope**
```yaml
groups:
  frontend-deps:
    patterns: ["react*", "vite*", "@tanstack/*"]
  backend-deps:
    patterns: ["express*", "pg*", "@types/*"]
```

### Issue: Major Updates Breaking CI
**Symptom:** Major version PR fails tests

**Expected Behavior:** This is intentional - major updates are isolated for careful review.

**Workflow:**
1. Review major update PR separately
2. Check migration guides for breaking changes
3. Update code to handle breaking changes
4. Merge when tests pass

---

## Testing the Configuration

### Manual Trigger (GitHub UI)
1. Go to **Insights → Dependency Graph → Dependabot**
2. Click **Last checked X time ago**
3. Click **Check for updates** button
4. Wait 1-2 minutes for PRs to be created

### Verify Grouping
```bash
# List recent Dependabot PRs
gh pr list --author app/dependabot --limit 10

# Expected output:
# - 1 PR with multiple npm packages
# - 1 PR with GitHub Actions (if updates available)
```

### Check PR Contents
```bash
# View files changed in grouped PR
gh pr view <pr-number> --json files

# Should see updates across multiple package.json files
# Example: client/package.json, server/package.json, etc.
```

---

## Best Practices

### ✅ Do:
- Review grouped PRs within 24-48 hours (before next weekly run)
- Check CHANGELOG/release notes for major updates
- Run full test suite before merging
- Use `patch` version label for minor/patch PRs
- Use `major` version label for major update PRs

### ❌ Don't:
- Blindly merge grouped PRs without testing
- Ignore security updates (Dependabot alerts)
- Create manual dependency update PRs (let Dependabot handle it)
- Close Dependabot PRs without addressing updates

---

## Migration Notes

### What Changed
- **Removed:** Individual workspace configurations (`/server`, `/client`, `/scraper`)
- **Added:** Root-level npm configuration with workspace auto-detection
- **Added:** Grouping rules for minor/patch and major updates
- **Added:** Conventional commit message formatting

### Backward Compatibility
- Existing Dependabot PRs (before this config) remain open
- New grouped PRs will appear on next Monday run
- Old individual PRs can be safely closed (superseded by grouped PRs)

---

## References

- [GitHub Docs: Dependabot Configuration Options](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [GitHub Docs: Grouped Version Updates](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups)
- [GitHub Blog: Grouped Version Updates Announcement](https://github.blog/changelog/2023-06-30-grouped-version-updates-for-dependabot-public-beta/)
- Previous consolidation example: [PR #856](https://github.com/PhBassin/allo-scrapper/pull/856)

---

## Maintenance

**Review this configuration:**
- After major project restructuring
- If PR volume becomes too high/low
- When adding new workspaces to monorepo
- Quarterly (to optimize grouping strategy)

**Last Updated:** 2026-04-15  
**Issue:** #857  
**Author:** DevOps Automator
