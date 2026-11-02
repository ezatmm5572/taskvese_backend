import mongoose from "mongoose";
import * as DB_services from "../../DB/DB.service.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import memberModel from "../../DB/models/member.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import commentModel from "../../DB/models/comment.js";
import attachmentModel from "../../DB/models/attachment.js";
import timeEntryModel from "../../DB/models/timeEntry.js";
import activityModel from "../../DB/models/activity.js";
import {
    httpError,
    canManageTask,
    canCreateTask,
    canViewTask,
    isViewerInTeam,
    assertNotViewer,
    same,
    isSystemAdmin,
    isTeamManager,
} from "../../commn/utils/permissions.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { TaskStatusEnum, normalizeTaskStatus } from "../../commn/enums/task.enums.js";
import { taskAssignedTemplate } from "../../commn/email/email_task.teamplate.js";
import { recordActivity } from "../../commn/utils/activity.service.js";
import { createNotification } from "../../commn/utils/notification.service.js";
import {
    uploadAttachmentToCloudinary,
    deleteCloudinaryResource,
} from "../../commn/utils/fileUpload.js";
import {
    deriveTaskStatus,
    spawnNextRecurrentTask,
} from "../taskAssignment/taskAssignment.service.js";
import crypto from "crypto";

// Check if caller has Task Access (TA)
export const checkCanAccessTask = async (member, task, team = null) => {
    if (!member || !task) return false;
    if (isSystemAdmin(member)) return true;
    if (same(task.createdBy, member._id)) return true;

    if (!team && task.team) {
        team = await teamModel.findById(task.team);
    }
    if (team) {
        if (isTeamManager(team, member)) return true;
        if ((team.teamMembers || []).some((m) => same(m, member._id))) return true;
    }

    const isAssigned = await taskAssignmentModel.exists({
        task: task._id,
        member: member._id,
    });
    return Boolean(isAssigned);
};

// Parse @FirstLast handles for mentions
export const extractMentions = async (text, team) => {
    if (!text) return [];
    const handles = Array.from(text.matchAll(/@([a-zA-Z0-9_]+)/g)).map((m) =>
        m[1].toLowerCase()
    );
    if (handles.length === 0) return [];

    const allMembers = await memberModel
        .find({ active: { $ne: false } })
        .select("_id fname lname email");
    const mentionedIds = [];

    for (const m of allMembers) {
        const fullHandle = `${m.fname || ""}${m.lname || ""}`.replace(/\s+/g, "").toLowerCase();
        const firstHandle = (m.fname || "").trim().toLowerCase();
        if (handles.includes(fullHandle) || handles.includes(firstHandle)) {
            // Only mention members with access to the team
            if (
                !team ||
                (team.teamMembers || []).some((tm) => same(tm, m._id)) ||
                (team.teamAdims || []).some((ta) => same(ta, m._id)) ||
                same(team.addedBy, m._id)
            ) {
                mentionedIds.push(m._id);
            }
        }
    }
    return Array.from(new Set(mentionedIds.map((id) => String(id))));
};

// -------------------------------------------------------------
// Tasks: CRUD, Lists, Details, Restore, Bulk, Share
// -------------------------------------------------------------

export const createTask = async (req, res, next) => {
    const {
        title,
        description = "",
        startDate = null,
        endDate = null,
        teamId,
        team: reqTeamId,
        priority = "",
        tags = [],
        recurrence = "none",
        remindBefore = 0,
        estimateMin = 0,
        subtasks = [],
        assignees = [],
    } = req.body;

    const targetTeamId = teamId || reqTeamId || null;
    let team = null;

    if (targetTeamId) {
        team = await DB_services.findOne({ model: teamModel, filter: { _id: targetTeamId } });
        if (!team) {
            throw httpError("Team not found", 404, "NOT_FOUND");
        }
        // Section 5.1: create task allowed for SA, TMgr, Ed in that team. Viewers get 403 VIEWER_READ_ONLY.
        if (isViewerInTeam(team, req.member)) {
            throw httpError("Viewers have read-only access", 403, "VIEWER_READ_ONLY");
        }
        if (!canCreateTask(req.member, team)) {
            throw httpError("You are not allowed to create tasks in this team", 403, "FORBIDDEN");
        }
    }

    // Format subtasks
    const formattedSubtasks = (Array.isArray(subtasks) ? subtasks : []).map((st) => ({
        text: typeof st === "string" ? st : st?.text || "",
        done: Boolean(st?.done),
    }));

    const task = await DB_services.createDocument({
        model: taskModel,
        doc: {
            title,
            description,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            team: targetTeamId,
            createdBy: req.member._id,
            priority: priority || "",
            tags: Array.isArray(tags) ? tags : [],
            recurrence: recurrence || "none",
            remindBefore: Number(remindBefore) || 0,
            estimateMin: Number(estimateMin) || 0,
            subtasks: formattedSubtasks,
            completedAt: null,
            archived: false,
            deletedAt: null,
        },
    });

    // Atomic assignment of members
    if (Array.isArray(assignees) && assignees.length > 0) {
        for (const memberId of assignees) {
            if (!mongoose.isValidObjectId(memberId)) continue;
            const targetMember = await DB_services.findOne({
                model: memberModel,
                filter: { _id: memberId },
            });
            if (!targetMember) continue;

            // Ensure assignee is member of team
            if (team) {
                const inTeam =
                    same(team.addedBy, memberId) ||
                    (team.teamMembers || []).some((m) => same(m, memberId)) ||
                    (team.teamAdims || []).some((a) => same(a, memberId));
                if (!inTeam) continue;
            }

            await DB_services.createDocument({
                model: taskAssignmentModel,
                doc: {
                    task: task._id,
                    member: memberId,
                    assignedBy: req.member._id,
                    assignedAt: new Date(),
                    status: TaskStatusEnum.TODO,
                    completedAt: null,
                },
            });

            await createNotification({
                user: memberId,
                type: "assigned",
                text: `You were assigned to task "${task.title}"`,
                task: task._id,
                team: targetTeamId,
                actor: req.member._id,
                emailSubject: "New Task Assignment",
                emailHtml: taskAssignedTemplate({
                    memberName: (targetMember.fname || "") + " " + (targetMember.lname || ""),
                    taskTitle: task.title,
                    taskDescription: task.description,
                    startDate: task.startDate,
                    dueDate: task.endDate,
                    priority: task.priority || "Normal",
                    assignedBy: (req.member?.fname || "") + " " + (req.member?.lname || ""),
                }),
            });
        }
    }

    await recordActivity({
        actor: req.member._id,
        action: "task_created",
        task: task._id,
        team: targetTeamId,
        meta: { title: task.title, priority: task.priority },
        text: `Created task "${task.title}"`,
    });

    const populatedTask = await taskModel
        .findById(task._id)
        .populate("team", "name")
        .populate("createdBy", "fname lname email profilePicture");

    const assignments = await taskAssignmentModel
        .find({ task: task._id })
        .populate("member", "fname lname email profilePicture");

    const taskObj = (populatedTask || task).toObject();
    taskObj.assignees = assignments.map((a) => ({
        _id: a.member?._id || a.member,
        fname: a.member?.fname || "",
        lname: a.member?.lname || "",
        email: a.member?.email || "",
        profilePicture: a.member?.profilePicture || "default.png",
        status: normalizeTaskStatus(a.status),
    }));
    taskObj.status = deriveTaskStatus(assignments);
    taskObj.subtaskCount = taskObj.subtasks?.length || 0;
    taskObj.subtaskDone = (taskObj.subtasks || []).filter((s) => s.done).length;
    taskObj.commentCount = 0;
    taskObj.attachmentCount = 0;
    taskObj.loggedMin = 0;

    successResponse({
        res,
        status: 201,
        message: "Task created successfully",
        data: taskObj,
    });
};

export const getAllTasks = async (req, res, next) => {
    const {
        team,
        assignee,
        status,
        priority,
        tag,
        archived,
        due,
        q,
        page,
        limit,
        sort = "createdAt",
        order = "desc",
    } = req.query;

    const query = { deletedAt: null };

    // Archived filter (default false)
    if (archived === "true" || archived === true) {
        query.archived = true;
    } else {
        query.archived = false;
    }

    // Team filter
    if (team) {
        query.team = team;
    }

    // Priority filter
    if (priority !== undefined && priority !== "") {
        query.priority = priority;
    }

    // Tag filter
    if (tag) {
        query.tags = tag.toLowerCase();
    }

    // Text search filter q
    if (q && String(q).trim()) {
        query.$text = { $search: String(q).trim() };
    }

    // Due date filter: overdue | today | week
    if (due) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (due === "overdue") {
            query.endDate = { $lt: startOfToday };
            query.completedAt = null;
        } else if (due === "today") {
            query.endDate = { $gte: startOfToday, $lte: endOfToday };
        } else if (due === "week") {
            const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
            query.endDate = { $gte: startOfToday, $lte: endOfWeek };
        }
    }

    // Task Access scoping: unless SA, only return tasks user has access to
    if (!isSystemAdmin(req.member)) {
        // Find teams caller belongs to
        const userTeams = await teamModel
            .find({
                deletedAt: null,
                $or: [
                    { teamMembers: req.member._id },
                    { teamAdims: req.member._id },
                    { addedBy: req.member._id },
                ],
            })
            .distinct("_id");

        // Find tasks user is assigned to
        const assignedTaskIds = await taskAssignmentModel
            .find({ member: req.member._id })
            .distinct("task");

        query.$or = [
            { createdBy: req.member._id },
            { team: { $in: userTeams } },
            { _id: { $in: assignedTaskIds } },
        ];
    }

    // Assignee filter
    if (assignee) {
        const matchingTaskIds = await taskAssignmentModel
            .find({ member: assignee })
            .distinct("task");
        query._id = query._id
            ? { $in: matchingTaskIds.filter((id) => (query._id.$in || []).includes(id)) }
            : { $in: matchingTaskIds };
    }

    // Sort order
    const sortField = sort || "createdAt";
    const sortDirection = order === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDirection };

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const usePagination = !isNaN(pageNum) && pageNum > 0;

    let tasksQuery = taskModel
        .find(query)
        .populate("team", "_id name")
        .populate("createdBy", "_id fname lname email profilePicture")
        .sort(sortObj);

    let total = 0;
    if (usePagination) {
        total = await taskModel.countDocuments(query);
        tasksQuery = tasksQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const tasks = await tasksQuery;
    const taskIds = tasks.map((t) => t._id);

    // Fetch assignments for all tasks
    const allAssignments = await taskAssignmentModel
        .find({ task: { $in: taskIds } })
        .populate("member", "_id fname lname email profilePicture");

    const assignmentsByTask = {};
    for (const a of allAssignments) {
        const tId = String(a.task);
        if (!assignmentsByTask[tId]) assignmentsByTask[tId] = [];
        assignmentsByTask[tId].push(a);
    }

    // Fetch comment counts
    const commentCounts = await commentModel.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$task", count: { $sum: 1 } } },
    ]);
    const commentMap = Object.fromEntries(commentCounts.map((c) => [String(c._id), c.count]));

    // Fetch attachment counts
    const attachmentCounts = await attachmentModel.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$task", count: { $sum: 1 } } },
    ]);
    const attachmentMap = Object.fromEntries(attachmentCounts.map((a) => [String(a._id), a.count]));

    // Fetch logged minutes
    const timeEntries = await timeEntryModel.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$task", loggedMin: { $sum: "$minutes" } } },
    ]);
    const timeMap = Object.fromEntries(timeEntries.map((t) => [String(t._id), t.loggedMin]));

    // Format results
    const formatted = tasks.map((t) => {
        const tObj = t.toObject();
        const taskAssigns = assignmentsByTask[String(t._id)] || [];
        tObj.assignees = taskAssigns.map((a) => ({
            _id: a.member?._id || a.member,
            fname: a.member?.fname || "",
            lname: a.member?.lname || "",
            email: a.member?.email || "",
            profilePicture: a.member?.profilePicture || "default.png",
            status: normalizeTaskStatus(a.status),
        }));
        tObj.status = deriveTaskStatus(taskAssigns);
        tObj.subtaskCount = tObj.subtasks?.length || 0;
        tObj.subtaskDone = (tObj.subtasks || []).filter((s) => s.done).length;
        tObj.commentCount = commentMap[String(t._id)] || 0;
        tObj.attachmentCount = attachmentMap[String(t._id)] || 0;
        tObj.loggedMin = timeMap[String(t._id)] || 0;
        return tObj;
    });

    // Filter by derived status if status query param was supplied
    let resultData = formatted;
    if (status) {
        const canonicalFilterStatus = normalizeTaskStatus(status);
        resultData = formatted.filter((t) => t.status === canonicalFilterStatus);
    }

    const responsePayload = {
        res,
        status: 200,
        message: "Tasks retrieved successfully",
        data: resultData,
    };

    if (usePagination) {
        responsePayload.meta = {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
        };
    }

    successResponse(responsePayload);
};

export const getTaskById = async (req, res, next) => {
    const { taskId } = req.params;

    if (!taskId || !mongoose.isValidObjectId(taskId)) {
        throw httpError("Invalid task ID", 400, "VALIDATION_ERROR");
    }

    const task = await taskModel
        .findOne({ _id: taskId, deletedAt: null })
        .populate("team", "_id name")
        .populate("createdBy", "_id fname lname email profilePicture");

    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team._id || task.team) : null;
    const canAccess = await checkCanAccessTask(req.member, task, team);
    if (!canAccess) {
        throw httpError("You are not allowed to view this task", 403, "FORBIDDEN");
    }

    // Fetch assignments
    const assignments = await taskAssignmentModel
        .find({ task: task._id })
        .populate("member", "_id fname lname email profilePicture");

    // Fetch comments
    const comments = await commentModel
        .find({ task: task._id })
        .populate("author", "_id fname lname email profilePicture")
        .sort({ createdAt: 1 });

    // Fetch attachments
    const attachments = await attachmentModel
        .find({ task: task._id })
        .populate("uploadedBy", "_id fname lname email profilePicture")
        .sort({ createdAt: -1 });

    // Fetch time entries
    const timeEntries = await timeEntryModel
        .find({ task: task._id })
        .populate("author", "_id fname lname email profilePicture")
        .sort({ at: -1 });

    // Fetch recent activity
    const activities = await activityModel
        .find({ task: task._id })
        .populate("actor", "_id fname lname email profilePicture")
        .sort({ createdAt: -1 })
        .limit(50);

    const taskObj = task.toObject();
    taskObj.assignees = assignments.map((a) => ({
        _id: a.member?._id || a.member,
        fname: a.member?.fname || "",
        lname: a.member?.lname || "",
        email: a.member?.email || "",
        profilePicture: a.member?.profilePicture || "default.png",
        status: normalizeTaskStatus(a.status),
    }));
    taskObj.status = deriveTaskStatus(assignments);
    taskObj.subtaskCount = taskObj.subtasks?.length || 0;
    taskObj.subtaskDone = (taskObj.subtasks || []).filter((s) => s.done).length;
    taskObj.comments = comments;
    taskObj.commentCount = comments.length;
    taskObj.attachments = attachments;
    taskObj.attachmentCount = attachments.length;
    taskObj.timeEntries = timeEntries;
    taskObj.loggedMin = timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
    taskObj.activity = activities;

    successResponse({
        res,
        status: 200,
        message: "Task retrieved successfully",
        data: taskObj,
    });
};

export const updateTask = async (req, res, next) => {
    const { taskId } = req.params;

    if (!taskId || !mongoose.isValidObjectId(taskId)) {
        throw httpError("A valid taskId is required", 400, "VALIDATION_ERROR");
    }

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to update this task", 403, "FORBIDDEN");
    }

    // Section 6.3 Concurrency check: If-Unmodified-Since or updatedAt precondition
    const ifUnmodifiedSince = req.headers["if-unmodified-since"];
    if (ifUnmodifiedSince && task.updatedAt) {
        const clientDate = new Date(ifUnmodifiedSince).getTime();
        const serverDate = new Date(task.updatedAt).getTime();
        if (serverDate > clientDate) {
            return res.status(409).json({
                message: "Task has been modified by another user",
                code: "CONFLICT",
                data: task,
            });
        }
    }

    const updates = {};
    const {
        title,
        description,
        startDate,
        endDate,
        team: newTeamId,
        teamId,
        priority,
        tags,
        recurrence,
        remindBefore,
        estimateMin,
        archived,
    } = req.body;

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (remindBefore !== undefined) updates.remindBefore = Number(remindBefore);
    if (estimateMin !== undefined) updates.estimateMin = Number(estimateMin);
    if (archived !== undefined) updates.archived = Boolean(archived);

    const targetTeamId = newTeamId || teamId;
    if (targetTeamId !== undefined) {
        if (!mongoose.isValidObjectId(targetTeamId)) {
            throw httpError("Invalid team ID", 400, "VALIDATION_ERROR");
        }
        const targetTeam = await teamModel.findById(targetTeamId);
        if (!targetTeam) {
            throw httpError("Target team not found", 404, "NOT_FOUND");
        }
        if (!isTeamManager(targetTeam, req.member)) {
            throw httpError("You are not allowed to move tasks to this team", 403, "FORBIDDEN");
        }
        updates.team = targetTeamId;
    }

    const updatedTask = await taskModel
        .findByIdAndUpdate(taskId, { $set: updates }, { new: true, runValidators: true })
        .populate("team", "_id name")
        .populate("createdBy", "_id fname lname email profilePicture");

    await recordActivity({
        actor: req.member._id,
        action: "task_updated",
        task: task._id,
        team: updatedTask.team?._id || task.team,
        meta: { updates: Object.keys(updates) },
        text: `Updated task "${task.title}"`,
    });

    successResponse({
        res,
        status: 200,
        message: "Task updated successfully",
        data: updatedTask,
    });
};

export const deleteTask = async (req, res, next) => {
    const taskId = req.params.taskId || req.body?.taskId || req.query?.taskId;

    if (!taskId || !mongoose.isValidObjectId(taskId)) {
        throw httpError("A valid taskId is required", 400, "VALIDATION_ERROR");
    }

    const task = await taskModel.findOne({ _id: taskId });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to delete this task", 403, "FORBIDDEN");
    }

    // Section 5.4: Soft delete sets deletedAt
    task.deletedAt = new Date();
    await task.save();

    await recordActivity({
        actor: req.member._id,
        action: "task_deleted",
        task: task._id,
        team: task.team,
        meta: { title: task.title },
        text: `Deleted task "${task.title}"`,
    });

    successResponse({
        res,
        status: 200,
        message: "Task deleted successfully",
        data: { _id: task._id, deletedAt: task.deletedAt },
    });
};

export const restoreTask = async (req, res, next) => {
    const { taskId } = req.params;

    const task = await taskModel.findOne({ _id: taskId });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to restore this task", 403, "FORBIDDEN");
    }

    if (!task.deletedAt) {
        throw httpError("Task is not deleted", 400, "BAD_REQUEST");
    }

    // Check 30 days retention window
    const daysSinceDeleted = (Date.now() - new Date(task.deletedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeleted > 30) {
        throw httpError("Cannot restore task: retention period expired", 400, "RESTORE_WINDOW_EXPIRED");
    }

    task.deletedAt = null;
    await task.save();

    await recordActivity({
        actor: req.member._id,
        action: "task_restored",
        task: task._id,
        team: task.team,
        meta: { title: task.title },
        text: `Restored task "${task.title}"`,
    });

    successResponse({
        res,
        status: 200,
        message: "Task restored successfully",
        data: task,
    });
};

export const bulkDeleteTasks = async (req, res, next) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw httpError("ids array is required", 400, "VALIDATION_ERROR");
    }
    if (ids.length > 200) {
        throw httpError("Maximum 200 tasks per bulk operation", 400, "VALIDATION_ERROR");
    }

    const deleted = [];
    const skipped = [];

    for (const id of ids) {
        try {
            const task = await taskModel.findById(id);
            if (!task) {
                skipped.push({ id, code: "TASK_NOT_FOUND" });
                continue;
            }
            const team = task.team ? await teamModel.findById(task.team) : null;
            if (!canManageTask(req.member, task, team)) {
                skipped.push({ id, code: "FORBIDDEN" });
                continue;
            }

            task.deletedAt = new Date();
            await task.save();
            deleted.push(id);
        } catch (e) {
            skipped.push({ id, code: "ERROR" });
        }
    }

    successResponse({
        res,
        status: 200,
        message: "Bulk delete completed",
        data: { deleted, skipped },
    });
};

export const bulkRestoreTasks = async (req, res, next) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw httpError("ids array is required", 400, "VALIDATION_ERROR");
    }

    const restored = [];
    const skipped = [];

    for (const id of ids) {
        try {
            const task = await taskModel.findById(id);
            if (!task) {
                skipped.push({ id, code: "TASK_NOT_FOUND" });
                continue;
            }
            const team = task.team ? await teamModel.findById(task.team) : null;
            if (!canManageTask(req.member, task, team)) {
                skipped.push({ id, code: "FORBIDDEN" });
                continue;
            }
            if (!task.deletedAt) {
                skipped.push({ id, code: "NOT_DELETED" });
                continue;
            }

            task.deletedAt = null;
            await task.save();
            restored.push(id);
        } catch (e) {
            skipped.push({ id, code: "ERROR" });
        }
    }

    successResponse({
        res,
        status: 200,
        message: "Bulk restore completed",
        data: { restored, skipped },
    });
};

export const completeAndSpawnTask = async (req, res, next) => {
    const { taskId } = req.params;
    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);

    task.completedAt = new Date();
    await task.save();

    let spawned = null;
    if (task.recurrence && task.recurrence !== "none") {
        spawned = await spawnNextRecurrentTask(task);
    }

    successResponse({
        res,
        status: 200,
        message: "Task completed and next occurrence spawned",
        data: { completedTask: task, spawnedTask: spawned },
    });
};

export const shareTask = async (req, res, next) => {
    const { taskId } = req.params;
    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("Only task managers can generate share links", 403, "FORBIDDEN");
    }

    if (!task.shareToken) {
        task.shareToken = crypto.randomBytes(16).toString("hex");
        await task.save();
    }

    const frontendBaseUrl = (
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        "https://taskverse-frontend-ochre.vercel.app"
    ).replace(/\/$/, "");

    successResponse({
        res,
        status: 200,
        message: "Share link generated",
        data: {
            token: task.shareToken,
            url: `${frontendBaseUrl}/public/task/${task.shareToken}`,
        },
    });
};

export const revokeShareTask = async (req, res, next) => {
    const { taskId } = req.params;
    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("Only task managers can revoke share links", 403, "FORBIDDEN");
    }

    task.shareToken = null;
    await task.save();

    successResponse({
        res,
        status: 200,
        message: "Share link revoked successfully",
    });
};

export const getPublicTask = async (req, res, next) => {
    const { token } = req.params;
    if (!token) throw httpError("Share token is required", 400, "VALIDATION_ERROR");

    const task = await taskModel.findOne({ shareToken: token, deletedAt: null });
    if (!task) throw httpError("Shared task not found", 404, "TASK_NOT_FOUND");

    // Public view only returns sanitized task fields - NO member emails!
    const publicData = {
        _id: task._id,
        title: task.title,
        description: task.description,
        startDate: task.startDate,
        endDate: task.endDate,
        priority: task.priority,
        tags: task.tags,
        subtasks: task.subtasks.map((s) => ({ _id: s._id, text: s.text, done: s.done })),
        completedAt: task.completedAt,
    };

    successResponse({
        res,
        status: 200,
        message: "Public task retrieved successfully",
        data: publicData,
    });
};

// -------------------------------------------------------------
// Subtasks (Sections 4.3 & 5.1): Viewers get 403 VIEWER_READ_ONLY
// -------------------------------------------------------------

export const createSubtask = async (req, res, next) => {
    const { taskId } = req.params;
    const { text } = req.body;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to access this task", 403, "FORBIDDEN");
    }

    task.subtasks.push({ text, done: false });
    await task.save();

    const newSubtask = task.subtasks[task.subtasks.length - 1];

    await recordActivity({
        actor: req.member._id,
        action: "subtask_created",
        task: task._id,
        team: task.team,
        meta: { subtaskId: newSubtask._id, text: newSubtask.text },
        text: `Added subtask "${newSubtask.text}"`,
    });

    successResponse({
        res,
        status: 201,
        message: "Subtask created successfully",
        data: newSubtask,
    });
};

export const updateSubtask = async (req, res, next) => {
    const { taskId, subId } = req.params;
    const { done, text } = req.body;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to access this task", 403, "FORBIDDEN");
    }

    const subtask = task.subtasks.id(subId);
    if (!subtask) {
        throw httpError("Subtask not found", 404, "NOT_FOUND");
    }

    if (done !== undefined) subtask.done = done;
    if (text !== undefined) subtask.text = text;

    await task.save();

    await recordActivity({
        actor: req.member._id,
        action: "subtask_updated",
        task: task._id,
        team: task.team,
        meta: { subtaskId: subId, done: subtask.done, text: subtask.text },
        text: `Updated subtask status`,
    });

    successResponse({
        res,
        status: 200,
        message: "Subtask updated successfully",
        data: subtask,
    });
};

export const deleteSubtask = async (req, res, next) => {
    const { taskId, subId } = req.params;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to access this task", 403, "FORBIDDEN");
    }

    const subtask = task.subtasks.id(subId);
    if (!subtask) {
        throw httpError("Subtask not found", 404, "NOT_FOUND");
    }

    task.subtasks.pull({ _id: subId });
    await task.save();

    await recordActivity({
        actor: req.member._id,
        action: "subtask_deleted",
        task: task._id,
        team: task.team,
        meta: { subtaskId: subId },
        text: `Deleted subtask`,
    });

    successResponse({
        res,
        status: 200,
        message: "Subtask deleted successfully",
        data: { _id: subId },
    });
};

// -------------------------------------------------------------
// Comments & Mentions (Section 4.4): Viewers get 403 VIEWER_READ_ONLY
// -------------------------------------------------------------

export const getComments = async (req, res, next) => {
    const { taskId } = req.params;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to view comments for this task", 403, "FORBIDDEN");
    }

    const comments = await commentModel
        .find({ task: taskId })
        .populate("author", "_id fname lname email profilePicture")
        .sort({ createdAt: 1 });

    successResponse({
        res,
        status: 200,
        message: "Comments fetched successfully",
        data: comments || [],
    });
};

export const createComment = async (req, res, next) => {
    const { taskId } = req.params;
    const { text } = req.body;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    // Critical Section 5.1 Requirement: viewers get 403 VIEWER_READ_ONLY
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to comment on this task", 403, "FORBIDDEN");
    }

    // Parse mentions from text (@FirstLast)
    const mentionedMemberIds = await extractMentions(text, team);

    const comment = await commentModel.create({
        task: taskId,
        author: req.member._id,
        text,
        mentions: mentionedMemberIds,
    });

    await comment.populate("author", "_id fname lname email profilePicture");

    // Send mention notifications to mentioned members
    for (const mId of mentionedMemberIds) {
        if (!same(mId, req.member._id)) {
            await createNotification({
                user: mId,
                type: "mention",
                text: `${req.member.fname || "Someone"} mentioned you in task "${task.title}": "${text.slice(0, 100)}"`,
                task: task._id,
                team: task.team,
                actor: req.member._id,
                emailSubject: `You were mentioned in "${task.title}"`,
            });
        }
    }

    // Send comment notifications to assignees (excluding commenter and mentioned)
    const assignees = await taskAssignmentModel.find({ task: taskId });
    for (const a of assignees) {
        const uId = a.member;
        if (!same(uId, req.member._id) && !mentionedMemberIds.includes(String(uId))) {
            await createNotification({
                user: uId,
                type: "comment",
                text: `New comment on task "${task.title}" by ${req.member.fname || "someone"}`,
                task: task._id,
                team: task.team,
                actor: req.member._id,
                sendEmailNotification: false,
            });
        }
    }

    await recordActivity({
        actor: req.member._id,
        action: "comment_created",
        task: task._id,
        team: task.team,
        meta: { commentId: comment._id },
        text: `Added a comment on "${task.title}"`,
    });

    successResponse({
        res,
        status: 201,
        message: "Comment added successfully",
        data: comment,
    });
};

export const updateComment = async (req, res, next) => {
    const { taskId, commentId } = req.params;
    const { text } = req.body;

    const comment = await commentModel.findOne({ _id: commentId, task: taskId });
    if (!comment) throw httpError("Comment not found", 404, "NOT_FOUND");

    // Only author within 15 minutes can edit
    if (!same(comment.author, req.member._id)) {
        throw httpError("Only the author can edit this comment", 403, "FORBIDDEN");
    }

    const minutesSinceCreation = (Date.now() - new Date(comment.createdAt).getTime()) / (1000 * 60);
    if (minutesSinceCreation > 15) {
        throw httpError("Comments can only be edited within 15 minutes of creation", 400, "EDIT_WINDOW_EXPIRED");
    }

    comment.text = text;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate("author", "_id fname lname email profilePicture");

    successResponse({
        res,
        status: 200,
        message: "Comment updated successfully",
        data: comment,
    });
};

export const deleteComment = async (req, res, next) => {
    const { taskId, commentId } = req.params;

    const task = await taskModel.findOne({ _id: taskId });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const comment = await commentModel.findOne({ _id: commentId, task: taskId });
    if (!comment) {
        throw httpError("Comment not found", 404, "NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    const isAuthor = same(comment.author, req.member._id);
    const isManager = canManageTask(req.member, task, team);

    if (!isAuthor && !isManager) {
        throw httpError("You are not allowed to delete this comment", 403, "FORBIDDEN");
    }

    await commentModel.deleteOne({ _id: commentId });

    await recordActivity({
        actor: req.member._id,
        action: "comment_deleted",
        task: task._id,
        team: task.team,
        meta: { commentId },
        text: `Deleted comment`,
    });

    successResponse({
        res,
        status: 200,
        message: "Comment deleted successfully",
        data: { _id: commentId },
    });
};

// -------------------------------------------------------------
// Attachments (Section 4.5): Viewers get 403 VIEWER_READ_ONLY
// -------------------------------------------------------------

export const getAttachments = async (req, res, next) => {
    const { taskId } = req.params;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to view attachments for this task", 403, "FORBIDDEN");
    }

    const attachments = await attachmentModel
        .find({ task: taskId })
        .populate("uploadedBy", "_id fname lname email profilePicture")
        .sort({ createdAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "Attachments fetched successfully",
        data: attachments || [],
    });
};

export const uploadAttachment = async (req, res, next) => {
    const { taskId } = req.params;

    if (!req.file) {
        throw httpError("File is required", 400, "VALIDATION_ERROR");
    }

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    // Critical Section 5.1 Requirement: viewers get 403 VIEWER_READ_ONLY
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to upload attachments to this task", 403, "FORBIDDEN");
    }

    // Limit check: 20 files per task
    const currentAttachmentCount = await attachmentModel.countDocuments({ task: taskId });
    if (currentAttachmentCount >= 20) {
        throw httpError("Maximum 20 attachments allowed per task", 400, "ATTACHMENT_LIMIT_EXCEEDED");
    }

    let uploadResult;
    try {
        uploadResult = await uploadAttachmentToCloudinary(
            req.file.buffer,
            req.file.originalname,
            "task_attachments"
        );
    } catch (err) {
        console.error("Cloudinary upload error:", err);
        throw httpError("Failed to upload file to cloud storage: " + err.message, 500);
    }

    const attachment = await attachmentModel.create({
        task: taskId,
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: uploadResult.secure_url || uploadResult.url,
        publicId: uploadResult.public_id,
        uploadedBy: req.member._id,
    });

    await attachment.populate("uploadedBy", "_id fname lname email profilePicture");

    await recordActivity({
        actor: req.member._id,
        action: "attachment_uploaded",
        task: task._id,
        team: task.team,
        meta: {
            attachmentId: attachment._id,
            name: attachment.name,
            size: attachment.size,
        },
        text: `Uploaded attachment "${attachment.name}"`,
    });

    successResponse({
        res,
        status: 201,
        message: "Attachment uploaded successfully",
        data: attachment,
    });
};

export const deleteAttachment = async (req, res, next) => {
    const { taskId, attId } = req.params;

    const task = await taskModel.findOne({ _id: taskId });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const attachment = await attachmentModel.findOne({ _id: attId, task: taskId });
    if (!attachment) {
        throw httpError("Attachment not found", 404, "NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    const isUploader = same(attachment.uploadedBy, req.member._id);
    const isManager = canManageTask(req.member, task, team);

    if (!isUploader && !isManager) {
        throw httpError("You are not allowed to delete this attachment", 403, "FORBIDDEN");
    }

    if (attachment.publicId || attachment.public_id) {
        await deleteCloudinaryResource(attachment.publicId || attachment.public_id);
    }

    await attachmentModel.deleteOne({ _id: attId });

    await recordActivity({
        actor: req.member._id,
        action: "attachment_deleted",
        task: task._id,
        team: task.team,
        meta: { attachmentId: attId, name: attachment.name },
        text: `Deleted attachment "${attachment.name}"`,
    });

    successResponse({
        res,
        status: 200,
        message: "Attachment deleted successfully",
        data: { _id: attId },
    });
};

// -------------------------------------------------------------
// Time Tracking (Section 4.6): Viewers get 403 VIEWER_READ_ONLY
// -------------------------------------------------------------

export const getTimeEntries = async (req, res, next) => {
    const { taskId } = req.params;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to view time entries for this task", 403, "FORBIDDEN");
    }

    const entries = await timeEntryModel
        .find({ task: taskId })
        .populate("author", "_id fname lname email profilePicture")
        .sort({ at: -1 });

    successResponse({
        res,
        status: 200,
        message: "Time entries fetched successfully",
        data: entries || [],
    });
};

export const logTime = async (req, res, next) => {
    const { taskId } = req.params;
    const { minutes, note = "", at = new Date() } = req.body;

    const task = await taskModel.findOne({ _id: taskId, deletedAt: null });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const team = task.team ? await teamModel.findById(task.team) : null;
    // Critical Section 5.1 Requirement: viewers get 403 VIEWER_READ_ONLY
    assertNotViewer(team, req.member);

    const allowed = await checkCanAccessTask(req.member, task, team);
    if (!allowed) {
        throw httpError("You are not allowed to log time on this task", 403, "FORBIDDEN");
    }

    const entry = await timeEntryModel.create({
        task: taskId,
        author: req.member._id,
        minutes: Number(minutes),
        note,
        at: new Date(at),
    });

    await entry.populate("author", "_id fname lname email profilePicture");

    await recordActivity({
        actor: req.member._id,
        action: "time_logged",
        task: task._id,
        team: task.team,
        meta: { minutes: entry.minutes, entryId: entry._id },
        text: `Logged ${entry.minutes} minutes on "${task.title}"`,
    });

    successResponse({
        res,
        status: 201,
        message: "Time logged successfully",
        data: entry,
    });
};

export const deleteTimeEntry = async (req, res, next) => {
    const { taskId, entryId } = req.params;

    const task = await taskModel.findOne({ _id: taskId });
    if (!task) throw httpError("Task not found", 404, "TASK_NOT_FOUND");

    const entry = await timeEntryModel.findOne({ _id: entryId, task: taskId });
    if (!entry) {
        throw httpError("Time entry not found", 404, "NOT_FOUND");
    }

    const team = task.team ? await teamModel.findById(task.team) : null;
    const isAuthor = same(entry.author, req.member._id);
    const isManager = canManageTask(req.member, task, team);

    if (!isAuthor && !isManager) {
        throw httpError("You are not allowed to delete this time entry", 403, "FORBIDDEN");
    }

    await timeEntryModel.deleteOne({ _id: entryId });

    await recordActivity({
        actor: req.member._id,
        action: "time_deleted",
        task: task._id,
        team: task.team,
        meta: { entryId },
        text: `Deleted time entry`,
    });

    successResponse({
        res,
        status: 200,
        message: "Time entry deleted successfully",
        data: { _id: entryId },
    });
};
