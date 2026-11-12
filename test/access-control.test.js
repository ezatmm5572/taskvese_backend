import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSION_KEYS,
  DEFAULT_PRESETS,
  validatePermissionKeys,
  deriveAccessRole,
} from "../src/commn/utils/access-control.js";

test("access catalog contains the complete fixed permission set", () => {
  assert.equal(PERMISSION_KEYS.length, 31);
  for (const permission of [
    "task.editTitle", "task.editDescription", "task.editDates", "task.editTeam",
    "task.editPriority", "task.editTags", "task.editRecurrence", "task.editReminder",
    "task.editEstimate", "task.editSubtasks",
  ]) {
    assert.ok(PERMISSION_KEYS.includes(permission), `Missing permission: ${permission}`);
  }
  assert.ok(PERMISSION_KEYS.includes("task.share"));
  assert.ok(PERMISSION_KEYS.includes("member.edit"));
  assert.ok(PERMISSION_KEYS.includes("report.export"));
});

test("default member and viewer presets match the access specification", () => {
  assert.ok(DEFAULT_PRESETS.member.includes("task.create"));
  assert.ok(DEFAULT_PRESETS.member.includes("report.export"));
  assert.ok(!DEFAULT_PRESETS.member.includes("team.manage"));
  assert.deepEqual(DEFAULT_PRESETS.viewer, [
    "view.overview", "view.tasks", "view.teams", "view.members", "view.assignments",
  ]);
});

test("permission validation deduplicates keys and rejects unknown keys", () => {
  assert.deepEqual(validatePermissionKeys(["task.create", "task.create"]), ["task.create"]);
  assert.throws(
    () => validatePermissionKeys(["task.create", "unknown.permission"]),
    (error) => error.errorCode === "VALIDATION_ERROR" && error.statusCode === 422,
  );
});

test("access role is admin, viewer only when every team role is viewer, otherwise member", async () => {
  assert.equal(await deriveAccessRole({ role: "admin", teams: [] }), "admin");
  assert.equal(await deriveAccessRole({ role: "member", teams: [{ role: "viewer" }] }), "viewer");
  assert.equal(await deriveAccessRole({ role: "member", teams: [{ role: "viewer" }, { role: "viewer" }] }), "viewer");
  assert.equal(await deriveAccessRole({ role: "member", teams: [{ role: "viewer" }, { role: "editor" }] }), "member");
  assert.equal(await deriveAccessRole({ role: "member", teams: [] }), "member");
});
