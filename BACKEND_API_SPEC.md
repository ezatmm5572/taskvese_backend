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
