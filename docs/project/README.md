# Project Documentation

Project meta-documentation, changelog, planning, and AI agent instructions.

## 📑 Contents

### [Changelog](./changelog.md)
Version history and release notes.

**What you'll learn:**
- Version history
- Feature additions
- Bug fixes
- Breaking changes
- Migration guides between versions

**Format:**
- Organized by version (semantic versioning)
- Categorized changes (Added, Changed, Fixed, Removed)
- Release dates

**Best for:** Understanding project evolution, planning upgrades

---

### [Security](./security.md)
Security policies and vulnerability reporting.

**What you'll learn:**
- Security reporting process
- Known security issues
- Security best practices
- Supported versions
- Disclosure policy

**Best for:** Security researchers, production deployments

---

### [AI Agent Instructions](./agents.md)
Guidelines for AI coding agents (Claude, Copilot, Cursor, etc.).

**What you'll learn:**
- Mandatory workflow (Issue → Branch → TDD → Commit → local CR → GP gate → explicit-order PR)
- Test-Driven Development (TDD) requirements
- Conventional Commits format
- Atomic commits strategy
- Branch-from-`develop` workflow
- White-label system guidelines

**Best for:** AI agents, contributors using AI tools, understanding project standards

---

### [White-Label Roadmap](./white-label-plan.md)
White-label feature implementation plan and status.

**What you'll learn:**
- Feature roadmap
- Implementation phases
- Current status
- Future enhancements
- Architecture decisions

**Phases:**
- Phase 1: Core settings (✅ Complete)
- Phase 2: Admin panel (✅ Complete)
- Phase 3: Advanced features (Planned)

**Best for:** Understanding white-label capabilities, planning customizations

---

## Project Information

### Repository
- **GitHub**: https://github.com/yourusername/allo-scrapper
- **Issues**: https://github.com/yourusername/allo-scrapper/issues
- **Discussions**: https://github.com/yourusername/allo-scrapper/discussions

### Versioning
We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### License
MIT License - See [LICENSE](../../LICENSE) file

### Contributing
See [Contributing Guide](../guides/development/contributing.md)

---

## Project Structure

```
allo-scrapper/
├── server/          # Express.js backend
├── scraper/         # Standalone scraper microservice
├── client/          # React frontend
├── docker/          # Docker/monitoring configs
├── e2e/             # Playwright E2E tests
├── scripts/         # Automation scripts
├── migrations/      # Database migrations
└── docs/            # Documentation (you are here)
```

---

## Quick Links

- [Getting Started](../getting-started/) - New to Allo-Scrapper?
- [Contributing Guide](../guides/development/contributing.md) - Want to contribute?
- [API Reference](../reference/api/) - Need API docs?
- [Troubleshooting](../troubleshooting/) - Having issues?

---

[← Back to Documentation](../README.md)
