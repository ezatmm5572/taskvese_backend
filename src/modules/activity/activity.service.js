import activityModel from "../../DB/models/activity.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { httpError, isSystemAdmin } from "../../commn/utils/permissions.js";
import taskModel from "../../DB/models/task.js";
import memberModel from "../../DB/models/member.js";
import { checkCanAccessTask } from "../tasks/tasks.service.js";
import { createBoardActivityNotifications } from "../../commn/utils/notification.service.js";
import { recordActivity } from "../../commn/utils/activity.service.js";

export const getActivity = async (req, res, next) => {
    const taskId = req.query.taskId || req.query.task;
    const teamId = req.query.teamId || req.query.team;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const filter = {};
    if (taskId) {
        filter.task = taskId;
    }
    if (teamId) {
        filter.team = teamId;
    }

    const activities = await activityModel
        .find(filter)
        .populate("actor", "_id fname lname email profilePicture")
        .populate("task", "_id title")
        .populate("team", "_id name")
        .sort({ createdAt: -1 })
        .limit(limit);

    successResponse({
        res,
        status: 200,
        message: "Activity log retrieved successfully",
        data: activities || [],
    });
};


export const recordTaskView = async (req, res) => {
    const task = await taskModel.findOne({ _id: req.params.taskId, deletedAt: null });
    if (!task || !(await checkCanAccessTask(req.member, task))) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }
    const actor = await memberModel.findById(req.member._id).select("fname lname").lean();
    const actorName = actor ? `${actor.fname} ${actor.lname}`.trim() : "A member";
    await createBoardActivityNotifications({
        type: "viewed", actorId: req.member._id, taskId: task._id, teamId: task.team,
        params: { actor: actorName, title: task.title },
        text: `${actorName} opened the task "${task.title}"`,
    });
    return successResponse({ res, status: 200, message: "Task view recorded", data: { taskId: task._id } });
};

export const recordBoardVisit = async (req, res) => {
    const actor = await memberModel.findById(req.member._id).select("fname lname").lean();
    const actorName = actor ? `${actor.fname} ${actor.lname}`.trim() : "A member";
    await createBoardActivityNotifications({
        type: "board_visit", actorId: req.member._id,
        params: { actor: actorName },
        text: `${actorName} opened the board`,
    });
    await recordActivity({ actor: req.member._id, action: "board_visit", meta: { text: `${actorName} opened the board` } });
    return successResponse({ res, status: 200, message: "Board visit recorded" });
};
