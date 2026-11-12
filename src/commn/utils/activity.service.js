import activityModel from "../../DB/models/activity.js";
import { createBoardActivityNotifications } from "./notification.service.js";

export const recordActivity = async ({
    actor,
    action,
    task = null,
    team = null,
    meta = {},
    text = "",
}) => {
    try {
        if (!actor || !action) return null;
        const activity = await activityModel.create({
            actor,
            action,
            task: task || null,
            team: team || null,
            meta,
            text: text || meta?.text || "",
        });
        const actionTypes = {
            task_created: "task_created", task_updated: "updated", task_deleted: "task_deleted",
            task_restored: "updated", subtask_created: "subtask", subtask_updated: "subtask",
            subtask_deleted: "subtask", comment_created: "comment", attachment_uploaded: "attachment",
            time_logged: "time", member_assigned_to_task: "assigned", member_added_to_team: "team_member_added",
            task_status_updated: "status",
        };
        const type = action === "task_status_updated" && ["complete", "completed"].includes(String(meta?.status || "").toLowerCase())
            ? "completed" : actionTypes[action];
        if (type) {
            const memberModel = (await import("../../DB/models/member.js")).default;
            const actorDoc = await memberModel.findById(actor).select("fname lname").lean();
            const actorName = actorDoc ? `${actorDoc.fname} ${actorDoc.lname}`.trim() : "A member";
            await createBoardActivityNotifications({
                type, actorId: actor, taskId: task, teamId: team,
                params: { actor: actorName, action, ...meta },
                text: text || `${actorName} ${action.replaceAll("_", " ")}`,
            });
        }
        return activity;
    } catch (err) {
        console.error("Failed to record activity log:", err.message);
        return null;
    }
};
