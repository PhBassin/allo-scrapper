# @allo-scrapper/logger

Shared structured JSON logger for Allo-Scrapper based on Winston.

## Usage

### In a new package
1. Add `@allo-scrapper/logger` to your `package.json` dependencies.
2. Initialize and export your logger in `src/utils/logger.ts`:

```typescript
import { createLogger } from '@allo-scrapper/logger';

export const logger = createLogger('your-service-name');
```

## Features
- **Structured JSON** in production (for Loki/Grafana ingestion).
- **Colorized Simple Text** in development.
- Automatically respects `LOG_LEVEL` environment variable.
- Centralized configuration for consistent logging across microservices.
