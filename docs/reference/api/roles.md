# Roles API

All routes are protected.

## `GET /api/roles/permissions`

Requires `roles:list`.

Returns the flat list of all permission records.

## `GET /api/roles/permission-categories`

Requires `roles:list`.

Returns category labels with English and French display names.

## `GET /api/roles`

Requires `roles:list`.

Returns all roles with nested permission objects.

## `GET /api/roles/:id`

Requires `roles:read`.

## `POST /api/roles`

Requires `roles:create`.

Request:

```json
{
  "name": "cinema_manager",
  "description": "Manages cinema data"
}
```

## `PUT /api/roles/:id`

Requires `roles:update`.

Current implementation updates name and description. It does not block updates solely because `is_system=true`.

## `DELETE /api/roles/:id`

Requires `roles:delete`.

Current implementation blocks deletion when:

- role is a system role
- users are still assigned to the role

## `PUT /api/roles/:id/permissions`

Requires `roles:update`.

Current request body uses permission IDs:

```json
{
  "permission_ids": [1, 2, 3]
}
```

## Current route note

The permissions listing route is `/api/roles/permissions`, not `/api/permissions`.
