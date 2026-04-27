# Authentication API

## `POST /api/auth/login`

Authenticate a user and return a JWT.

Request:

```json
{
  "username": "admin",
  "password": "<password>"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {
      "id": 1,
      "username": "admin",
      "role_id": 1,
      "role_name": "admin",
      "is_system_role": true,
      "permissions": ["users:list", "scraper:trigger"]
    }
  }
}
```

Notes:

- system admins may also receive `scope: 'superadmin'` in the JWT payload
- org users may also receive `org_id` and `org_slug`
- fresh installs create username `admin`, but the password may be randomly generated and logged once during migrations

## `POST /api/auth/register`

Protected endpoint.

Requirements:

- authenticated user
- `users:create` permission

Request:

```json
{
  "username": "newuser",
  "password": "StrongPass123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": 2,
      "username": "newuser",
      "role_id": 2,
      "role_name": "operator"
    }
  }
}
```

## `POST /api/auth/change-password`

Protected endpoint for the currently authenticated user.

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "NewStrongPass123!"
}
```

## Current auth routes that do not exist

These older routes are not registered anymore:

- `POST /api/auth/logout`
- `GET /api/auth/me`
