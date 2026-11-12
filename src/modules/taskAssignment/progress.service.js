import taskModel from "../../DB/models/task.js";
import teamModel from "../../DB/models/team.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import { httpError, assertNotViewer, canManageTaskInAdminScope } from "../../commn/utils/permissions.js";
import { recordActivity } from "../../commn/utils/activity.service.js";
import { successResponse } from "../../commn/utils/successResponse.js";

export const updateMyProgress = async (req, res) => {
    const { taskId, progress, progressStatus, progressNote } = req.body;
    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);

    const assignment = await taskAssignmentModel.findOne({ task: taskId, member: req.member._id });
    if (!assignment) throw httpError("Member is not assigned to this task", 404, "NOT_ASSIGNED");

    if (["approved", "rejected"].includes(progressStatus)) {
        throw httpError("Only a task manager can approve or reject submitted work", 403, "FORBIDDEN");
    }
    if (progress !== undefined) assignment.progress = progress;
    if (progressNote !== undefined) assignment.progressNote = progressNote;
    if (progressStatus !== undefined) assignment.progressStatus = progressStatus;

    if (assignment.progressStatus === "submitted") {
        assignment.submittedAt = assignment.submittedAt || new Date();
    } else if (["todo", "in-progress"].includes(assignment.progressStatus)) {
        assignment.submittedAt = null;
        assignment.reviewedAt = null;
        assignment.reviewedBy = null;
        assignment.reviewNote = "";
    }
    await assignment.save();
    await assignment.populate("member", "_id fname lname email profilePicture");

    await recordActivity({
        actor: req.member._id,
        action: "task_progress_updated",
        task: task._id,
        team: task.team,
        meta: { progress: assignment.progress, progressStatus: assignment.progressStatus },
        text: `Updated progress on "${task.title}"`,
    });
    return successResponse({ res, status: 200, message: "Progress updated successfully", data: assignment });
};

export const reviewProgress = async (req, res) => {
    const { taskId, memberId, decision, reviewNote = "" } = req.body;
    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);
    if (!(await canManageTaskInAdminScope(req.member, task, team))) {
        throw httpError("You are not allowed to review this task", 403, "FORBIDDEN");
    }

    const assignment = await taskAssignmentModel.findOne({ task: taskId, member: memberId });
    if (!assignment) throw httpError("Member is not assigned to this task", 404, "NOT_ASSIGNED");
    if (assignment.progressStatus !== "submitted") {
        throw httpError("Only submitted work can be reviewed", 409, "NOT_SUBMITTED");
    }

    assignment.progressStatus = decision;
    assignment.reviewNote = reviewNote;
    assignment.reviewedAt = new Date();
    assignment.reviewedBy = req.member._id;
    if (decision === "approved") assignment.progress = 100;
    await assignment.save();
    await assignment.populate([
        { path: "member", select: "_id fname lname email profilePicture" },
        { path: "reviewedBy", select: "_id fname lname email profilePicture" },
    ]);

    await recordActivity({
        actor: req.member._id,
        action: `task_progress_${decision}`,
        task: task._id,
        team: task.team,
        meta: { memberId, reviewNote },
        text: `${decision === "approved" ? "Approved" : "Rejected"} submitted work for "${task.title}"`,
    });
    return successResponse({ res, status: 200, message: `Work ${decision} successfully`, data: assignment });
};