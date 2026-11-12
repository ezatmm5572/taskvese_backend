# TaskVerse backend updates

## Member progress
Progress is stored on each TaskAssignment (not on the shared Task):
- progress: integer 0–100
- progressStatus: todo | in-progress | submitted | approved | rejected
- progressNote, submittedAt, reviewedAt, reviewedBy, reviewNote

### Member progress endpoint
PATCH /taskAssignment/progress
```json
{
  "taskId": "<task ObjectId>",
  "progress": 65,
  "progressStatus": "in-progress",
  "progressNote": "API integration is complete"
}
```
The authenticated member can update only their own assignment. They cannot set approved/rejected.

### Manager review endpoint
PATCH /taskAssignment/review
```json
{
  "taskId": "<task ObjectId>",
  "memberId": "<member ObjectId>",
  "decision": "approved",
  "reviewNote": "Looks good"
}
```
The caller must have task-management scope for the task; only submitted assignments can be reviewed. Approval sets progress to 100.

Task list/detail assignee summaries now expose progress and review metadata.

## Assignment-scoped discussion
POST /task/:taskId/comments accepts optional `taskAssignment` and `parentComment`.
GET /task/:taskId/comments?taskAssignment=<assignmentId> returns that assignment's thread.
Members can only post/view their own assignment thread; authorized task managers can view and reply. Existing task-wide comments remain supported when taskAssignment is omitted. Replies must reference a parent comment in the same task/thread.

## Granular task edit permissions
When Access Control is enabled, PATCH /task/:taskId checks each submitted field:
- title: task.editTitle
- description: task.editDescription
- startDate/endDate: task.editDates
- team/teamId: task.editTeam
- priority: task.editPriority
- tags: task.editTags
- recurrence: task.editRecurrence
- remindBefore: task.editReminder
- estimateMin: task.editEstimate
- subtask endpoints: task.editSubtasks
- archived: task.edit

Permission keys are included in access-control validation and can be used in presets/overrides. Existing behavior is retained while the global Access Control switch is off.

## Platform fixes
- CORS exposes Date, ETag and Content-Disposition.
- Unhandled server errors return HTTP 500 / INTERNAL_ERROR; production responses avoid leaking internal error messages.
- Vercel Hobby-compatible cron jobs invoke GET /api/cron/reminders daily at 07:00 UTC (09:00 Egypt time) and GET /api/cron/purge daily at 01:00 UTC (03:00 Egypt time). The reminders job is daily, not hourly, because Hobby permits only daily cron schedules. Configure CRON_SECRET in Vercel. The cron middleware checks the Bearer secret when configured.

## Still outstanding / not verified
- Full P0–P3 frontend handoff acceptance, including staging seed credentials, exact export/notification response contracts, and authenticated Playwright integration suite.
- Production deployment is not performed; verify Cloudinary credentials and cookie behavior in the deployed frontend domain before enabling cookie-only clients.
- Full P0–P3 frontend handoff acceptance, including staging seed credentials, exact export/notification response contracts, and Playwright integration suite.
- No production deployment was performed. GitHub Actions currently reports no workflow runs for this branch commit; run `npm ci`, `npm test`, syntax checks, and the frontend integration suite against staging before merging.

## Signed Cloudinary attachment uploads

The authenticated direct-upload flow is:
1. `POST /task/:taskId/attachments/sign` with the access Bearer token. Returns `uploadUrl`, `cloudName`, `apiKey`, `timestamp`, `folder`, `publicId`, `signature`, and `resourceType`.
2. Upload the file directly to the returned Cloudinary URL using multipart fields `file`, `api_key`, `timestamp`, `folder`, `public_id`, `overwrite=false`, and `signature`.
3. `POST /task/:taskId/attachments/confirm` with `{ "publicId": "...", "version": 123, "signature": "...", "name": "file.pdf" }`. The server verifies Cloudinary's response signature, confirms the asset folder and metadata through the Cloudinary Admin API, then creates the attachment record.

The server enforces task access, viewer restrictions, the 20-attachment task limit, and a 20 MB limit at confirmation. Cloudinary credentials must be configured as `CLOUD_NAME`, `API_KEY_CLOUDENARY`, and `API_SECRET_CLOUDENARY`. The existing multipart route remains available during frontend migration.

## Refresh-token cookie

Sign-in (password and Google) and refresh responses now set `taskverse_refresh` as an HttpOnly cookie. In production it is Secure and SameSite=None; locally it is SameSite=Lax and not Secure. Refresh middleware reads the cookie first and continues to accept a Bearer refresh token for compatibility. Logout clears the cookie. The response body still includes `refreshToken` during the frontend migration; clients should send `credentials: "include"` and move to cookie-only refresh before that legacy field is removed. CORS must list the exact frontend origin in `CORS_ORIGINS` and allow credentials.
