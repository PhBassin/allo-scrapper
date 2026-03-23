## 🎉 Release {{VERSION}}

{{CHANGELOG_CONTENT}}

---

### 📦 Docker Images

Pull the latest images with version tags:

```bash
# Web application
docker pull ghcr.io/phbassin/allo-scrapper:{{VERSION}}

# Scraper microservice
docker pull ghcr.io/phbassin/allo-scrapper-scraper:{{VERSION}}
```

**Available tags:** `{{VERSION}}`, `{{MAJOR}}.{{MINOR}}`, `{{MAJOR}}`, `stable`, `latest`

---

### 🔄 Upgrade Notes

{{UPGRADE_NOTES}}

---

### 📚 Documentation

- [Installation Guide](https://github.com/PhBassin/allo-scrapper#installation)
- [Configuration Reference](https://github.com/PhBassin/allo-scrapper/blob/main/README.md#configuration)
- [API Documentation](https://github.com/PhBassin/allo-scrapper/blob/main/README.md#api-endpoints)
- [Troubleshooting](https://github.com/PhBassin/allo-scrapper/blob/main/AGENTS.md)

---

**Full Changelog**: https://github.com/PhBassin/allo-scrapper/compare/{{LAST_TAG}}...{{NEW_TAG}}
