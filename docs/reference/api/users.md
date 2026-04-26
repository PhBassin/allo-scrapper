# Users API

All routes are protected and permission-gated.

## `GET /api/users`

Requires `users:list`.

Query params:

- `limit` default `100`, capped at `100`
- `offset` default `0`

Returned user shape:

```json
{
  "id": 1,
  "username": "admin",
  "role_id": 1,
  "role_name": "admin",
  "created_at": "..."
}
```

## `GET /api/users/:id`

Requires `users:list`.

## `POST /api/users`

Requires `users:create`.

Current request body uses `role_id`, not a role name string:

```json
{
  "username": "newuser",
  "password": "StrongPass123!",
  "role_id": 2
}
```

Username rules:

- alphanumeric only
- 3 to 15 characters

## `PUT /api/users/:id/role`

Requires `users:update`.

Current request body:

```json
{
  "role_id": 1
}
```

Safety guard:

- cannot demote the last admin user

## `POST /api/users/:id/reset-password`

Requires `users:update`.

Generates and returns a new random password once.

## `DELETE /api/users/:id`

Requires `users:delete`.

Safety guards:

- cannot delete your own account
- cannot delete the last admin user
