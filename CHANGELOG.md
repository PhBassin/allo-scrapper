# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.7.0] - 2026-06-04

### Added

- feat(jwt): implement secret rotation with multi-secret verification (#1083) [@PhBassin](https://github.com/PhBassin) (5fcff0d)
- feat(jwt): implement secret rotation with multi-secret verification [@phbassin](https://github.com/phbassin) (d2dfb41)
- feat(rate-limit): hot-reload rate limit config without server restart (#1081) [@PhBassin](https://github.com/PhBassin) (8a6cb09)
- feat(rate-limit): hot-reload rate limit config without server restart [@phbassin](https://github.com/phbassin) (780817a)
- feat(api): add requireAuth to /metrics and /api/scraper/status (#1077) [@PhBassin](https://github.com/PhBassin) (5680259)
- feat(api): add requireAuth to /metrics and /api/scraper/status endpoints [@phbassin](https://github.com/phbassin) (b9a897c)
- feat(auth): add refresh token rotation with httpOnly cookies [@phbassin](https://github.com/phbassin) (a159596)
- feat(client): implement react useMemo performance optimizations for homepage and admin tabs [@phbassin](https://github.com/phbassin) (b2c480d)
- feat(client): add to calendar from showtime button (#1049) [@PhBassin](https://github.com/PhBassin) (e549792)
- feat(client): add to calendar from showtime button [@phbassin](https://github.com/phbassin) (f2a7c40)

### Fixed

- fix: code review findings from release v4.7.0 (#1128) [@PhBassin](https://github.com/PhBassin) (c561be0)
- fix(api,client): add .trim() to Bearer token extraction and remove unused container destructuring [@phbassin](https://github.com/phbassin) (cd45977)
- fix(api): reject zero-value REFRESH_TOKEN_EXPIRY to prevent instant expiry [@phbassin](https://github.com/phbassin) (66ff985)
- fix(client): add redirects from /cinema/:id and /film/:id to new routes [@phbassin](https://github.com/phbassin) (d9725c0)
- fix(api): use standard Bearer header token extraction [@phbassin](https://github.com/phbassin) (79ec912)
- fix(server): enable upgradeInsecureRequests in CSP (#1112) [@PhBassin](https://github.com/PhBassin) (f897511)
- fix(server): enable upgradeInsecureRequests in CSP [@phbassin](https://github.com/phbassin) (6a7d424)
- fix(auth): centralize admin role check into isAdminUser() (#1111) [@PhBassin](https://github.com/PhBassin) (c1ed41a)
- fix: use vi.importActual for isAdminUser mock in scraper tests [@phbassin](https://github.com/phbassin) (5492834)
- fix(auth): centralize admin role check into isAdminUser() [@phbassin](https://github.com/phbassin) (4c3a51f)
- fix(security): migrate access token to httpOnly cookie, use SHA-256 ETags, pin Node engine (#1110) [@PhBassin](https://github.com/PhBassin) (1cb79e5)
- fix(security): migrate auth from localStorage to httpOnly cookie [@phbassin](https://github.com/phbassin) (4f27c94)
- fix(security): harden cookie-based auth [@phbassin](https://github.com/phbassin) (cf9158b)
- fix(security): migrate access token to httpOnly cookie, use SHA-256 ETags, pin Node engine [@phbassin](https://github.com/phbassin) (c9e4252)
- fix(docker): enforce POSTGRES_PASSWORD requirement, remove weak defaults (#1109) [@PhBassin](https://github.com/PhBassin) (37771b9)
- fix(docker): enforce POSTGRES_PASSWORD requirement, remove weak defaults [@phbassin](https://github.com/phbassin) (37284ba)
- fix(security): make refresh token rotation atomic using DB transaction (#1107) [@PhBassin](https://github.com/PhBassin) (c2ead93)
- fix(security): harden refresh token rotation per code review [@phbassin](https://github.com/phbassin) (c546193)
- fix(security): make refresh token rotation atomic using DB transaction [@phbassin](https://github.com/phbassin) (0f1acc7)
- fix(cors): block requests with no or null origin on auth routes (#1106) [@PhBassin](https://github.com/PhBassin) (4d978d1)
- fix(cors): block requests with no or null origin on auth routes [@phbassin](https://github.com/phbassin) (4882f4c)
- fix(auth): add explicit HS256 algorithm to all JWT sign/verify calls (#1105) [@PhBassin](https://github.com/PhBassin) (052900e)
- fix(auth): add explicit HS256 algorithm to all JWT sign/verify calls [@phbassin](https://github.com/phbassin) (5491438)
- fix(api,client): stop exposing plaintext passwords in logs and HTTP responses (#1104) [@PhBassin](https://github.com/PhBassin) (9eccecc)
- fix(api,client): stop exposing plaintext passwords in logs and HTTP responses [@phbassin](https://github.com/phbassin) (801800f)
- fix(api): make rate limiting recognizable to CodeQL [@phbassin](https://github.com/phbassin) (f53a71d)
- fix(jwt): apply code review patches — caching, startup validation, edge cases [@phbassin](https://github.com/phbassin) (60d0606)
- fix(api): add rate limiter to /metrics endpoint to fix CodeQL High severity alert [@phbassin](https://github.com/phbassin) (432995f)
- fix(test): align mock error message with real requireAuth, add try/finally guards [@phbassin](https://github.com/phbassin) (739a104)
- fix(security): use extended:false for urlencoded body parser (#1076) [@PhBassin](https://github.com/PhBassin) (40be810)
- fix(auth): reduce default JWT expiry from 24h to 1h (#1075) [@PhBassin](https://github.com/PhBassin) (ab5966a)
- fix(auth): apply BMAD CR patches — 7 security/liveness fixes [@phbassin](https://github.com/phbassin) (98aa3d6)
- fix(auth): use res.json(); return; pattern for Promise<void> compat [@phbassin](https://github.com/phbassin) (bf0d265)
- fix(auth): remove unused authService, add return type to refresh route [@phbassin](https://github.com/phbassin) (c4ff535)
- fix(csrf): skip CSRF for test env, login, and refresh endpoints [@phbassin](https://github.com/phbassin) (fc681e0)
- fix(docker): reduce compose JWT_EXPIRES_IN fallback from 24h to 1h [@phbassin](https://github.com/phbassin) (ea364ba)
- fix(auth): reduce default JWT expiry from 24h to 1h [@phbassin](https://github.com/phbassin) (3634ab8)
- fix(husky): allow prepare script to fail gracefully in production builds [@phbassin](https://github.com/phbassin) (e7029ae)
- fix(auth): correct ts typing for crypto.scrypt usage [@phbassin](https://github.com/phbassin) (c2b5fcd)
- fix(review): address adversarial code review findings [@phbassin](https://github.com/phbassin) (08b3a4e)
- fix(review): address edge cases from fetch/decoder migration [@phbassin](https://github.com/phbassin) (9055c2f)
- fix(client): resolve TypeScript build errors from fetch migration refs #1071 [@phbassin](https://github.com/phbassin) (4fcaafe)
- fix(scraper): resolve puppeteer browser connection state compilation issue (#1069) [@PhBassin](https://github.com/PhBassin) (cb6d9d8)
- fix(scraper): resolve puppeteer browser connection state compilation issue [@phbassin](https://github.com/phbassin) (f358686)
- fix(api): secure rate-limiter jwt verification and sanitize 5xx errors in production (#1060) [@PhBassin](https://github.com/PhBassin) (bafcb26)
- fix(api): secure rate-limiter jwt verification and sanitize 5xx errors in production [@phbassin](https://github.com/phbassin) (066685e)
- fix(client): update film.cinemas→film.theaters and DatabaseStats fields [@phbassin](https://github.com/phbassin) (79919bf)
- fix(client): update mock data field films→movies in test fixtures [@phbassin](https://github.com/phbassin) (b655d96)
- fix(client): update ProgressEvent/ScrapeReport field names to match server [@phbassin](https://github.com/phbassin) (7adb267)
- fix(client): update response field names to match server rename [@phbassin](https://github.com/phbassin) (dd1b3c4)
- fix(client): update API paths and route URLs after cinema/film to theater/movie rename [@phbassin](https://github.com/phbassin) (61a826c)
- fix(client): correct hoisted mocks in CalendarPopover test for CI build [@phbassin](https://github.com/phbassin) (2068c28)
- fix(client): replace Apple Calendar option with Apple/Outlook .ics download [@phbassin](https://github.com/phbassin) (aa28fe7)
- fix(client): render CalendarPopover via portal to escape card overflow clipping [@phbassin](https://github.com/phbassin) (5262abc)
- fix(client): restore missing CinemaDateSelector and ShowtimeList imports in CinemaPage [@phbassin](https://github.com/phbassin) (b6e519e)
- fix(client): apply code review patches on add-to-calendar feature [@phbassin](https://github.com/phbassin) (9551f7b)
- fix(client): pass film prop to CinemaShowtimes and fix FilmGroup type [@phbassin](https://github.com/phbassin) (0efaa6f)

### Changed

- test(client): add redirect tests for old cinema/film route URLs [@phbassin](https://github.com/phbassin) (daa6635)
- test(api): add zero-value expiry tests for parseRefreshTokenExpiry [@phbassin](https://github.com/phbassin) (ccac477)
- refactor(client): rename cinema→theater and film→movie across frontend (#1120) [@PhBassin](https://github.com/PhBassin) (7136ff5)
- refactor(client): rename cinema→theater and film→movie across entire frontend [@phbassin](https://github.com/phbassin) (e92dabe)
- test(server): add CSP upgrade-insecure-requests test [@phbassin](https://github.com/phbassin) (ed09729)
- test(auth): add isAdminUser unit tests [@phbassin](https://github.com/phbassin) (058711a)
- test(auth): add tests for httpOnly access token cookie and SHA-256 ETag [@phbassin](https://github.com/phbassin) (c2b15b5)
- test(security): add RED tests for atomic refresh token rotation [@phbassin](https://github.com/phbassin) (145cbad)
- test(cors): add strict mode tests for null/missing origin rejection [@phbassin](https://github.com/phbassin) (48cf7fb)
- test(auth): add explicit HS256 algorithm to JWT test calls [@phbassin](https://github.com/phbassin) (5c1b576)
- test(api,client): update tests for client-side password reset [@phbassin](https://github.com/phbassin) (ad19ea4)
- Bump the "all-dependencies" group with 2 updates across multiple ecosystems (#1091) [@PhBassin](https://github.com/PhBassin) (75ecd67)
- test(client): fix dependency update regressions [@phbassin](https://github.com/phbassin) (1b4fba6)
- Merge branches 'pr-1084', 'pr-1085', 'pr-1086', 'pr-1087' and 'pr-1088' into chore/1089-consolidate-dependabot-prs [@phbassin](https://github.com/phbassin) (1b6edc8)
- test(jwt): add RED tests for multi-secret JWT rotation [@phbassin](https://github.com/phbassin) (d92a296)
- test(rate-limit): add coverage for rate-limit-refresher service [@phbassin](https://github.com/phbassin) (344cb04)
- test(rate-limit): add RED tests for hot-reload rate limits [@phbassin](https://github.com/phbassin) (e60d817)
- test(scraper,api): add tests for 401 on unauthenticated /metrics and /status [@phbassin](https://github.com/phbassin) (219cb9a)
- test(refresh-token): add parseRefreshTokenExpiry tests to meet coverage [@phbassin](https://github.com/phbassin) (96bc936)
- test(refresh-token): add unit tests for RefreshTokenService [@phbassin](https://github.com/phbassin) (4636f14)
- test(db): add migration 024 to applied migrations list [@phbassin](https://github.com/phbassin) (dc9b9bb)
- test(auth): add test for default JWT expiry of 1h [@phbassin](https://github.com/phbassin) (0e8ca6b)
- refactor(auth): replace bcryptjs with native crypto.scrypt [@phbassin](https://github.com/phbassin) (7f32a9a)
- refactor(server): replace lru-cache with native Map for JSON parse caching [@phbassin](https://github.com/phbassin) (abf0841)
- refactor: remove external dependencies (axios, he) (#1071) [@PhBassin](https://github.com/PhBassin) (25b47bc)
- refactor(scraper): remove he dependency and use internal decoder [@phbassin](https://github.com/phbassin) (25982b6)
- refactor(client): remove axios in favor of native fetch [@phbassin](https://github.com/phbassin) (1723d28)
- test(scraper): add failing test for puppeteer browser reuse and connection status [@phbassin](https://github.com/phbassin) (f859c53)
- test(client): add performance and memoization tests for homepage and admin tabs [@phbassin](https://github.com/phbassin) (a222ded)
- test(api): add failing tests for rate-limit jwt verification and 5xx details leak [@phbassin](https://github.com/phbassin) (a7db8de)
- add bmad skills [@phbassin](https://github.com/phbassin) (b960f2f)
- refactor: rename cinema/film to theater/movie in code, DB, and API (#1051) [@PhBassin](https://github.com/PhBassin) (63f43aa)
- refactor(client): rename remaining film variables to movie [@phbassin](https://github.com/phbassin) (c0bf236)
- refactor(client): rename Film→Movie in types, components, and files [@phbassin](https://github.com/phbassin) (ed2221c)
- refactor: rename cinema/film to theater/movie in code, DB, and API [@phbassin](https://github.com/phbassin) (1ed658d)
- test(client): cover calendar popover actions and remove dead calendar helper [@phbassin](https://github.com/phbassin) (a07f705)
- test(client): add calendar utility tests for add-to-calendar feature [@phbassin](https://github.com/phbassin) (e12826a)

### Performance

- perf(client): react performance optimizations for homepage and admin page (#1064) [@PhBassin](https://github.com/PhBassin) (b27b011)
- perf(api): consolidate Bolt performance optimizations (#1062) [@PhBassin](https://github.com/PhBassin) (a45705c)
- perf(api): parallelize migration and health check queries in system endpoints [@phbassin](https://github.com/phbassin) (b4bd8a7)
- perf(api): parallelize report queries and calculate statistics in single pass [@phbassin](https://github.com/phbassin) (0af4741)
- perf(scraper): parallelize total count and list queries in getScrapeReports [@phbassin](https://github.com/phbassin) (500a3d6)

### Documentation

- docs: reflect simplified .env (5 vars), removed profiles, microservice-only scraper [@phbassin](https://github.com/phbassin) (b6fee83)
- docs: update README deployment instructions to match new compose/env setup [@phbassin](https://github.com/phbassin) (f381163)
- docs: add useful comments to .env.example base variables [@phbassin](https://github.com/phbassin) (aa8358c)
- docs: split .env.example (prod 10 lines) + .env.dev.example (dev overrides) [@phbassin](https://github.com/phbassin) (0797599)
- docs: update .env.example to reflect new 5-vars docker-compose.yaml [@phbassin](https://github.com/phbassin) (13c6c66)
- docs(bmad): epic 9 retrospective and sprint status closure [@phbassin](https://github.com/phbassin) (f7e4dab)
- docs: mark E2E tests as mandatory in AGENTS.md [@phbassin](https://github.com/phbassin) (2787dbe)
- docs: update rate limit hot-reload description (immediate effect) [@phbassin](https://github.com/phbassin) (a52e021)
- docs: update story 9-1 artifacts — rate limiter finding resolved [@phbassin](https://github.com/phbassin) (23ea8da)
- docs(api): document /metrics and /api/scraper/status require auth [@phbassin](https://github.com/phbassin) (8cce02c)
- docs(bmad): mark story 9-2 as done (PR #1076) [@phbassin](https://github.com/phbassin) (86a8daa)
- docs(bmad): add Epic 9 security audit remediation + cleanup skill Step 0 [@phbassin](https://github.com/phbassin) (ea1cb90)
- docs(auth): update JWT expiry default from 24h to 1h in docs [@phbassin](https://github.com/phbassin) (25c3035)
- docs: add AI agent project context and artifacts [@phbassin](https://github.com/phbassin) (1c238d4)
- docs: generate comprehensive BMAD project documentation (exhaustive scan) [@phbassin](https://github.com/phbassin) (e240dcb)
- docs: update sprint-status and spec status after add-to-calendar merge [@phbassin](https://github.com/phbassin) (4ce4c58)
- docs: align TypeScript verification command with CI build mode [@phbassin](https://github.com/phbassin) (0b3ab6a)

### Maintenance

- chore(release): v4.7.0 (#1126) [@PhBassin](https://github.com/PhBassin) (9d07352)
- ci: add client and scraper TypeScript type-checks to CI workflow [@phbassin](https://github.com/phbassin) (3cdbe7f)
- chore(docker): simplify compose for Coolify, isolate monitoring env vars (#1119) [@PhBassin](https://github.com/PhBassin) (7faaf43)
- chore: simplify docker-compose for Coolify deployment [@phbassin](https://github.com/phbassin) (bc49a2d)
- chore(docker): isolate monitoring env vars in dedicated example file (#1118) [@PhBassin](https://github.com/PhBassin) (91b00ad)
- chore(docker): isolate monitoring env vars in dedicated example file [@phbassin](https://github.com/phbassin) (c491ca3)
- chore(docker): split monitoring stack into dedicated compose file (#1116) [@PhBassin](https://github.com/PhBassin) (686ae84)
- chore(docker): split monitoring stack into dedicated compose file [@phbassin](https://github.com/phbassin) (7bc25ee)
- chore: remove dead code rate-limiter.ts (unused in production) (#1113) [@PhBassin](https://github.com/PhBassin) (ff10f34)
- chore: suppress express-rate-limit validation noise in perf test [@phbassin](https://github.com/phbassin) (1fae460)
- chore: remove rate-limiter.test.ts [@phbassin](https://github.com/phbassin) (0f06050)
- chore: update tests to use express-rate-limit directly [@phbassin](https://github.com/phbassin) (e43247f)
- chore: move ipKeyGenerator and MutableConfig to rate-limit.ts [@phbassin](https://github.com/phbassin) (6792e00)
- chore: remove claudette MCP server from opencode config (#1108) [@PhBassin](https://github.com/PhBassin) (645fc2c)
- chore: remove claudette MCP server from opencode config [@phbassin](https://github.com/phbassin) (f53704e)
- chore(deps): patch transitive vulnerabilities (#1093) [@PhBassin](https://github.com/PhBassin) (851afa7)
- chore(deps): patch transitive vulnerabilities [@phbassin](https://github.com/phbassin) (753939e)
- chore(deps): consolidate weekly dependency updates (#1090) [@PhBassin](https://github.com/PhBassin) (e0073b4)
- chore(deps): consolidate weekly dependency updates [@phbassin](https://github.com/phbassin) (900c9c0)
- ci: remove E2E from CI and pre-push [@phbassin](https://github.com/phbassin) (ff45eaa)
- ci: fix E2E startup failure after JWT validation hardening [@phbassin](https://github.com/phbassin) (7e5136c)
- ci: pre-push auto-starts Docker stack for E2E if needed [@phbassin](https://github.com/phbassin) (823acff)
- ci: run E2E tests in pre-push (unconditional) [@phbassin](https://github.com/phbassin) (583ce18)
- ci: make E2E blocking again — no continue-on-error [@phbassin](https://github.com/phbassin) (4966407)
- ci: fix E2E — use init.sql, pre-push no longer runs e2e [@phbassin](https://github.com/phbassin) (cfd60af)
- ci: make E2E tests mandatory — CI job + pre-push hook [@phbassin](https://github.com/phbassin) (28419f4)
- chore: update sprint status — 9-1, 9-3 done, 9-4 in review [@phbassin](https://github.com/phbassin) (bb207f6)
- ci: run coverage check in pre-push hook [@phbassin](https://github.com/phbassin) (7f59754)
- chore(deps): add missing cookie-parser dependency for tests [@phbassin](https://github.com/phbassin) (4220a7e)
- chore(logger): remove tsbuildinfo from git, add to .gitignore [@phbassin](https://github.com/phbassin) (cb4b216)
- chore: remove unnecessary third-party dependencies (#1073) [@PhBassin](https://github.com/PhBassin) (616d6b8)
- chore(husky): setup husky for automated pre-push checks [@phbassin](https://github.com/phbassin) (95d9c6e)
- chore: ignore .codegraph directory [@phbassin](https://github.com/phbassin) (34f49a7)
- chore(deps): update lockfile after dependency removals [@phbassin](https://github.com/phbassin) (d657553)
- chore(deps): remove dotenv in favor of native Node.js --env-file [@phbassin](https://github.com/phbassin) (7d35994)
- chore: remove duplicate lock file [@phbassin](https://github.com/phbassin) (0f30639)
- chore(deps): update outdated client and scraper dependencies (#1065) (#1066) [@PhBassin](https://github.com/PhBassin) (478412f)
- chore(deps): update outdated client and scraper dependencies [@phbassin](https://github.com/phbassin) (a71b6fe)

## [4.6.7] - 2026-03-30

### Added

- feat(client): put search bar and day selector on the same line (#716) [@PhBassin](https://github.com/PhBassin) (6bcfa04)
- feat(client): put search bar and day selector on the same line [@phbassin](https://github.com/phbassin) (42d40fe)
- feat(client): vertical stacked date buttons in DaySelector [@phbassin](https://github.com/phbassin) (47c400a)
- feat(client): add Maintenant button to date selector (#712) [@PhBassin](https://github.com/PhBassin) (a8b5181)
- feat(client): add Maintenant button to home page DaySelector [@phbassin](https://github.com/phbassin) (2ca3aab)
- feat(client): add Maintenant button to date selector [@phbassin](https://github.com/phbassin) (52fbd6f)

### Fixed

- fix(client): shorten day labels to fit DaySelector on one line [@phbassin](https://github.com/phbassin) (f613512)
- fix(client): keep DaySelector on one line with horizontal scroll [@phbassin](https://github.com/phbassin) (2441e3d)

### Changed

- Optimize groupShowtimesByCinema and add Maintenant button features (#717) [@PhBassin](https://github.com/PhBassin) (700c3c9)
- test(client): add failing tests for Maintenant button on home page [@phbassin](https://github.com/phbassin) (36ac4eb)
- test(client): add failing tests for Maintenant button in date selector [@phbassin](https://github.com/phbassin) (3e3201f)
- ⚡ Bolt: Optimize groupShowtimesByCinema execution time (#699) [@PhBassin](https://github.com/PhBassin) (4fade42)

### Performance

- perf(server): optimize groupShowtimesByCinema algorithm [@PhBassin](https://github.com/PhBassin) (3d36099)

## [4.6.6] - 2026-03-30

### Changed

- Change actions permission from read to write [@PhBassin](https://github.com/PhBassin) (92a2603)

## [4.6.5] - 2026-03-30

### Fixed

- fix(ci): dispatch docker build after version tag push (#707) [@PhBassin](https://github.com/PhBassin) (f4d8071)
- fix(ci): dispatch docker build after version tag push [@phbassin](https://github.com/phbassin) (a8d9c6a)

### Changed

- Fix CI to dispatch Docker build after version tag push (#708) [@PhBassin](https://github.com/PhBassin) (209df15)
- Improve CI workflow for version bump and Docker build process (#705) [@PhBassin](https://github.com/PhBassin) (74bbe1c)

### Maintenance

- ci: bump version before docker build (#704) [@PhBassin](https://github.com/PhBassin) (85471b6)
- ci: bump version before docker build on main push [@phbassin](https://github.com/phbassin) (1bb7d5c)

## [4.6.4] - 2026-03-30

### Fixed

- fix(scraper): use deterministic showtime IDs to prevent duplication (#701) [@PhBassin](https://github.com/PhBassin) (a8aa9a5)
- fix(scraper): use deterministic showtime IDs to prevent duplication [@phbassin](https://github.com/phbassin) (bef8989)

### Changed

- Implement deterministic showtime IDs to prevent duplication (#702) [@PhBassin](https://github.com/PhBassin) (ce5a473)
- test(server): update system-queries test to include migration 022 [@phbassin](https://github.com/phbassin) (815ac8f)
- test(scraper): add failing test for deterministic showtime IDs [@phbassin](https://github.com/phbassin) (90e2724)

## [4.6.3] - 2026-03-29

### Changed

- Sync main into develop and revert CI version bump (#698) [@PhBassin](https://github.com/PhBassin) (a4588a6)
- Revert "fix(ci): bump version before Docker release builds" (#697) [@PhBassin](https://github.com/PhBassin) (0df5df5)
- Revert "fix(ci): bump version before Docker release builds" [@PhBassin](https://github.com/PhBassin) (d3f4222)

## [4.6.2] - 2026-03-29

### Fixed

- fix(ci): ensure release bump commit triggers Docker builds (#693) [@PhBassin](https://github.com/PhBassin) (4cd8cd6)
- fix(ci): remove skip-ci from release bump commit [@phbassin](https://github.com/phbassin) (81e229a)

### Changed

- Revert "Enhance CI with release order builds and version bump workflow" (#695) [@PhBassin](https://github.com/PhBassin) (672b907)
- Revert "Enhance CI with release order builds and version bump workflow" [@PhBassin](https://github.com/PhBassin) (5e095f7)
- Enhance CI with release order builds and version bump workflow (#694) [@PhBassin](https://github.com/PhBassin) (d9b587b)

## [4.6.1] - 2026-03-29

### Fixed

- fix(ci): bump version before Docker release builds (#690) [@PhBassin](https://github.com/PhBassin) (efd8828)

### Changed

- Enhance CI with release order builds and version bump workflow (#691) [@PhBassin](https://github.com/PhBassin) (93e594e)
- test(ci): add workflow guards for release-order builds [@phbassin](https://github.com/phbassin) (5d9b114)

## [4.6.0] - 2026-03-29

### Added

- feat(client): hide header on scroll down and reveal on scroll up (#687) [@PhBassin](https://github.com/PhBassin) (fe17ba6)
- feat(client): hide top header on downward scroll [@phbassin](https://github.com/phbassin) (3caf4af)

### Changed

- Improve performance and fix issues in film and role management (#688) [@PhBassin](https://github.com/PhBassin) (5233867)
- test(client): add scroll visibility tests for header [@phbassin](https://github.com/phbassin) (eb9eac1)

## [4.5.0] - 2026-03-28

### Added

- feat(scraper): extract and expose film screenwriters (#677) [@PhBassin](https://github.com/PhBassin) (4b2d0c9)
- feat(scraper): persist and expose film screenwriters [@phbassin](https://github.com/phbassin) (e2825c2)

### Fixed

- fix(film): preserve trailer_url from scrape to film page (#679) [@PhBassin](https://github.com/PhBassin) (63a5fe0)
- fix(scraper): preserve trailer_url during bulk scrape failures [@phbassin](https://github.com/phbassin) (1499bbe)
- fix(scraper): parse trailer URL from modern anchor markup [@phbassin](https://github.com/phbassin) (77db551)
- fix(scraper): refresh film page when trailer is missing [@phbassin](https://github.com/phbassin) (40fd8f7)
- fix(film): persist and expose trailer_url end-to-end [@phbassin](https://github.com/phbassin) (d975236)
- fix(client): afficher les premières séances disponibles (#674) [@PhBassin](https://github.com/PhBassin) (665a3b4)
- fix(client): select first available cinema date when today is empty [@phbassin](https://github.com/phbassin) (dae4e1c)

### Changed

- Improve performance and fix issues in film and role management (#681) [@PhBassin](https://github.com/PhBassin) (1de8404)
- ⚡ Bolt: [performance improvement] Parallelize permission fetching in getAllRoles (#680) [@PhBassin](https://github.com/PhBassin) (7ba02d0)
- ⚡ Bolt: [performance improvement] Parallelize permission fetching in getAllRoles [@PhBassin](https://github.com/PhBassin) (01f05d8)
- test(film): cover trailer_url persistence and UI rendering [@phbassin](https://github.com/phbassin) (e12942d)
- test(db): include migration 020 in migration inventory [@phbassin](https://github.com/phbassin) (8b3b3e8)
- test(scraper): add film page credits extraction tests [@phbassin](https://github.com/phbassin) (bca7a34)
- 🛡️ Sentinel: [MEDIUM] Replace loose parseInt with strict parseStrictInt (#675) [@PhBassin](https://github.com/PhBassin) (2d058ac)
- 🛡️ Sentinel: [MEDIUM] Replace loose parseInt with strict parseStrictInt [@PhBassin](https://github.com/PhBassin) (5fa81da)
- ⚡ Bolt: [performance improvement] Concurrent database stats queries (#672) [@PhBassin](https://github.com/PhBassin) (2e6a6a9)
- test(client): cover cinema fallback to first available showtimes [@phbassin](https://github.com/phbassin) (cc1669f)

### Performance

- perf(server): execute database stats queries concurrently [@PhBassin](https://github.com/PhBassin) (1f2fee9)

### Documentation

- docs(api): document film trailer_url field [@phbassin](https://github.com/phbassin) (eb80577)
- docs(agents): note migration inventory test update [@phbassin](https://github.com/phbassin) (4815281)
- docs(api): document screenwriters in film responses [@phbassin](https://github.com/phbassin) (16d43e7)

## [4.4.0] - 2026-03-26

### Added

- feat(scraper): HTTP 429 rate limit detection with resume capability (Phase 1 & 2) (#652) [@PhBassin](https://github.com/PhBassin) (383886b)
- feat(client): add resume button and details view to ReportsPage [@phbassin](https://github.com/phbassin) (98dd2ca)
- feat(api): add report details endpoint with attempts breakdown [@phbassin](https://github.com/phbassin) (03f838c)
- feat(api): add resume endpoint and scrape attempt queries [@phbassin](https://github.com/phbassin) (272176b)
- feat(scraper): implement resume mode to skip successful attempts [@phbassin](https://github.com/phbassin) (59e6386)
- feat(scraper): track per-cinema/per-date attempts in database [@phbassin](https://github.com/phbassin) (2265a36)
- feat(db): add scrape_attempts table for resume capability [@phbassin](https://github.com/phbassin) (4c5f3cd)
- feat(ui): display rate limited status with explanation and sync types [@phbassin](https://github.com/phbassin) (e530606)
- feat(db): add rate_limited status to scrape_reports [@phbassin](https://github.com/phbassin) (18a3b6f)
- feat(scraper): stop scraping immediately on HTTP 429 rate limit [@phbassin](https://github.com/phbassin) (97a94b4)
- feat(scraper): add HTTP error classification and rate limit detection [@phbassin](https://github.com/phbassin) (b918d9f)
- feat(roles): dynamic permission loading from database (#668) [@PhBassin](https://github.com/PhBassin) (47949a0)
- feat(ratelimits): add rate limit configuration management in admin interface (#664) [@PhBassin](https://github.com/PhBassin) (6395b29)
- feat(ratelimits): add frontend UI for rate limit management [@phbassin](https://github.com/phbassin) (dde37fc)
- feat(ratelimits): add API endpoints for rate limit management [@phbassin](https://github.com/phbassin) (2e253c8)
- feat(ratelimits): add database foundation for rate limit configuration [@phbassin](https://github.com/phbassin) (012a422)
- feat(client): add resume button and details view to ReportsPage [@phbassin](https://github.com/phbassin) (d4d5f2a)
- feat(api): add report details endpoint with attempts breakdown [@phbassin](https://github.com/phbassin) (1ff3e67)
- feat(api): add resume endpoint and scrape attempt queries [@phbassin](https://github.com/phbassin) (aa6ba98)
- feat(scraper): implement resume mode to skip successful attempts [@phbassin](https://github.com/phbassin) (be46d6a)
- feat(scraper): track per-cinema/per-date attempts in database [@phbassin](https://github.com/phbassin) (cf4024c)
- feat(db): add scrape_attempts table for resume capability [@phbassin](https://github.com/phbassin) (bc9d7fa)
- feat(ui): display rate limited status with explanation and sync types [@phbassin](https://github.com/phbassin) (0604247)
- feat(db): add rate_limited status to scrape_reports [@phbassin](https://github.com/phbassin) (c38c6d7)
- feat(scraper): stop scraping immediately on HTTP 429 rate limit [@phbassin](https://github.com/phbassin) (6b53583)
- feat(scraper): add HTTP error classification and rate limit detection [@phbassin](https://github.com/phbassin) (9e6a929)

### Fixed

- fix(scraper): exclude test files from production build [@phbassin](https://github.com/phbassin) (7e141a1)
- fix(client): add Rate Limits permissions to role management UI [@phbassin](https://github.com/phbassin) (7f7a2ba)
- fix(docker): preserve compiled rate-limits.js in config directory [@phbassin](https://github.com/phbassin) (52bc8c0)
- fix(docker): add AUTO_MIGRATE env var and fix config volume mount [@phbassin](https://github.com/phbassin) (7bfcaa8)
- fix(docker): mount only cinemas.json to avoid overriding compiled config files [@phbassin](https://github.com/phbassin) (175fe27)
- fix(scraper): exclude test files from production build [@phbassin](https://github.com/phbassin) (7782d6b)
- fix(client): enable automatic data refresh on tab focus (#654) [@PhBassin](https://github.com/PhBassin) (539cc3d)
- fix(client): enable automatic data refresh on tab focus [@phbassin](https://github.com/phbassin) (775007a)
- fix(pages): auto-navigate after password change (#645) [@PhBassin](https://github.com/PhBassin) (8e24393)
- fix(client): resolve merge conflicts and fix test timer issues [@phbassin](https://github.com/phbassin) (e8ca062)
- fix(pages): auto-navigate to homepage after 3 seconds on successful password change [@phbassin](https://github.com/phbassin) (8d4f61d)

### Changed

- Implement rate limit management and dynamic permissions in admin UI (#671) [@PhBassin](https://github.com/PhBassin) (d691233)
- 🛡️ Sentinel: [security improvement] Add length limit to film search query (#669) [@PhBassin](https://github.com/PhBassin) (1509d6b)
- Merge branch 'feat/651-rate-limit-detection-resume' of https://github.com/PhBassin/allo-scrapper into feat/651-rate-limit-detection-resume [@philippebassin](https://github.com/philippebassin) (5df3b54)
- test(scraper-service): add tests for triggerResume method [@phbassin](https://github.com/phbassin) (92a9621)
- test(client): add missing total_dates to ScrapeSummary mocks [@phbassin](https://github.com/phbassin) (cec71de)
- test(scraper): add tests for HTTP 429 detection and error classification [@phbassin](https://github.com/phbassin) (a43b65e)
- Hello! Jules here. I have implemented a security improvement by adding a length limit to the film search query. [@PhBassin](https://github.com/PhBassin) (8eb1e2a)
- 🛡️ Sentinel: [security improvement] Strict integer validation for API parameters (#662) [@PhBassin](https://github.com/PhBassin) (e0fcaf6)
- 🛡️ Sentinel: [security improvement] Strict integer validation for API parameters [@PhBassin](https://github.com/PhBassin) (18681d7)
- test(scraper-service): add tests for triggerResume method [@phbassin](https://github.com/phbassin) (359169d)
- test(client): add missing total_dates to ScrapeSummary mocks [@phbassin](https://github.com/phbassin) (aec0f08)
- test(server): update migration test to include 017 [@phbassin](https://github.com/phbassin) (55395a1)
- test(scraper): add tests for HTTP 429 detection and error classification [@phbassin](https://github.com/phbassin) (6d1424e)
- refactor(client): reduce password change redirect delay to 2 seconds [@phbassin](https://github.com/phbassin) (19ef1c7)

### Documentation

- docs: update Phase 2 resume capability documentation [@phbassin](https://github.com/phbassin) (c6faca1)
- docs: add HTTP 429 rate limit detection documentation [@phbassin](https://github.com/phbassin) (fea5be8)
- docs: update README and API documentation for rate limiting and roles… (#670) [@PhBassin](https://github.com/PhBassin) (baf054b)
- docs: update README and API documentation for rate limiting and roles management [@PhBassin](https://github.com/PhBassin) (57bb156)
- docs(ratelimits): add comprehensive documentation for rate limit management [@phbassin](https://github.com/phbassin) (bf92d4c)
- docs(code): document intentional duplication in shared utilities [@phbassin](https://github.com/phbassin) (dc54183)
- docs: update Phase 2 resume capability documentation [@phbassin](https://github.com/phbassin) (1cb1ce3)
- docs: add HTTP 429 rate limit detection documentation [@phbassin](https://github.com/phbassin) (b147132)

### Maintenance

- chore(config): add explicit types array and update moduleResolution for TypeScript 6.0 (#666) [@PhBassin](https://github.com/PhBassin) (0fb8610)
- chore(ci): bust Docker build cache [@phbassin](https://github.com/phbassin) (8d672f6)
- chore: remove unused code and template files (#656) [@PhBassin](https://github.com/PhBassin) (eaeb1bb)
- chore(utils): remove unused utility functions [@phbassin](https://github.com/phbassin) (47e5eea)
- chore(types): remove unused user type exports [@phbassin](https://github.com/phbassin) (7f1469f)
- chore(client): remove unused Vite template files [@phbassin](https://github.com/phbassin) (2841c90)
- chore(deps): remove unused dependencies and optimize bundle size (#647) [@PhBassin](https://github.com/PhBassin) (0a75b28)
- chore(deps): remove unused dependencies and optimize bundle size [@phbassin](https://github.com/phbassin) (f9bb4fa)
- chore: remove outdated GEMINI.md file from the repository [@phbassin](https://github.com/phbassin) (743d1ed)

## [4.3.0] - 2026-03-24

### Added

- feat(changelog): enhance automation with contributor attribution and structured releases (#641) [@PhBassin](https://github.com/PhBassin) (92f37d2)
- feat(changelog): add version link sorting and structured release notes [@phbassin](https://github.com/phbassin) (bc97e77)
- feat(changelog): add contributor attribution and breaking change extraction [@phbassin](https://github.com/phbassin) (1b38ddd)
- feat(client): optimize homepage vertical spacing (#624) [@PhBassin](https://github.com/PhBassin) (5c0c8bf)
- feat(client): remove labels from day selector and cinema links [@phbassin](https://github.com/phbassin) (1b785f1)
- feat(client): optimize homepage vertical spacing [@debian](https://github.com/debian) (aa27938)
- feat(restore): restore v4.2.0 features (Schedule Management) (#621) [@PhBassin](https://github.com/PhBassin) (f67a9ab)
- feat: sync with main (v4.2.0) [@opelkad](https://github.com/opelkad) (a8e0910)
- feat(client): optimize home page header space (#572) [@PhBassin](https://github.com/PhBassin) (895458b)
- feat(client): optimize home page header space [@philippebassin](https://github.com/philippebassin) (c1b5eee)

### Fixed

- fix(security): add rate limiting to health check endpoint (#639) [@PhBassin](https://github.com/PhBassin) (5b0bcdb)
- fix(security): fix healthCheckLimiter skip logic for test compatibility [@phbassin](https://github.com/phbassin) (ec6f602)
- fix(security): add explicit return statements to health endpoint handler [@phbassin](https://github.com/phbassin) (4fe9bf6)
- fix(security): add rate limiting and DB check to health endpoint [@phbassin](https://github.com/phbassin) (c79615e)
- fix(security): add JWT secret validation on application startup (#638) [@PhBassin](https://github.com/PhBassin) (98bd9e7)
- fix(security): sanitize error logging to prevent sensitive data exposure [@phbassin](https://github.com/phbassin) (9b0263b)
- fix(security): add rate limiting to scraper endpoints [@phbassin](https://github.com/phbassin) (61b1d3a)
- fix(test): update JWT verify in mock to use TEST_JWT_SECRET [@phbassin](https://github.com/phbassin) (d951897)
- fix(test): update test expectations for new JWT validation messages [@phbassin](https://github.com/phbassin) (0a6c246)
- fix(test): use JWT_SECRET without forbidden substring in test files [@phbassin](https://github.com/phbassin) (5a6bfd9)
- fix(test): use JWT_SECRET without forbidden substring [@phbassin](https://github.com/phbassin) (1b3176c)
- fix: use valid JWT_SECRET in vitest config for tests [@phbassin](https://github.com/phbassin) (b8f5efd)
- fix(test): update JWT_SECRET in tests to meet 32-char minimum [@phbassin](https://github.com/phbassin) (9090afd)
- fix(security): integrate JWT secret validation at startup [@phbassin](https://github.com/phbassin) (f9bded8)
- fix(security): implement JWT secret validation on startup [@phbassin](https://github.com/phbassin) (6122f64)
- fix(security): remove unsafe-inline and unsafe-eval from CSP (#637) [@PhBassin](https://github.com/PhBassin) (fb7206c)
- fix(test): correct app import in CSP validation test [@phbassin](https://github.com/phbassin) (3ed6963)
- fix(security): remove unsafe-inline and unsafe-eval from CSP [@phbassin](https://github.com/phbassin) (fc038e7)
- fix(client): use function form for manualChunks (Vite 8/Rolldown compat) [@philippebassin](https://github.com/philippebassin) (88c73a6)
- fix(client): stack search and day selector vertically [@philippebassin](https://github.com/philippebassin) (e501175)

### Changed

- Optimize homepage vertical spacing and enhance security features (#643) [@PhBassin](https://github.com/PhBassin) (d1f7008)
- test(security): add DB mocks to CSP tests for health endpoint [@phbassin](https://github.com/phbassin) (33bcf3b)
- test(config): add RATE_LIMIT_HEALTH_MAX to vitest env config [@phbassin](https://github.com/phbassin) (994de92)
- test(security): add tests for health check rate limiting and DB connectivity [@phbassin](https://github.com/phbassin) (19e5ffc)
- test(security): update JWT validator test assertions to match improved error messages [@phbassin](https://github.com/phbassin) (ed33d19)
- Potential fix for code scanning alert no. 49: Clear-text logging of sensitive information [@PhBassin](https://github.com/PhBassin) (195c52b)
- test(security): add JWT secret validation tests [@phbassin](https://github.com/phbassin) (3cf276b)
- test(security): add CSP validation test for unsafe-inline removal [@phbassin](https://github.com/phbassin) (2af71ac)
- revert: align develop with v4.1.2 [@opelkad](https://github.com/opelkad) (eae374c)
- test(db): update getAllRoles test for single JOIN query pattern [@philippebassin](https://github.com/philippebassin) (ccaf35d)
- ⚡ Bolt: Memoize visible tabs by permission checks (#573) [@PhBassin](https://github.com/PhBassin) (3bb8b57)

### Performance

- perf(scraper): phase 3 scraper overhaul — retry, throttling, deduplication, batching (#607) [@PhBassin](https://github.com/PhBassin) (5b0284c)
- perf(scraper): phase 3 scraper overhaul — retry, throttling, deduplication, batching [@philippebassin](https://github.com/philippebassin) (69b3a94)
- perf: phase 2 high-impact refactors (#604) [@PhBassin](https://github.com/PhBassin) (8e1ea02)
- perf: phase 2 high-impact refactors — code splitting, N+1 fix, query parallelization [@philippebassin](https://github.com/philippebassin) (58fc0b8)
- perf: phase 1 quick wins — compression, graceful shutdown, cleanup, error handling (#603) [@PhBassin](https://github.com/PhBassin) (82453dd)
- perf: phase 1 quick wins — compression, graceful shutdown, cleanup, error handling [@philippebassin](https://github.com/philippebassin) (0648506)
- perf(client): memoize visible tabs based on user permissions [@PhBassin](https://github.com/PhBassin) (81c97a5)

### Documentation

- docs(changelog): document changelog enhancement features [@phbassin](https://github.com/phbassin) (dd8666f)
- docs(security): document health check rate limiting and security features [@phbassin](https://github.com/phbassin) (266ffb3)
- docs(security): add JWT secret security guidelines to AGENTS.md [@phbassin](https://github.com/phbassin) (3b37362)
- docs(security): add JWT secret generation to README Quick Start [@phbassin](https://github.com/phbassin) (638b26e)
- docs(security): update .env.example JWT_SECRET documentation [@phbassin](https://github.com/phbassin) (ee27e9b)
- docs: document CSP security hardening [@phbassin](https://github.com/phbassin) (e508147)

### Maintenance

- chore: trigger CI re-run after JWT_SECRET fixes [@phbassin](https://github.com/phbassin) (9b61b84)
- chore: add new OpenCode agent definitions (#623) [@PhBassin](https://github.com/PhBassin) (276a488)
- chore: add new OpenCode agent definitions [@opelkad](https://github.com/opelkad) (bfab2ef)
- chore(deps): rollback develop to commit 895458b with dependency fixes (#611) [@PhBassin](https://github.com/PhBassin) (8ee8c77)
- chore(deps): fix dependency versions and rebuild native modules [@opelkad](https://github.com/opelkad) (7cd4941)

## [4.2.0] - 2026-03-18

### Added

- feat: add scrape job scheduling system (#530) (6401a10)
- feat(client): move Schedules tab between Cinemas and Rapports (28e810b)
- feat(scraper): add pub/sub for dynamic schedule reload (3fcc6af)
- feat(client): add human-friendly cron expression builder (24cd6d8)
- feat(scraper): read schedules from database (c871d6a)
- feat(client): add schedule management UI (fe35f60)
- feat(api): add scrape schedule CRUD endpoints (97fd0ce)
- feat(db): add scrape_schedules table and permissions (79a7548)

### Fixed

- fix(client): add schedule permissions to role management UI (1458d05)
- fix(client): change schedule modal time format from 12H to 24H (e0cb294)
- fix(client): remove duplicate rapports tab in admin navigation (f7d9703)
- fix(client): replace icon buttons with text buttons for delete confirmation (edf222e)
- fix(api): handle 204 No Content response in deleteSchedule (7457702)
- fix(docker): include optional deps in production for sharp bindings (c35d62f)
- fix(docker): regenerate lock file in container for native bindings (4730dc6)
- fix(ci): regenerate lock file on CI to fix native bindings (c3bdfd4)
- fix(ci): explicitly include optional dependencies (04c0415)
- fix(ci): use npm install instead of npm ci for optional deps (1f60162)
- fix: add fsevents to lock file for CI compatibility (901addb)
- fix(docker): update Dockerfile.scraper to use npm install --omit=optional (35e1dd6)
- fix(docker): use npm install --omit=optional instead of npm ci (9ab1b50)
- fix(docker): add --omit=optional to npm ci to skip Windows bindings (7ff8eb6)
- fix: remove unnecessary dependency on @rolldown/binding-win32-x64-msvc (da0d1d4)
- fix: remove unnecessary dependency on @rolldown/binding-win32-x64-msvc (36e8217)
- fix: remove @rolldown/binding-win32-x64-msvc from root dependencies (c0a78a4)
- fix(db): assign all permissions to admin role (6b279cb)
- fix: change default cron to 3 AM (752a7fe)
- fix(db): seed default schedule in migration (bb681bd)

### Changed

- Implement scrape job scheduling system with API and UI (#568) (6869f35)
- 🛡️ Sentinel: [HIGH] Fix missing password validation (#550) (86db8be)
- test: add unit tests for schedule queries (8e34a77)
- 🛡️ Sentinel: [HIGH] Fix missing password strength validation on registration (f76511a)
- ⚡ Bolt: [performance improvement] (#532) (6b8952b)
- ⚡ GHCR Cleanup: Refactor tag handling and improve version fetching logic (ca5135a)
- Remove temporary patch.diff file (aba57ef)
- ⚡ Bolt: [performance improvement] Optimize displayedCinemas calculation (552618f)
- Refactor tag classification functions for clarity (d45ee81)
- Change DRY_RUN to true for safe cleanup testing (b797d5c)

### Documentation

- docs(phase4): create OpenAPI/Swagger interactive API reference (#567) (2bdc15d)
- docs(phase4): create OpenAPI 3.0 spec and interactive API guide (0e55870)
- docs: comprehensive documentation audit and advanced guides - Phase 3 complete (#566) (385b6d6)
- docs: create 4 advanced guides for production scaling, custom parsers, RBAC, and rate limiting (8ce9a67)
- docs(admin): enhance admin panel and white-label documentation (ef9186e)
- docs(ref): enhance microservices health checks and job recovery documentation (56fb093)
- docs: create documentation roadmap and status matrix (4a44bea)
- docs(ref): add currency timestamps to 30+ reference docs (c68c186)
- docs(api): verify endpoint documentation accuracy (096ecbd)
- docs: reconcile E2E testing status (53cad29)
- docs(guides): add missing navigation hub (6d6876d)
- docs(ref): resolve database file duplication (4c37a76)

### Maintenance

- chore(deps): consolidate dependabot updates (#547) (a87fc61)
- chore(deps): consolidate dependabot updates (9016289)

## [4.1.2] - 2026-03-17

### Fixed

- fix: Make migration 013 idempotent and document migration best practices (#522) (943ce60)
- fix(db): make migration 013 idempotent to prevent fresh install failures (#520) (d1747c2)
- fix(db): make migration 013 idempotent to prevent fresh install failures (bc061d6)

### Changed

- 🛡️ Sentinel: [HIGH] Fix hardcoded database password fallback (#521) (c9bcf70)
- 🛡️ Sentinel: Remove hardcoded DB password fallback (51ab96a)

### Documentation

- docs: add database migration best practices section (bf4a753)

## [4.1.1] - 2026-03-17

### Added

- feat(ci): retag Docker images with semver tags on release (#510) (fb6a285)

### Fixed

- fix: Automate Docker image retagging and branch naming alignment (#518) (96f89f4)

### Documentation

- docs: align branch naming with conventional commit types (#513) (09c0da4)
- docs: add version label to PR checklist (efd02e5)
- docs: align branch naming with conventional commit types (78f26ad)

### Maintenance

- chore(scripts): add post-merge cleanup script (c1a9039)
- chore(scripts): add GHCR untagged image cleanup script (#517) (9ca54ef)
- chore(scripts): add GHCR untagged image cleanup script (0b4931c)
- ci: automate sync from main to develop after releases (#515) (4dd223a)
- ci: automate sync from main to develop after releases (8adc2dd)
- chore: sync main into develop (3f080b2)
- chore: sync main into develop (1e6b3fa)

## [4.1.0] - 2026-03-16

### Added

- feat(ci): add Docker image retagging to version-tag workflow (#511) (b679714)

## [4.0.2] - 2026-03-16

### Added

- feat(ci): add automated version tagging workflow (#494) (872aab7)
- feat(ci): add version tag workflow (974c7a4)

### Fixed

- fix(ci): resolve merge conflict markers in version-tag workflow (#508) (8f93cd3)
- fix(ci): resolve merge conflict markers in version-tag workflow (#507) (71c9283)
- fix(ci): resolve merge conflict markers in version-tag workflow (6091d53)
- fix(ci): fix version-tag workflow for stable tag handling (#506) (ab0f92e)
- fix(ci): filter non-semver tags and move stable tag on release (#505) (25bc5a1)
- fix(ci): filter non-semver tags and move stable tag on release (83d03f2)
- fix(ci): complete version-tag workflow fix (#503) (67ed1e9)
- fix(ci): explicitly checkout main branch in version-tag workflow (#502) (b5683aa)
- fix(ci): workflow_run branch filter fix (#500) (a856767)
- fix(ci): add explicit branch check to version-tag workflow (#499) (938f2e8)
- fix(ci): add explicit git auth for version-tag workflow (#497) (516e7f7)
- fix(ci): add explicit git auth for version-tag workflow push (2eba644)
- fix(ci): fix merge reference in sync-main-to-develop workflow (13c76e7)

### Changed

- Merge branch 'main' into develop (029a37a)
- test: verify automated version tagging workflow (#496) (483f6ca)

### Documentation

- docs: add version labeling to contribution checklist (8b93f80)
- docs(ci): document automated versioning workflow in AGENTS.md (1edaee9)

### Maintenance

- chore: sync develop to main (v4.0.1 + workflow fix) (#492) (4fa2c19)
- chore: bump version to v4.0.1 (1b266a4)
- chore: sync main into develop (9bc2966)

## [4.0.1] - 2026-03-16

### Fixed
- Fixed bug where POST `/api/scraper/trigger` fails with 500 when called without a body (e.g., "Scrap All" button)
- Added regression test to prevent future occurrences

## [4.0.0] - 2026-03-16

### Added

**Node.js 24 LTS:**
- Migrated from Node.js 22 to Node.js 24 LTS
- Updated engine requirements to `>=24.0.0`

**Scraper Microservice:**
- Replaced Playwright with Puppeteer for browser automation
- Migrated from `playwright-core` to `puppeteer-core`
- Added arm64 native support using Debian's `chromium-headless-shell` package

### Changed

**Docker Optimization:**
- Scraper image reduced from ~1.38 GB to ~1.20 GB (13% smaller)
- Simplified Dockerfile: removed architecture-conditional logic
- Using `chromium-headless-shell` from apt instead of `@puppeteer/browsers`

**OpenTelemetry:**
- Replaced auto-instrumentation with targeted packages
- Reduced dependency footprint

**TypeScript:**
- Disabled declaration and declarationMap generation for scraper

### Fixed

**Security:**
- Security vulnerability fixes from dependabot
- JWT expiry enforcement in route guards and Docker runtime
- RBAC permission count updated to 26 across 7 categories

**Performance:**
- Parallel DB queries in FilmService
- Optimized Docker build time with npm cache

### Database

**Migrations Added:**
- `008_permission_based_roles.sql` - Roles and permissions tables
- `009_add_roles_permission.sql` - Role management permission
- `010_remove_phantom_permissions.sql` - Clean non-canonical permissions
- `011_add_roles_crud_permissions.sql` - Full CRUD for roles
- `012_add_read_permissions.sql` - Read permissions for cinemas and users
- `013_add_cinema_source.sql` - Source column for cinema scraping strategy

## [3.0.1] - 2026-03-08

### Changed

**DevOps:**
- Added major version Docker tag pattern (`type=semver,pattern={{major}}`)
- Docker images now tagged with `:3` (tracks latest 3.x.x release) in addition to `:3.0.1` and `:3.0`

This is a DevOps-only release with no code changes, database migrations, or API modifications. The only change is enhanced Docker image tagging for easier version tracking.

## [3.0.0] - 2026-03-08

### Added

**White-Label Branding System:**
- Full branding customization (logo, favicon, colors, typography, footer)
- Dynamic theme CSS endpoint (`/api/theme.css`)
- Settings import/export as JSON
- Live preview in admin interface
- Admin settings UI at `/admin?tab=settings`

**Unified Admin Interface:**
- Tabbed navigation consolidating all admin functions (`/admin`)
- Five tabs: Cinemas, Reports, Users, Settings, System
- URL-based navigation with query params
- Replaced header "Rapports" link with "Admin" link
- Removed admin links from user dropdown menu

**Cinema Management:**
- Admin CRUD UI for cinemas (`/admin?tab=cinemas`)
- Real-time scraping progress with SSE
- URL persistence in database
- Edit cinema metadata (name, address, screen count, image)
- One-click cinema addition with validation

**User Management:**
- Admin CRUD UI for users (`/admin?tab=users`)
- Role-based access control (admin vs user)
- Password reset functionality (admin action)
- Self-service password change

**DevOps & Tooling:**
- Environment migration script (`scripts/migrate-env.sh`)
- Automated Docker tag cleanup (CI workflow)
- Enhanced CORS error messages for LAN access
- Production diagnostics script

### Fixed

**Critical Issues:**
- Google Fonts CSP violation blocking font loading (#330)
- Docker permission errors causing 500s on static assets
- JSON parsing cache performance for repeated queries
- Modal stale state when editing different items
- Zero value handling in cinema display
- CORS error messages missing blocked origin details

**Type Safety:**
- TypeScript compilation errors in test mocks
- Missing properties in context providers
- Type narrowing for literal unions

### Changed

- Admin navigation consolidated into single `/admin` route
- Reports page adapted to use URL search params
- Layout header simplified (removed multiple admin links)
- User dropdown streamlined (removed admin-specific links)

### Security

- Rate-limiting middleware applied to all mutation endpoints
- Input validation for cinema URLs (SSRF prevention)
- Improved CSP directives for Google Fonts

### Performance

- JSON parsing cache for database result mapping
- Batch inserts for weekly program updates (98x faster)
- Optimized Docker image build process

### Documentation

- Added CORS LAN access troubleshooting guide
- Updated AGENTS.md with new gotchas
- Enhanced WHITE-LABEL.md with troubleshooting
- Improved deployment networking documentation

### Tests

- Added 29 new client tests (admin tabs, reports, layout)
- Total coverage: 203 client tests + 600 server tests
- Enhanced test fixtures and mocking patterns

## [3.0.0-beta.4] - 2026-03-08

### Fixed
- Google Fonts CSP violation (#330)
- Docker user permission errors causing 500s on static assets
- Added production diagnostics script

## [3.0.0-beta.3] - 2026-03-XX

### Added
- Cinema management CRUD UI
- Real-time scraping progress tracking
- URL persistence for cinemas

## [3.0.0-beta.2] - 2026-03-01

### Changed
- Documentation restructure following Divio system
- Reorganized guides and reference materials

## [3.0.0-beta.1] - 2026-03-01

### Added
- White-label branding system foundation
- Settings management API
- Theme generation service

## [2.1.1] - 2026-03-01

### Fixed
- Security vulnerabilities
- Bug fixes

## [2.1.0] - 2026-02-28

### Added
- Additional features (details TBD)

## [2.0.0] - 2026-02-26

### Added
- Authentication system
- Security improvements

## [1.1.0] - 2026-02-24

### Added
- Scraper microservice
- Observability stack (Prometheus, Grafana, Loki, Tempo)

## [1.0.0] - 2026-02-19

### Added
- Initial stable release
- Core cinema scraping functionality
- REST API
- React frontend

[4.7.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.7...v4.7.0
[4.6.7]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.6...v4.6.7
[4.6.6]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.5...v4.6.6
[4.6.5]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.4...v4.6.5
[4.6.4]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.3...v4.6.4
[4.6.3]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.2...v4.6.3
[4.6.2]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.1...v4.6.2
[4.6.1]: https://github.com/PhBassin/allo-scrapper/compare/v4.6.0...v4.6.1
[4.6.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.5.0...v4.6.0
[4.5.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.1.2...v4.2.0
[4.1.2]: https://github.com/PhBassin/allo-scrapper/compare/v4.1.1...v4.1.2
[4.1.1]: https://github.com/PhBassin/allo-scrapper/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v4.0.2...v4.1.0
[4.0.2]: https://github.com/PhBassin/allo-scrapper/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/PhBassin/allo-scrapper/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.1...v4.0.0
[3.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0
[3.0.0-beta.4]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.3...v3.0.0-beta.4
[3.0.0-beta.3]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.2...v3.0.0-beta.3
[3.0.0-beta.2]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.1...v3.0.0-beta.2
[3.0.0-beta.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0-beta.1
[2.1.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PhBassin/allo-scrapper/releases/tag/v1.0.0
