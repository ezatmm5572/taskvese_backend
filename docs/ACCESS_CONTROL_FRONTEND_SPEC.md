**# Access control (roles + permissions) - backend specification**



**\*\*For:\*\*** the backend developer. **\*\*From:\*\*** the frontend team.

**\*\*Status:\*\*** the frontend console is finished (admin screen "Access control") and tested against a mock

(\`tests/mock-backend/server.mjs\`, search for \`access control\`). **\*\*Nothing below exists on the real server yet.\*\***

Until it does, the screen shows "The backend does not support access control yet" and nothing is enforced.



The UI only hides or disables things. \*\*The server is the security boundary: every route listed in section 5 must

check the permission itself and answer \`403 PERMISSION_DENIED\`.\*\* Never trust the browser.



\---



**## 1. What the admin can do (the product)**



1\. **\*\*Master switch\*\*** (ON / OFF) for the whole feature.

   - OFF: today's rules apply exactly as now (system admin / team manager / editor / viewer). Custom presets and per-person overrides are **\*\*kept but ignored\*\***.

   - ON: every request is also checked against the caller's effective permissions (section 3).

2\. **\*\*Roles\*\*** per person: **\*\*Admin\*\***, **\*\*Member\*\***, **\*\*Viewer\*\*** (read-only).

3\. **\*\*Role presets\*\***: for Member and Viewer, tick exactly which permissions the role has. Admin always has everything.

4\. **\*\*Per-person overrides\*\***: for one person, each permission can be \`Default\` (follow the role) / \`Allow\` (extra) / \`Block\` (removed).

5\. **\*\*Preview as\*\***: the admin can look at the app as another person (UI only, no backend call).

6\. **\*\*History\*\***: who changed what, and when.



**## 2. Roles**



\| Role | Meaning | Source of truth |

\|---|---|---|

\| \`admin\` | System admin. All permissions, cannot be restricted. | \`member.role === 'admin'\` (already exists) |

\| \`viewer\` | Read-only. | The person is \`viewer\` in **\*\*every\*\*** team they belong to (and is not a system admin) and belongs to at least one team. Team role \`viewer\` already exists. |

\| \`member\` | Everyone else. | default |



The frontend changes roles with calls that already exist: system admin via \`PATCH /member/:id { role: 'admin'|'member' }\`

(**\*\*please support \`role\` there, admins only\*\*** - not in the current document) and viewer via

\`POST /team/updateMemberRoleInTeam { role: 'viewer'|'editor' }\` for each team. So you only need to *\*derive\** the role as above.



Guard rails: an admin cannot change or delete **\*\*their own\*\*** role; the **\*\*last admin\*\*** can never be demoted or deleted (\`409 LAST_ADMIN\`).



**## 3. Permission keys (fixed catalog - use these exact strings)**



\| Group | Key | Meaning |

\|---|---|---|

\| See | \`view\.overview\` | Overview page |

\| | \`view\.tasks\` | Tasks list / board / calendar |

\| | \`view\.teams\` | Teams page |

\| | \`view\.members\` | Members directory |

\| | \`view\.assignments\` | "My assignments" |

\| | \`view\.reports\` | Dashboards, burn-down, workload, time reports |

\| Tasks | \`task.create\` | Create tasks (also from templates) |

\| | \`task.edit\` | Edit title/dates/priority/tags/subtasks/schedule/estimate |

\| | \`task.delete\` | Delete (soft delete) and bulk delete, restore |

\| | \`task.assign\` | Add / remove assignees |

\| | \`task.status\` | Change own assignment status, bulk status |

\| | \`task.comment\` | Write / delete own comments |

\| | \`task.attach\` | Upload / delete own attachments |

\| | \`task.logTime\` | Log / delete own time entries |

\| | \`task.share\` | Create / revoke public share links |

\| Teams & people | \`team.create\` | Create teams |

\| | \`team.manage\` | Add/remove members, change team roles, rename |

\| | \`team.delete\` | Delete / restore teams |

\| | \`member.invite\` | Create member accounts |

\| | \`member.edit\` | Rename, deactivate, reset password, delete, change system role |

\| Data | \`report.export\` | CSV / PDF exports |



\`access.manage\` (this console) is **\*\*not\*\*** a key: only a system admin can use \`/access/\*\`, always.



**### 3.1 Default presets (used until an admin changes them)**



\- **\*\*admin\*\***: all keys (not editable).

\- **\*\*member\*\***: \`view\.overview view\.tasks view\.teams view\.members view\.assignments view\.reports task.create task.edit task.status task.comment task.attach task.logTime task.share report.export\`

\- **\*\*viewer\*\***: \`view\.overview view\.tasks view\.teams view\.members view\.assignments\`



**### 3.2 Resolution (must be exactly this)**



\`\`\`

role      = admin | viewer | member            (section 2)

if role == admin                  -> everything allowed

set       = preset[role]

set      += overrides[user].allow

set      -= overrides[user].deny               (Block wins over Allow and over the preset)

allowed(key) = access.enabled == false  ? true  : set.has(key)

\`\`\`

When \`enabled == false\` the **\*\*existing\*\*** authorization rules still apply (system admin / team manager / viewer).

When \`enabled == true\` a request needs **\*\*both\*\***: the existing rule **\*\*and\*\*** the permission. (A permission never lets someone

do something the existing rules forbid; e.g. \`task.delete\` does not let a member delete another team's task.)

Viewer team-role enforcement (\`403 VIEWER_READ_ONLY\`) stays as is.



**## 4. Data model**



\`\`\`js

AccessConfig (single document)

  { \_id, enabled: Boolean (default false),

    presets: { member: [key], viewer: [key] },      // admin is implicit

    updatedAt, updatedBy }



AccessOverride (one per person that has any override)

  { \_id, member: ObjectId (unique), allow: [key], deny: [key], updatedAt, updatedBy }



AccessAudit (append-only)

  { \_id, actor: ObjectId, action: 'access.enabled'|'access.disabled'|'preset.changed'|'override.changed'|'role.changed',

    target?: ObjectId, text: String, before?: Mixed, after?: Mixed, createdAt }

\`\`\`

Validate keys against the catalog (ignore/reject unknown), de-duplicate, a key may not be in both \`allow\` and \`deny\`.

Deleting a member deletes their override.



**## 5. Endpoints**



All need \`Authorization: Bearer\`. Envelope \`{ message, data }\`, errors \`{ message, code, ... }\`.



\| Method & path | Who | Body / result |

\|---|---|---|

\| \`GET /access/me\` | **\*\*any signed-in user\*\*** | \`{ enabled, role: 'admin'\\|'member'\\|'viewer', permissions: [key] }\` - the **\*\*effective\*\*** list, already resolved by the server (when \`enabled=false\` return the full catalog so the UI shows everything). The frontend calls this after every sign-in and on \`/changes\` events. |

\| \`GET /access/config\` | admin | \`{ enabled, rolePresets: { member:[key], viewer:[key] } }\` |

\| \`PUT /access/config\` | admin | body any of \`{ enabled: Boolean, rolePresets: { member:[key], viewer:[key] } }\` -> saved config. Audit entry per change. |

\| \`GET /access/users\` | admin | \`[ { memberId, allow:[key], deny:[key] } ]\` (only people with overrides) |

\| \`PUT /access/users/:memberId\` | admin | \`{ allow:[key], deny:[key] }\`; both empty = delete the override. Returns the saved document. \`404 USER_NOT_FOUND\`. |

\| \`GET /access/audit?limit=100\` | admin | \`[ { \_id, actorName, text, createdAt } ]\` newest first |

\| \`PATCH /member/:id\` | admin | **\*\*add \`role: 'admin'\\|'member'\`\*\*** (see section 2) |



Non-admin callers of \`/access/config|users|audit\` -> \`403 FORBIDDEN\`.



**### 5.1 Enforcement - add the permission check to these routes**



Return \`403 { code: 'PERMISSION_DENIED', message, permission: '\<key>' }\` when \`access.enabled\` and the key is missing.

Run the check **\*\*before\*\*** the existing authorization so the answer is consistent.



\| Route(s) | Key |

\|---|---|

\| \`GET /task\`, \`GET /task/:id\`, \`GET /taskAssignment\*\` | \`view\.tasks\` (assignments list: \`view\.assignments\` for \`/taskAssignment/mine\`) |

\| \`GET /team\`, \`GET /team/:id\` | \`view\.teams\` |

\| \`GET /member\`, \`GET /member/all\` | \`view\.members\` (always allow \`GET /member/profile\`) |

\| \`GET /dashboard\*\`, \`GET /activity\` (feed pages) | \`view\.reports\` |

\| \`POST /task/createTask\` | \`task.create\` |

\| \`PATCH /task/:id\`, \`POST/PATCH/DELETE /task/:id/subtasks\*\` | \`task.edit\` |

\| \`DELETE /task/:id\`, \`POST /task/:id/restore\`, \`POST /task/bulkDelete\`, \`POST /task/bulkRestore\` | \`task.delete\` |

\| \`POST /taskAssignment/addMemberToTask\`, \`.../removeMemberFromTask\` | \`task.assign\` |

\| \`PATCH /taskAssignment/taskStatusByMember\`, \`POST /taskAssignment/bulkStatus\`, \`POST /task/:id/complete-and-spawn\` | \`task.status\` |

\| \`POST /task/:id/comments\` (and own \`PATCH\`/\`DELETE\`) | \`task.comment\` |

\| \`POST /task/:id/attachments\` (and own \`DELETE\`) | \`task.attach\` |

\| \`POST /task/:id/time\` (and own \`DELETE\`) | \`task.logTime\` |

\| \`POST /task/:id/share\`, \`DELETE /task/:id/share\` | \`task.share\` |

\| \`POST /team/createTeam\` | \`team.create\` |

\| \`POST /team/addMemberToTeam\`, \`removeMemberFromTeam\`, \`updateMemberRoleInTeam\`, \`updateTeamName\` | \`team.manage\` |

\| \`POST /team/deleteTeam\`, \`POST /team/restore\` | \`team.delete\` |

\| \`POST /member/createMember\` | \`member.invite\` |

\| \`PATCH/DELETE /member/:id\`, \`/member/:id/active\`, \`/member/:id/resetPassword\` | \`member.edit\` (a person may always \`PATCH\` **\*\*their own\*\*** name/picture) |

\| \`GET /export/\*\` | \`report.export\` |



Notes

\- A \`view.\*\` key being blocked means the **\*\*data\*\*** is not returned: answer \`403 PERMISSION_DENIED\`, not an empty list, so the UI can tell "no access" from "nothing yet".

\- Notifications, preferences, sessions, push and the person's own profile are never gated.

\- SSE / \`/changes\`: only send events for entities the person may read.



**## 6. Realtime and caching**



\- Add an \`access\` group to \`GET /changes\` (\`{ upserted: ['config'|memberId], deleted: [] }\`) and an SSE event \`access.updated\`, so a user whose permissions change sees the UI update without a reload (the frontend then re-calls \`GET /access/me\`).

\- \`GET /access/me\` is cheap and may be cached for a few seconds per user; bust the cache on any \`PUT /access/\*\` and on role changes.

\- A permission change must apply to already-issued tokens immediately (resolve permissions per request from the database, not from the JWT).



**## 7. Edge cases the tests will check**



1\. \`enabled=false\`: no \`PERMISSION_DENIED\` anywhere, even if overrides exist.

2\. Block wins: preset has \`task.create\`, override \`deny:['task.create']\` -> 403; override \`allow\` + preset removed -> allowed.

3\. Admin is never blocked, even if someone writes \`deny\` for an admin (store it, ignore it in resolution).

4\. Changing the Member preset affects everyone with that role at once; overrides stay.

5\. Viewer: \`403 VIEWER_READ_ONLY\` still wins on mutations even if the permission is \`allow\`.

6\. Last admin cannot be demoted or deleted; nobody can change their own role.

7\. Unknown permission key in a body -> \`422 VALIDATION_ERROR\`.

8\. Deleting a member removes their override; re-creating the email starts clean.

9\. Every change writes an audit row (who, what, before/after); \`GET /access/audit\` returns them newest first.

10\. Concurrent edits: \`PUT /access/users/:id\` is last-write-wins but returns the saved state.



**## 8. How we will verify**



\`tests/e2e/integration.spec.js\`, test **\*\*"access control: master switch, per-person block, role presets, enforced by the server"\*\***

(also \`tests/e2e/more.spec.js\` for the Demo Mode version). Point \`VITE_API_BASE_URL\` at your staging and run

\`npx playwright test --project=integration\`. It checks: switch on/off, a blocked person gets \`403 PERMISSION_DENIED\` with \`permission: 'task.create'\`,

\`/access/me\` of that person lacks the key, the Member preset change reaches \`/access/me\`, non-admins get 403 on \`PUT /access/config\`,

and turning the switch off lifts the restriction immediately.



Please send back: staging URL, any key you renamed or added (keep the strings in section 3 stable), and the migration notes.
