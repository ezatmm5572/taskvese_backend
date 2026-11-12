# TaskVerse Backend — progress update

## Per-member assignment progress

Progress belongs to each `TaskAssignment`, not the shared Task document.

New fields:
- `progress`: integer 0–100 (default 0)
- `progressStatus`: `todo`, `in-progress`, `submitted`, `approved`, or `rejected`
- `progressNote`: optional member note
- `submittedAt`, `reviewedAt`, `reviewedBy`, `reviewNote`

### Update your own progress
`PATCH /taskAssignment/progress`

```json
{
  "taskId": "<task ObjectId>",
  "progress": 65,
  "progressStatus": "in-progress",
  "progressNote": "API integration is complete"
}
```

Members can update only their own assignment. They cannot set `approved` or `rejected`.

### Review submitted work
`PATCH /taskAssignment/review`

```json
{
  "taskId": "<task ObjectId>",
  "memberId": "<member ObjectId>",
  "decision": "approved",
  "reviewNote": "Looks good"
}
```

Only a manager authorized for the task can review, and the assignment must be in `submitted` state.

## Assignment-linked comments

The comment schema now supports optional `taskAssignment` and `parentComment` references while retaining existing task-wide comments. The existing comments API still needs to be extended to accept and enforce these fields before clients should rely on assignment-specific threads.

## Vercel scheduled jobs

- `/api/cron/reminders`: hourly
- `/api/cron/purge`: daily at 03:00 UTC

Configure `CRON_SECRET` in Vercel and verify the deployed cron handlers before relying on scheduled execution.

## Validation status

This branch has not been deployed. Run `npm ci`, `npm test`, and the integration suite against a staging environment before merging.
