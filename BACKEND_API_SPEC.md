# TaskVerse - Backend API & Field Specification

## 1. Authentication & Sessions
- **`POST /auth/signIn`**: `{ email, password }`
  - Unconfirmed account -> `403` with `{ message: "Email not confirmed", code: "EMAIL_NOT_CONFIRMED" }`
  - Bad credentials -> `401` with `{ message: "Invalid password", code: "INVALID_PASSWORD" }`
  - Not found -> `404` with `{ message: "User not found", code: "USER_NOT_FOUND" }`
- **`POST /auth/refreshToken`**: Idempotent within 10s (returns cached pair if two browser tabs refresh simultaneously).
- **`GET /auth/sessions`**: `[Session]` with `current: true` flagged on caller's active device.
- **`DELETE /auth/sessions/:id`**: Revokes a specific device session.
- **`PATCH /auth/changeEmail`**: `{ password, newEmail }` -> verifies password, sends OTP to new address.
- **`DELETE /auth/account`**: `{ password }` -> verifies password, self-deletes account.

## 2. Members (`/member`)
- **`GET /member`**: Returns all members, with `teams: [{ teamId, name, role }]` populated.
- **`POST /member/createMember`**: Non-admins get `403 FORBIDDEN`. Invitation URL read from `process.env.FRONTEND_URL`.
- **`PATCH /member/:id`**: Update `fname, lname, gender, profilePicture` (self or system admin).
- **`DELETE /member/:id`**: System admin only (cannot delete self or the last system admin; unassigns tasks, removes from teams).
- **`POST /member/:id/resetPassword`**: System admin only; generates temporary password and sends email.
- **`PATCH /member/:id/active`**: `{ active: boolean }` deactivate/reactivate.

## 3. Teams (`/team`)
- Roles: canonical `admin | editor | viewer` (aliases accepted: `teamAdmin, teamMember, teamViewer`).
- Typo fix: Returns both `teamAdims` and virtual `teamAdmins`.
- **`GET /team/:id`**: Team details with `membersWithRoles[{ member, role }]` and `taskCounts`.
- **`POST /team/deleteTeam`**: Soft-deletes team (`deletedAt: Date`).
- **`POST /team/restore`**: `{ teamId }` restores within 30-day window.

## 4. Tasks (`/task`)
- Status Enum: `'toDo' | 'inProgress' | 'completed' | 'failed'` (aliases: `'complete' -> 'completed'`, `'fail' -> 'failed'`).
- Task Status: Automatically derived from assignments:
  - All completed -> `completed`
  - Any failed -> `failed` (Blocked)
  - Any inProgress -> `inProgress`
  - Else -> `toDo`
- **`POST /task/createTask`**: Atomic creation of task and assignees in a single call.
- **`GET /task`**: Supports `team, assignee, status, priority, tag, archived, due, q, page, limit, sort, order`. Returns populated assignees, counts (`subtaskCount`, `subtaskDone`, `commentCount`, `attachmentCount`, `loggedMin`), and derived `status`.
- **`GET /task/:id`**: Full task details with subtasks, comments, attachments, time entries, and activity log.
- **`PATCH /task/:id`**: Concurrency-safe (`If-Unmodified-Since` returns `409 CONFLICT`).
- **`DELETE /task/:id`**: Soft-delete (`deletedAt: Date`).
- **`POST /task/:id/restore`**: Restore within 30-day window.
- **`POST /task/bulkDelete` & `POST /task/bulkRestore`**: Max 200 tasks per request with per-ID status reporting.
- **`POST /task/:id/share` & `DELETE /task/:id/share`**: Public share link generation and revocation.
- **`GET /public/task/:token`**: Public read-only view (title, description, dates, subtasks - NO member emails).

## 5. Viewer Read-Only Enforcement (`403 VIEWER_READ_ONLY`)
Any team viewer who attempts mutating actions receives `403 VIEWER_READ_ONLY`:
- `POST /task/:id/comments`
- `PATCH /taskAssignment/taskStatusByMember`
- `POST /task/:id/subtasks`, `PATCH /subtasks/:id`, `DELETE /subtasks/:id`
- `POST /task/:id/attachments`
- `POST /task/:id/time`

## 6. Realtime & Sync
- **`GET /events`**: SSE connection with 25s heartbeat (`: heartbeat\n\n`) and `Last-Event-ID` replay of last 200 events.
- **`GET /changes?since=<ISO>`**: Delta polling fallback returning `{ now, tasks: { upserted, deleted }, teams, members, assignments }`.
- **`GET /export/tasks.csv`**: UTF-8 with BOM (`\uFEFF`) containing complete task breakdown.


## Access control (`/access`)

All endpoints require `Authorization: Bearer <accessToken>`. The same routes are mounted under `/api/access`.

- **`GET /access/me`**: Returns `{ enabled, role, permissions }` for the authenticated member. When disabled, the effective permission list contains the full fixed catalog; existing authorization rules remain active.
- **`GET /access/config`** (system admin only): Returns `{ enabled, rolePresets: { member, viewer } }`.
- **`PUT /access/config`** (system admin only): Accepts either/both `{ enabled: Boolean, rolePresets: { member: [key], viewer: [key] } }`.
- **`GET /access/users`** (system admin only): Returns members with saved overrides: `[{ memberId, allow, deny }]`.
- **`PUT /access/users/:memberId`** (system admin only): Accepts `{ allow: [key], deny: [key] }`. Both arrays empty deletes the override. Unknown keys and overlapping allow/deny entries return `422 VALIDATION_ERROR`; unknown members return `404 USER_NOT_FOUND`.
- **`GET /access/audit?limit=100`** (system admin only): Returns newest-first audit rows: `[{ _id, actorName, text, createdAt }]`.

Fixed permission keys:
`view.overview`, `view.tasks`, `view.teams`, `view.members`, `view.assignments`, `view.reports`,
`task.create`, `task.edit`, `task.delete`, `task.assign`, `task.status`, `task.comment`,
`task.attach`, `task.logTime`, `task.share`, `team.create`, `team.manage`, `team.delete`,
`member.invite`, `member.edit`, `report.export`.

The feature is disabled by default. When enabled, protected routes require both the existing resource/role authorization and the corresponding permission. System admins always have all permissions. Viewers remain read-only. Permissions are resolved from MongoDB on each protected request, so changes apply to existing access tokens. Team membership and role changes, preset changes, per-member overrides, and system-role changes are audited and trigger the access refresh event/feed.
