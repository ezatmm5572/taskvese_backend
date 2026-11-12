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
- Vercel cron jobs invoke GET /api/cron/reminders hourly and GET /api/cron/purge daily at 03:00 UTC. Configure CRON_SECRET in Vercel. The cron middleware checks the Bearer secret when configured.

## Still outstanding / not verified
- Signed direct-upload flow for Cloudinary (current multipart upload remains).
- HttpOnly refresh-token cookie migration (current response-body token contract retained for compatibility).
- Full P0–P3 frontend handoff acceptance, including staging seed credentials, exact export/notification response contracts, and Playwright integration suite.
- No production deployment was performed. GitHub Actions currently reports no workflow runs for this branch commit; run `npm ci`, `npm test`, syntax checks, and the frontend integration suite against staging before merging.
