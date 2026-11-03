# Access control implementation

This backend implements the frontend Access Control specification in `ACCESS_CONTROL_FRONTEND_SPEC.md`.

## API
- `GET /access/me` — effective permissions for the authenticated member.
- `GET /access/config` — system-admin-only configuration.
- `PUT /access/config` — system-admin-only master switch and role presets.
- `GET /access/users` — system-admin-only list of people with overrides.
- `PUT /access/users/:memberId` — system-admin-only per-person allow/deny overrides.
- `GET /access/audit?limit=100` — system-admin-only audit history.

All routes are also mounted under `/api`.

## Behavior
- Access control starts disabled. The singleton `accessConfig` document is created lazily with the default presets.
- When disabled, existing authorization remains in force and the effective permission list returned by `/access/me` is the full catalog.
- When enabled, protected endpoints require both existing resource authorization and the configured permission.
- A deny override wins over an allow override and the role preset.
- System admins always resolve to all permissions.
- A member whose team role is `viewer` in every team they belong to resolves to `viewer`; a viewer's mutations remain read-only.
- Access is resolved from MongoDB on every protected request, so changes affect already-issued tokens.
- Removing a member also removes their access override.
- Team membership additions/removals and team-role changes write `role.changed` audit entries and send a targeted `access.updated` event when the affected member's effective role may change.
- Applying a task template is protected by `task.create`.
- Both CSV and report exports are scoped to the caller's existing team/creator/assignment visibility.

## Role changes
`PATCH /member/:id` accepts `role: "admin" | "member"` for a system admin. A user cannot change their own system role. The last system admin cannot be demoted or deleted (`409 LAST_ADMIN`). Role changes are recorded in access audit history.

## Data collections
- `accessConfig`: one global config document (`_id: "global"`).
- `accessOverrides`: one document per member with overrides.
- `accessAudits`: append-only audit records.

No migration is required. Existing member/team role fields remain the source of truth.

## Frontend integration
After sign-in, call `GET /access/me`. Call it again when the changes feed reports an access update. Use the returned `enabled`, `role`, and `permissions` to render the UI, but never treat frontend hiding as security enforcement.

## Deployment notes
No new environment variables are required. Ensure the deployed MongoDB user can create and write the three access-control collections. Test with access control disabled first, then enable it in staging and run the frontend integration suite. JavaScript syntax and relative-import checks were run during implementation; the full runtime test suite still needs to be run after dependencies are installed.

## Admin hierarchy / shared workspace visibility

System admins created by another system admin now resolve to the same admin hierarchy scope as their primary admin. The scope is derived from the existing `members.addedBy` relationships; no database migration or member deletion is required.

- Admins in the same hierarchy can list and manage members created by admins in that hierarchy.
- Tasks created by any member in the hierarchy are visible to its admins, including tasks created by a member who has the `task.create` permission.
- Teams created by admins or delegated members in the hierarchy are visible to its admins. Hierarchy admins can manage those teams.
- Assignment lists, dashboard task totals, templates, global search, delta sync, and CSV/report exports use the same hierarchy scope.
- A member can create a team when granted `team.create`; the endpoint no longer requires the system-level `admin` role separately. Team-level management remains scoped to the creator/team managers and the admin hierarchy.

The hierarchy is calculated from existing `addedBy` links at request time. Existing records are retained as-is.
