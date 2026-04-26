# @allo-scrapper/logger

Shared Winston-based logger used by the server, scraper, and SaaS package.

## Usage

```ts
import { createLogger } from '@allo-scrapper/logger'

export const logger = createLogger('my-service')
```

## Behavior

- honors `LOG_LEVEL`
- development output is human-readable
- production output is structured for log aggregation

## Workspace scripts

```bash
cd packages/logger
npm run build
npm test
npm run test:run
```
