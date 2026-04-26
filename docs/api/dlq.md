# Dead-Letter Queue (DLQ) API

Failed scraper jobs are moved to a Redis sorted-set dead-letter queue (`scrape:jobs:dlq`). These endpoints allow admins to inspect and retry those jobs.

**Auth:** All endpoints require a valid session (`requireAuth`) and `scraper:trigger` permission (or system-admin role). Returns `401` with no session, `403` without permission.

**Admin alias:** All canonical `/api/scraper/dlq` paths are also reachable at `/api/admin/scraper/dlq` (same router instance, same guards). The alias was introduced per [Sprint Change Proposal 2026-04-26](../../_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-26.md). The canonical path remains authoritative.

---

## GET /api/scraper/dlq

List dead-lettered jobs, sorted by timestamp descending.

**Query parameters:**

| Param      | Default | Max | Description        |
|------------|---------|-----|--------------------|
| `page`     | 1       | –   | Page number        |
| `pageSize` | 50      | 50  | Results per page   |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "job_id": "report-42",
        "job": { "type": "scrape", "triggerType": "manual", "reportId": 42 },
        "failure_reason": "Redis timeout",
        "retry_count": 3,
        "timestamp": "2026-04-21T19:00:00.000Z",
        "cinema_id": "C0001",
        "org_id": "7"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 50
  }
}
```

Non-system-role callers only receive jobs belonging to their `org_id`.

---

## GET /api/scraper/dlq/:jobId

Retrieve a single dead-lettered job by its ID.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "job_id": "report-42",
    "job": { "type": "scrape", "triggerType": "manual", "reportId": 42 },
    "failure_reason": "Redis timeout",
    "retry_count": 3,
    "timestamp": "2026-04-21T19:00:00.000Z",
    "cinema_id": "C0001",
    "org_id": "7"
  }
}
```

**Response 404:** Job does not exist or is out-of-scope for the caller.

---

## POST /api/scraper/dlq/:jobId/retry

Remove the job from the DLQ and republish it to the main scrape queue.

**Response 200** (the republished entry with reset retry count):

```json
{
  "success": true,
  "data": {
    "job_id": "report-42",
    "job": { "type": "scrape", "triggerType": "manual", "reportId": 42, "retryCount": 0 },
    "failure_reason": "Redis timeout",
    "retry_count": 0,
    "timestamp": "2026-04-21T19:00:00.000Z",
    "cinema_id": "C0001",
    "org_id": "7"
  }
}
```

**Response 404:** Job does not exist or is out-of-scope.

---

## References

- PR #904 — DLQ infrastructure (Story 2.1)
- PR #919 — Redis reconnect hardening (Story 2.4)
- `server/src/services/redis-client.ts` — `listDlqJobs`, `getDlqJob`, `retryDlqJob`
- `server/src/routes/scraper.ts` — route handlers
