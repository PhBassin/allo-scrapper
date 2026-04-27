# GitHub Workflows

Current workflows in this repository.

## `ci.yml`

Runs on pushes to `develop` and prefixed branches, plus PRs to `main` and `develop`.

Current steps:

1. `npm ci --legacy-peer-deps`
2. `npm run build --workspaces --if-present`
3. `cd server && npm run test:run`
4. `cd server && npm run test:integration`
5. `cd server && npm run test:coverage`

## `docker-build-push.yml`

Builds and publishes multi-arch images for:

- web image
- scraper image

Current platforms:

- `linux/amd64`
- `linux/arm64`

It also creates merged manifests and build attestations.

## `version-tag.yml`

Runs on pushes to `main`.

Current behavior:

- determines bump type from PR labels or title
- updates root `package.json`
- updates `CHANGELOG.md`
- creates a git tag and GitHub release
- dispatches `docker-build-push.yml`

## `sync-main-to-develop.yml`

Runs after a successful `Version Tag & Release` workflow, or manually.

It merges `main` into `develop` and fails cleanly on conflicts.

## Other workflow files

- `ghcr-cleanup.yml`
- `cleanup-docker-images.yml`
- `cleanup-ghcr-untagged.yml`
- `cleanup-docker-images.yml`

Use the YAML files themselves as the source of truth for exact triggers and permissions.
