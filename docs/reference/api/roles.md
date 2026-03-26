# Roles Management API

The Roles API provides full CRUD management for custom roles and their permission assignments.

🔒 **Authentication required** on all endpoints. Admins bypass all permission checks.

**Last updated:** March 25, 2026

---

## Table of Contents

- [List All Roles](#list-all-roles)
- [Get Role by ID](#get-role-by-id)
- [Create Role](#create-role)
- [Update Role](#update-role)
- [Delete Role](#delete-role)
- [Set Role Permissions](#set-role-permissions)
- [List All Permissions](#list-all-permissions)
- [Error Responses](#error-responses)

---

## List All Roles

```http
GET /api/roles
```

🔒 **Permission:** `roles:list`  
**Rate Limit:** 100 requests/15 minutes

Returns all roles with their assigned permissions.

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "admin",
      "description": "Administrateur — accès total",
      "is_system": true,
      "permissions": ["users:list", "users:create", "..."]
    },
    {
      "id": 2,
      "name": "operator",
      "description": "Opérateur — scraping et gestion des cinémas",
      "is_system": true,
      "permissions": ["scraper:trigger", "cinemas:create", "..."]
    }
  ]
}
```

### Example

```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

curl http://localhost:3000/api/roles \
  -H "Authorization: Bearer $TOKEN"
```

---

## Get Role by ID

```http
GET /api/roles/:id
```

🔒 **Permission:** `roles:read`  
**Rate Limit:** 100 requests/15 minutes

Returns a specific role with its full permission list.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Role ID |

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "operator",
    "description": "Opérateur — scraping et gestion des cinémas",
    "is_system": true,
    "permissions": [
      { "id": 5, "name": "scraper:trigger", "category": "scraper" },
      { "id": 6, "name": "scraper:trigger_single", "category": "scraper" },
      { "id": 7, "name": "cinemas:create", "category": "cinemas" }
    ]
  }
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Missing `roles:read` permission
- `404 Not Found`: Role does not exist

### Example

```bash
curl http://localhost:3000/api/roles/2 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Create Role

```http
POST /api/roles
```

🔒 **Permission:** `roles:create`  
**Rate Limit:** 100 requests/15 minutes

Creates a new custom role. System roles (`is_system = true`) cannot be created via API.

### Request Body

```json
{
  "name": "cinema_manager",
  "description": "Manages cinema data only"
}
```

### Validation Rules

| Field | Requirements |
|-------|-------------|
| `name` | Required, unique, lowercase, no spaces |
| `description` | Optional, plain text |

### Response

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "cinema_manager",
    "description": "Manages cinema data only",
    "is_system": false,
    "permissions": []
  }
}
```

**Errors:**
- `400 Bad Request`: Missing name or invalid format
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Missing `roles:create` permission
- `409 Conflict`: Role name already exists

### Example

```bash
curl -X POST http://localhost:3000/api/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "cinema_manager", "description": "Manages cinema data only"}'
```

---

## Update Role

```http
PUT /api/roles/:id
```

🔒 **Permission:** `roles:update`  
**Rate Limit:** 100 requests/15 minutes

Updates a custom role's name or description. System roles (`is_system = true`) cannot be modified.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Role ID |

### Request Body

```json
{
  "name": "cinema_editor",
  "description": "Edits cinema data only"
}
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "cinema_editor",
    "description": "Edits cinema data only",
    "is_system": false
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid field values
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Missing `roles:update` permission or attempting to modify a system role
- `404 Not Found`: Role does not exist
- `409 Conflict`: Name already taken by another role

### Example

```bash
curl -X PUT http://localhost:3000/api/roles/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "cinema_editor", "description": "Edits cinema data only"}'
```

---

## Delete Role

```http
DELETE /api/roles/:id
```

🔒 **Permission:** `roles:delete`  
**Rate Limit:** 100 requests/15 minutes

Deletes a custom role. System roles and roles with assigned users cannot be deleted.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Role ID |

### Response

**Success (204 No Content):**
```
(no body)
```

**Errors:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Missing `roles:delete` permission or attempting to delete a system role
- `404 Not Found`: Role does not exist
- `409 Conflict`: Role has users assigned to it

### Example

```bash
curl -X DELETE http://localhost:3000/api/roles/3 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Set Role Permissions

```http
PUT /api/roles/:id/permissions
```

🔒 **Permission:** `roles:update`  
**Rate Limit:** 100 requests/15 minutes

Replaces the full permission set for a role. The provided array becomes the new permission list (previous permissions not in the array are removed).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Role ID |

### Request Body

```json
{
  "permissions": [
    "cinemas:create",
    "cinemas:update",
    "cinemas:delete",
    "cinemas:read",
    "scraper:trigger_single"
  ]
}
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "cinema_manager",
    "permissions": [
      "cinemas:create",
      "cinemas:update",
      "cinemas:delete",
      "cinemas:read",
      "scraper:trigger_single"
    ]
  }
}
```

**Errors:**
- `400 Bad Request`: Unknown permission name in the list
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Missing `roles:update` permission
- `404 Not Found`: Role does not exist

### Example

```bash
curl -X PUT http://localhost:3000/api/roles/3/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": [
      "cinemas:create",
      "cinemas:update",
      "cinemas:read",
      "scraper:trigger_single"
    ]
  }'
```

---

## List All Permissions

```http
GET /api/roles/permissions
```

🔒 **Permission:** `roles:list`  
**Rate Limit:** 100 requests/15 minutes

Returns all available permissions grouped by category. Use this to populate a permission picker when creating or editing roles.

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      { "id": 1, "name": "users:list", "description": "List all users" },
      { "id": 2, "name": "users:create", "description": "Create new users" },
      { "id": 3, "name": "users:update", "description": "Modify existing users" },
      { "id": 4, "name": "users:delete", "description": "Delete users" },
      { "id": 5, "name": "users:read", "description": "View user details" }
    ],
    "scraper": [
      { "id": 6, "name": "scraper:trigger", "description": "Trigger global scraping job" },
      { "id": 7, "name": "scraper:trigger_single", "description": "Trigger scraping for a single cinema" },
      { "id": 8, "name": "scraper:schedules:list", "description": "View list of scrape schedules" },
      { "id": 9, "name": "scraper:schedules:create", "description": "Create new scrape schedules" },
      { "id": 10, "name": "scraper:schedules:update", "description": "Modify existing scrape schedules" },
      { "id": 11, "name": "scraper:schedules:delete", "description": "Delete scrape schedules" }
    ],
    "cinemas": [
      { "id": 12, "name": "cinemas:create", "description": "Add new cinemas" },
      { "id": 13, "name": "cinemas:update", "description": "Modify cinema information" },
      { "id": 14, "name": "cinemas:delete", "description": "Remove cinemas" },
      { "id": 15, "name": "cinemas:read", "description": "View cinemas list and details" }
    ],
    "settings": [
      { "id": 16, "name": "settings:read", "description": "View admin settings" },
      { "id": 17, "name": "settings:update", "description": "Modify application settings" },
      { "id": 18, "name": "settings:reset", "description": "Reset settings to defaults" },
      { "id": 19, "name": "settings:export", "description": "Export settings configuration" },
      { "id": 20, "name": "settings:import", "description": "Import settings configuration" }
    ],
    "reports": [
      { "id": 21, "name": "reports:list", "description": "List scraping reports" },
      { "id": 22, "name": "reports:view", "description": "View detailed scraping reports" }
    ],
    "system": [
      { "id": 23, "name": "system:info", "description": "View system information" },
      { "id": 24, "name": "system:health", "description": "View system health status" },
      { "id": 25, "name": "system:migrations", "description": "View database migration status" }
    ],
    "roles": [
      { "id": 26, "name": "roles:list", "description": "List all roles and permissions" },
      { "id": 27, "name": "roles:read", "description": "View specific role details" },
      { "id": 28, "name": "roles:create", "description": "Create new roles" },
      { "id": 29, "name": "roles:update", "description": "Modify roles and assign permissions" },
      { "id": 30, "name": "roles:delete", "description": "Delete custom roles" }
    ],
    "security": [
      { "id": 31, "name": "ratelimits:read", "description": "View rate limit configurations" },
      { "id": 32, "name": "ratelimits:update", "description": "Update rate limit configurations" },
      { "id": 33, "name": "ratelimits:reset", "description": "Reset rate limit configurations to defaults" },
      { "id": 34, "name": "ratelimits:audit", "description": "View rate limit change audit log" }
    ]
  }
}
```

### Example

```bash
curl http://localhost:3000/api/roles/permissions \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Responses

Standard error format for all endpoints:

```json
{
  "success": false,
  "error": "Error message"
}
```

### Common Error Codes

| HTTP Status | Cause |
|-------------|-------|
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Valid token but missing required permission |
| `404 Not Found` | Role with specified ID does not exist |
| `409 Conflict` | Role name already exists / role has assigned users |
| `429 Too Many Requests` | Rate limit exceeded |

---

## Notes

### System Role Restrictions

System roles (`is_system = true`) have the following restrictions:
- **Cannot be renamed or modified** (`PUT /api/roles/:id` returns 403)
- **Cannot be deleted** (`DELETE /api/roles/:id` returns 403)
- The `admin` system role always bypasses all permission checks regardless of its stored permissions

### Token Refresh After Permission Changes

Permissions are encoded in the JWT at login time. If a user's role permissions change, they must **log out and log back in** to receive an updated token with their new permissions.

---

[← Back to API Reference](./README.md)
