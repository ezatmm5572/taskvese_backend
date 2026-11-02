# TaskVerse - Backend Technical Handoff & Architecture

**Prepared for:** Frontend Team & Backend Engineering  
**Repository:** `ezatmm5572/taskvese_backend`  
**OpenAPI Specification:** [docs/openapi.json](file:///c:/Users/ezatm/Desktop/vercel/TaskVerse_split/backend/docs/openapi.json)  
**Field Specification:** [BACKEND_API_SPEC.md](file:///c:/Users/ezatm/Desktop/vercel/TaskVerse_split/backend/BACKEND_API_SPEC.md)

---

## 1. Direct Answers to Blockers (B1 – B5)

### B1. Tasks & TaskAssignments Models and Routes
The complete schemas and all task routes have been implemented in the codebase:
- **`Task` Model** ([src/DB/models/task.js](file:///c:/Users/ezatm/Desktop/vercel/TaskVerse_split/backend/src/DB/models/task.js)):
  - Fields: `title`, `description` (markdown-lite, max 20,000 chars), `startDate`, `endDate`, `team` (ObjectId), `createdBy` (ObjectId), `priority` (`'' | 'low' | 'medium' | 'high' | 'urgent'`), `tags` (max 10, lowercased, deduplicated), `recurrence` (`'none' | 'daily' | 'weekly' | 'monthly'`), `remindBefore` (0–30 days), `estimateMin`, `completedAt`, `archived` (boolean), `deletedAt` (soft-delete), `subtasks` (`[{ _id, text, done, createdAt }]`), `shareToken`, `spawnedFrom`.
  - Indexes: `{ team: 1, deletedAt: 1 }`, `{ createdBy: 1 }`, `{ endDate: 1 }`, text index on `{ title, description, tags }`.
- **`TaskAssignment` Model** ([src/DB/models/taskAssignment.js](file:///c:/Users/ezatm/Desktop/vercel/TaskVerse_split/backend/src/DB/models/taskAssignment.js)):
  - `{ task, member, assignedBy, status, assignedAt, completedAt }` with unique index `{ task: 1, member: 1 }`.
  - Status canonical enum: `'toDo' | 'inProgress' | 'completed' | 'failed'` (legacy aliases `'complete'` and `'fail'` are automatically normalized).
  - Task-level status is dynamically derived: all completed -> `completed`; any failed -> `failed` (Blocked); any inProgress -> `inProgress`; else -> `toDo`.
- **All Routes**:
  - `GET /task`, `GET /task/:id`, `POST /task/createTask`, `PATCH /task/:id`, `DELETE /task/:id`, `POST /task/:id/restore`, `POST /task/bulkDelete`, `POST /task/bulkRestore`, `POST /task/:id/share`, `DELETE /task/:id/share`, `GET /public/task/:token`.
  - Subtasks: `POST /task/:id/subtasks`, `PATCH /task/:id/subtasks/:subId`, `DELETE /task/:id/subtasks/:subId`.
  - Comments: `GET /task/:id/comments`, `POST /task/:id/comments`, `PATCH /task/:id/comments/:commentId`, `DELETE /task/:id/comments/:commentId`.
  - Attachments: `GET /task/:id/attachments`, `POST /task/:id/attachments`, `DELETE /task/:id/attachments/:attId`.
  - Time Tracking: `GET /task/:id/time`, `POST /task/:id/time`, `DELETE /task/:id/time/:entryId`.

---

### B2. Staging Base URL & Seed Accounts
- **Staging Base URL**: Set via `process.env.VITE_API_BASE_URL` (e.g. `https://taskverse-backend.vercel.app` or local `http://localhost:3000`).
- **Database Seeder**: Run `npm run seed` or `node src/DB/seed.js`.
  - **Admin Account**: `admin@taskverse.com` / `TaskVerse@2026!`
  - **Pre-seeded Members (7)**:
    1. `alice.smith@taskverse.com` (Core Engineering Manager / Admin)
    2. `bob.jones@taskverse.com` (Core Engineering Editor)
    3. `carol.white@taskverse.com` (Core Engineering Editor)
    4. `david.brown@taskverse.com` (Core Engineering Editor)
    5. `eva.green@taskverse.com` (Core Engineering Editor)
    6. `frank.wright@taskverse.com` (Core Engineering **Viewer** -> used to test `403 VIEWER_READ_ONLY`)
    7. `grace.hopper@taskverse.com` (Product & Design Editor)
  - **Pre-seeded Teams (2)**:
    1. `Core Engineering` (Admin: Alice; Viewer: Frank; Editors: Bob, Carol, David, Eva)
    2. `Product & Design` (Admin: System Admin; Editors: Alice, Frank, Grace)

---

### B3. Section 8: Known Issue – Google Accounts and Protected Routes
- **Cause**: In previous iterations, the database lookup in the authentication middleware contained:
  ```js
  filter: { _id: decoded.id, provider: ProviderEnum.SYSTEM }
  ```
  When users signed up via Google OAuth (`provider: 'google'`), their JWT token contained a valid decoded payload, but the query returned `null`, producing `401 Member not found. Please sign up.`.
- **Resolution**: Removed `provider: ProviderEnum.SYSTEM` from `authonticaation` middleware ([src/commn/middleware/authontication.js](file:///c:/Users/ezatm/Desktop/vercel/TaskVerse_split/backend/src/commn/middleware/authontication.js#L54-L65)). Both Google OAuth and System password accounts can seamlessly authenticate on all protected routes.

---

### B4. Confirmation of [ASSUMED] Routes
1. **`PATCH /task/:id`**: Confirmed. Accepts updates for `title`, `description`, `startDate`, `endDate`, `team`, `priority`, `tags`, `recurrence`, `remindBefore`, `estimateMin`, `archived`. Supports concurrency precondition `If-Unmodified-Since` (returns `409 CONFLICT`).
2. **`POST /taskAssignment/removeMemberFromTask`**: Confirmed. Accepts `{ taskId, memberId }` or `{ taskId, memberIds: [] }`. Restricted to Task Managers (SA, TCr, TMgr).
3. **Task Status Enum**: Confirmed `'toDo' | 'inProgress' | 'completed' | 'failed'`. The backend accepts incoming `'complete'` and `'fail'` from existing frontend clients and standardizes them.

---

### B5. Realtime Hosting Architecture (SSE vs Managed)
1. **Delta Polling Fallback (`GET /changes?since=<ISO>`)**:
   Designed for Vercel Serverless where connections cannot stay open indefinitely. Returns cheap JSON delta of updated/deleted IDs.
2. **Native SSE (`GET /events`)**:
   Fully implemented with a 25-second heartbeat comment (`: heartbeat\n\n`) and `Last-Event-ID` ring-buffer replay (last 200 events). Supported on long-running node servers (Render, Railway, Docker, or Dedicated VPS).
3. **Managed Service Plug-in**:
   If deploying frontend on Vercel without a persistent node container, use Pusher / Supabase Realtime / Upstash Redis Pub/Sub. The channel convention is:
   - Workspace/Team: `team-${teamId}`
   - User Notifications: `user-${userId}`

---

## 2. Section 2 Contract Fixes Implementation Summary

1. **Unconfirmed Account**: `POST /auth/signIn` returns `403` with `{ message: "Email not confirmed", code: "EMAIL_NOT_CONFIRMED" }`.
2. **Status Codes & UPPER_SNAKE Codes**: 401 for bad password / expired token, 403 for forbidden actions, 404 for missing entities, 409 for conflict, 422 for validation, 429 for rate limit.
3. **Invitation Email Link**: Configured via `process.env.FRONTEND_URL` (falling back to `APP_URL`).
4. **`teamAdims` Typo**: Preserved original database property while adding a virtual `teamAdmins` that returns the identical array.
5. **`/auth/refreshToken` Idempotency**: Implemented 10-second token pair caching in Redis (`recent_refresh_key`). Two browser tabs refreshing concurrently receive the identical new token pair instead of revoking each other.
6. **Rate Limiting**: `generalLimiter` extracts and decodes the JWT user ID from the `Authorization` header to allow 600 requests / 15 min for authenticated users, while keeping anonymous IP-based limits at 300 / 15 min and `/auth/*` at 20 / 15 min.
7. **CORS**: `credentials: true` uses an explicit, validated origin list from `CORS_ORIGINS` and never `*`.
8. **Response Envelope**: Standardized to `{ message, data, meta? }`. Passwords, token hashes, and internal secrets are excluded from JSON transformations.
9. **`GET /member`**: Populates `teams: [{ teamId, name, role }]` with team names and normalized roles.
10. **Timestamps**: All schemas enable `{ timestamps: true }` generating `createdAt` and `updatedAt`.

---

## 3. Viewer Read-Only Enforcement (`403 VIEWER_READ_ONLY`)
Strictly enforced at the service level on:
- `POST /task/:id/comments` -> `403 VIEWER_READ_ONLY`
- `PATCH /taskAssignment/taskStatusByMember` -> `403 VIEWER_READ_ONLY`
- `POST /task/:id/subtasks` -> `403 VIEWER_READ_ONLY`
- `POST /task/:id/attachments` -> `403 VIEWER_READ_ONLY`
- `POST /task/:id/time` -> `403 VIEWER_READ_ONLY`

---

## 4. Environment Variables Checklist

Add these in your hosting environment (`.env` or dashboard settings):
```bash
# Database
DB_URI="mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/taskManagementSystem?retryWrites=true&w=majority"
PORT=3000
NODE_ENV="production"

# Redis
UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxx"

# Secrets
JWT_SECRET="your-long-secure-jwt-secret"
HASH_SALT=12

# URLs & CORS
FRONTEND_URL="https://taskverse-frontend-ochre.vercel.app"
CORS_ORIGINS="https://taskverse-frontend-ochre.vercel.app,http://localhost:5173,http://localhost:5180"

# Cloudinary
CLOUD_NAME="your-cloudinary-name"
API_KEY_CLOUDENARY="your-cloudinary-key"
API_SECRET_CLOUDENARY="your-cloudinary-secret"

# Cron & Push
CRON_SECRET="your-cron-secret"
VAPID_PUBLIC_KEY="your-vapid-public-key"
```
