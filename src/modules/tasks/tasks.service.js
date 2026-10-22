import mongoose from "mongoose";
import * as DB_services from "../../DB/DB.service.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import { httpError, canManageTask } from "../../commn/utils/permissions.js";
import { successResponse } from "../../commn/utils/successResponse.js";

export const createTask = async (req, res, next) => {
    const { title, description, startDate, endDate, teamId } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId } });
    if (!team) {
        throw new Error("Team not found");
    }

    const isTeamAdmin = team.addedBy?.toString() === req.member._id.toString() ||
        (team.teamAdims && team.teamAdims.some(a => a.toString() === req.member._id.toString())) ||
        (team.teamAdmins && team.teamAdmins.some(a => a.toString() === req.member._id.toString())) ||
        req.member.role === "admin";

    if (!isTeamAdmin) {
        throw new Error("You are not a team admin");
    }

    const task = await DB_services.createDocument({
        model: taskModel,
        doc: {
            title,
            description,
            startDate,
            endDate,
            team: teamId,
            createdBy: req.member._id
        }
    });

    const populatedTask = await taskModel.findById(task._id).populate("team", "name");

    successResponse({
        res,
        status: 201,
        message: "Task created successfully",
        data: populatedTask || task
    });
};

export const getAllTasks = async (req, res, next) => {
    const tasks = await taskModel.find({})
        .populate("team", "name")
        .populate("createdBy", "fname lname email")
        .sort({ createdAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "All tasks",
        data: tasks || []
    });
};

export const deleteTask = async (req, res, next) => {
    // Supports DELETE /task/:taskId (used by the frontend) and the legacy
    // DELETE /task/deleteTask with the id in the body or query string.
    const taskId = req.params.taskId || req.body?.taskId || req.query?.taskId;

    if (!taskId || !mongoose.isValidObjectId(taskId)) {
        throw httpError("A valid taskId is required", 400);
    }

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw httpError("Task not found", 404);
    }

    const team = task.team
        ? await DB_services.findOne({ model: teamModel, filter: { _id: task.team } })
        : null;

    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to delete this task", 403);
    }

    // Remove assignments first so no orphaned records are left behind.
    await DB_services.deleteMany({ model: taskAssignmentModel, filter: { task: task._id } });
    await DB_services.deleteDocument({ model: taskModel, filter: { _id: task._id } });

    successResponse({
        res,
        status: 200,
        message: "Task deleted successfully",
        data: { _id: task._id }
    });
};
