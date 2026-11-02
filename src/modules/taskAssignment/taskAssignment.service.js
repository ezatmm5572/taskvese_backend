import mongoose from "mongoose";
import * as DB_services from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { TaskStatusEnum, normalizeTaskStatus } from "../../commn/enums/task.enums.js";
import { taskAssignedTemplate } from "../../commn/email/email_task.teamplate.js";
import {
    httpError,
    canManageTask,
    assertNotViewer,
    isTeamManager,
    same,
} from "../../commn/utils/permissions.js";
import { recordActivity } from "../../commn/utils/activity.service.js";
import { createNotification } from "../../commn/utils/notification.service.js";

// Helper to derive task status from its assignments per Section 3.2
export const deriveTaskStatus = (assignments = []) => {
    if (!assignments || assignments.length === 0) return TaskStatusEnum.TODO;
    const statuses = assignments.map((a) => normalizeTaskStatus(a.status));
    if (statuses.every((s) => s === TaskStatusEnum.COMPLETED)) return TaskStatusEnum.COMPLETED;
    if (statuses.some((s) => s === TaskStatusEnum.FAILED)) return TaskStatusEnum.FAILED;
    if (statuses.some((s) => s === TaskStatusEnum.IN_PROGRESS)) return TaskStatusEnum.IN_PROGRESS;
    return TaskStatusEnum.TODO;
};

// Recurrence spawner per Section 8.1
export const spawnNextRecurrentTask = async (task) => {
    if (!task || !task.recurrence || task.recurrence === "none") return null;

    const alreadySpawned = await taskModel.findOne({ spawnedFrom: task._id });
    if (alreadySpawned) return alreadySpawned;

    let shift = 0;
    if (task.recurrence === "daily") shift = 24 * 60 * 60 * 1000;
    else if (task.recurrence === "weekly") shift = 7 * 24 * 60 * 60 * 1000;
    else if (task.recurrence === "monthly") shift = 30 * 24 * 60 * 60 * 1000;

    const newStart = task.startDate ? new Date(new Date(task.startDate).getTime() + shift) : null;
    const newEnd = task.endDate ? new Date(new Date(task.endDate).getTime() + shift) : null;

    const resetSubtasks = (task.subtasks || []).map((s) => ({
        text: s.text,
        done: false,
    }));

    const newTask = await taskModel.create({
        title: task.title,
        description: task.description,
        startDate: newStart,
        endDate: newEnd,
        team: task.team,
        createdBy: task.createdBy,
        priority: task.priority,
        tags: task.tags,
        recurrence: task.recurrence,
        remindBefore: task.remindBefore,
        estimateMin: task.estimateMin,
        subtasks: resetSubtasks,
        spawnedFrom: task._id,
    });

    const assignments = await taskAssignmentModel.find({ task: task._id });
    for (const a of assignments) {
        await taskAssignmentModel.create({
            task: newTask._id,
            member: a.member,
            assignedBy: a.assignedBy,
            status: TaskStatusEnum.TODO,
            assignedAt: new Date(),
        });
    }

    task.recurrence = "none";
    await task.save();

    return newTask;
};

export const addMemberToTask = async (req, res, next) => {
    const { taskId, memberId, memberIds } = req.body;

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team
        ? await DB_services.findOne({ model: teamModel, filter: { _id: task.team } })
        : null;

    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to assign this task", 403, "FORBIDDEN");
    }

    const idsToAssign = Array.isArray(memberIds) && memberIds.length > 0
        ? memberIds
        : (memberId ? [memberId] : []);

    if (idsToAssign.length === 0) {
        throw httpError("At least one memberId is required", 400, "VALIDATION_ERROR");
    }

    // Helper to check if a member is in the task's team
    const isEligibleAssignee = (targetMember) => {
        if (!targetMember) return false;
        if (!team) {
            // A standalone task may be assigned to its creator or to a member
            // managed by the same admin; never expose another admin's users.
            return same(targetMember._id, req.member._id) || same(targetMember.addedBy, req.member._id);
        }
        return same(team.addedBy, targetMember._id) ||
            (team.teamAdims || []).some((a) => same(a, targetMember._id)) ||
            (team.teamMembers || []).some((m) => same(m, targetMember._id));
    };

    // Single mode: returns 409 ALREADY_ASSIGNED
    if (!memberIds && memberId) {
        const member = await DB_services.findOne({ model: memberModel, filter: { _id: memberId } });
        if (!member) {
            throw httpError("Member not found", 404, "USER_NOT_FOUND");
        }
        if (!isEligibleAssignee(member)) {
            throw httpError("Assignee must belong to the task's team or be managed by you", 400, "NOT_TEAM_MEMBER");
        }

        const already = await DB_services.findOne({
            model: taskAssignmentModel,
            filter: { task: taskId, member: memberId },
        });
        if (already) {
            throw httpError("This member is already assigned to the task", 409, "ALREADY_ASSIGNED");
        }

        const assignment = await DB_services.createDocument({
            model: taskAssignmentModel,
            doc: {
                task: taskId,
                member: memberId,
                assignedBy: req.member._id,
                assignedAt: new Date(),
                status: TaskStatusEnum.TODO,
                completedAt: null,
            },
        });

        // Create in-app notification & send email
        await createNotification({
            user: memberId,
            type: "assigned",
            text: `You were assigned to task "${task.title}"`,
            task: taskId,
            team: task.team,
            actor: req.member._id,
            emailSubject: "New Task Assignment",
            emailHtml: taskAssignedTemplate({
                memberName: (member.fname || "") + " " + (member.lname || ""),
                taskTitle: task.title,
                taskDescription: task.description,
                startDate: task.startDate,
                dueDate: task.endDate,
                priority: task.priority || "Normal",
                assignedBy: (req.member?.fname || "") + " " + (req.member?.lname || ""),
            }),
        });

        await recordActivity({
            actor: req.member._id,
            action: "member_assigned_to_task",
            task: taskId,
            team: task.team,
            meta: { memberId },
            text: `Assigned ${(member.fname || "") + " " + (member.lname || "")} to task`,
        });

        return successResponse({
            res,
            status: 201,
            message: "Member added to task successfully",
            data: assignment,
        });
    }

    // Bulk mode: returns { added: [], skipped: [{ id, code }] }
    const added = [];
    const skipped = [];

    for (const mId of idsToAssign) {
        if (!mongoose.isValidObjectId(mId)) {
            skipped.push({ id: mId, code: "INVALID_ID" });
            continue;
        }

        const member = await DB_services.findOne({ model: memberModel, filter: { _id: mId } });
        if (!member) {
            skipped.push({ id: mId, code: "USER_NOT_FOUND" });
            continue;
        }
        if (!isEligibleAssignee(member)) {
            skipped.push({ id: mId, code: "NOT_TEAM_MEMBER" });
            continue;
        }

        const already = await DB_services.findOne({
            model: taskAssignmentModel,
            filter: { task: taskId, member: mId },
        });
        if (already) {
            skipped.push({ id: mId, code: "ALREADY_ASSIGNED" });
            continue;
        }

        const assignment = await DB_services.createDocument({
            model: taskAssignmentModel,
            doc: {
                task: taskId,
                member: mId,
                assignedBy: req.member._id,
                assignedAt: new Date(),
                status: TaskStatusEnum.TODO,
                completedAt: null,
            },
        });

        added.push(assignment);

        await createNotification({
            user: mId,
            type: "assigned",
            text: `You were assigned to task "${task.title}"`,
            task: taskId,
            team: task.team,
            actor: req.member._id,
            emailSubject: "New Task Assignment",
            emailHtml: taskAssignedTemplate({
                memberName: (member.fname || "") + " " + (member.lname || ""),
                taskTitle: task.title,
                taskDescription: task.description,
                startDate: task.startDate,
                dueDate: task.endDate,
                priority: task.priority || "Normal",
                assignedBy: (req.member?.fname || "") + " " + (req.member?.lname || ""),
            }),
        });

        await recordActivity({
            actor: req.member._id,
            action: "member_assigned_to_task",
            task: taskId,
            team: task.team,
            meta: { memberId: mId },
            text: `Assigned ${(member.fname || "") + " " + (member.lname || "")} to task`,
        });
    }

    successResponse({
        res,
        status: 201,
        message: "Assignment completed",
        data: { added, skipped },
    });
};

export const removeMemberFromTask = async (req, res, next) => {
    const { taskId, memberId, memberIds } = req.body;

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team
        ? await DB_services.findOne({ model: teamModel, filter: { _id: task.team } })
        : null;

    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to remove members from this task", 403, "FORBIDDEN");
    }

    const idsToRemove = Array.isArray(memberIds) && memberIds.length > 0
        ? memberIds
        : (memberId ? [memberId] : []);

    if (idsToRemove.length === 0) {
        throw httpError("At least one memberId is required", 400, "VALIDATION_ERROR");
    }

    for (const mId of idsToRemove) {
        await DB_services.deleteMany({
            model: taskAssignmentModel,
            filter: { task: taskId, member: mId },
        });

        await createNotification({
            user: mId,
            type: "unassigned",
            text: `You were unassigned from task "${task.title}"`,
            task: taskId,
            team: task.team,
            actor: req.member._id,
            sendEmailNotification: false,
        });

        await recordActivity({
            actor: req.member._id,
            action: "member_removed_from_task",
            task: taskId,
            team: task.team,
            meta: { memberId: mId },
            text: `Unassigned member from task "${task.title}"`,
        });
    }

    successResponse({
        res,
        status: 200,
        message: "Members removed from task successfully",
        data: { taskId, memberIds: idsToRemove },
    });
};

export const taskStatusByMember = async (req, res, next) => {
    const { taskId, status, memberId: targetMemberId } = req.body;

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw httpError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const team = task.team
        ? await DB_services.findOne({ model: teamModel, filter: { _id: task.team } })
        : null;

    // Critical Requirement: viewers MUST get 403 VIEWER_READ_ONLY
    assertNotViewer(team, req.member);

    const canonicalStatus = normalizeTaskStatus(status);

    // If targetMemberId provided, only TM can act on behalf
    let effectiveMemberId = req.member._id;
    if (targetMemberId && !same(targetMemberId, req.member._id)) {
        if (!canManageTask(req.member, task, team)) {
            throw httpError("Only task managers can update status on behalf of others", 403, "FORBIDDEN");
        }
        effectiveMemberId = targetMemberId;
    }

    const updated = await DB_services.updateDocument({
        model: taskAssignmentModel,
        filter: { task: taskId, member: effectiveMemberId },
        update: {
            $set: {
                status: canonicalStatus,
                completedAt: canonicalStatus === TaskStatusEnum.COMPLETED ? new Date() : null,
            },
        },
        option: { new: true },
    });

    if (!updated) {
        throw httpError("Member is not assigned to this task", 404, "NOT_FOUND");
    }

    // Recompute task status and check if task completed
    const allAssignments = await taskAssignmentModel.find({ task: taskId });
    const overallTaskStatus = deriveTaskStatus(allAssignments);

    if (overallTaskStatus === TaskStatusEnum.COMPLETED && !task.completedAt) {
        task.completedAt = new Date();
        await task.save();

        // Trigger recurrence if applicable (Section 8.1)
        if (task.recurrence && task.recurrence !== "none") {
            try {
                await spawnNextRecurrentTask(task);
            } catch (e) {
                console.error("Failed to spawn recurrent task:", e);
            }
        }
    } else if (overallTaskStatus !== TaskStatusEnum.COMPLETED && task.completedAt) {
        task.completedAt = null;
        await task.save();
    }

    await recordActivity({
        actor: req.member._id,
        action: "task_status_updated",
        task: taskId,
        team: task.team,
        meta: { status: canonicalStatus, memberId: effectiveMemberId },
        text: `Status updated to ${canonicalStatus}`,
    });

    successResponse({
        res,
        status: 200,
        message: "Task status updated successfully",
        data: {
            ...updated.toObject(),
            derivedTaskStatus: overallTaskStatus,
        },
    });
};

export const bulkStatus = async (req, res, next) => {
    const { taskIds, status } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
        throw httpError("taskIds array is required", 400, "VALIDATION_ERROR");
    }

    const canonicalStatus = normalizeTaskStatus(status);
    const updated = [];
    const skipped = [];

    for (const taskId of taskIds) {
        try {
            const task = await taskModel.findById(taskId);
            if (!task) {
                skipped.push({ id: taskId, code: "TASK_NOT_FOUND" });
                continue;
            }

            const team = task.team ? await teamModel.findById(task.team) : null;
            if (team && isViewerInTeam(team, req.member)) {
                skipped.push({ id: taskId, code: "VIEWER_READ_ONLY" });
                continue;
            }

            const assignment = await taskAssignmentModel.findOneAndUpdate(
                { task: taskId, member: req.member._id },
                {
                    $set: {
                        status: canonicalStatus,
                        completedAt: canonicalStatus === TaskStatusEnum.COMPLETED ? new Date() : null,
                    },
                },
                { new: true }
            );

            if (!assignment) {
                skipped.push({ id: taskId, code: "NOT_ASSIGNED" });
                continue;
            }

            updated.push(taskId);

            const allAssignments = await taskAssignmentModel.find({ task: taskId });
            const overallTaskStatus = deriveTaskStatus(allAssignments);
            if (overallTaskStatus === TaskStatusEnum.COMPLETED && !task.completedAt) {
                task.completedAt = new Date();
                await task.save();
                if (task.recurrence && task.recurrence !== "none") {
                    await spawnNextRecurrentTask(task);
                }
            } else if (overallTaskStatus !== TaskStatusEnum.COMPLETED && task.completedAt) {
                task.completedAt = null;
                await task.save();
            }
        } catch (e) {
            skipped.push({ id: taskId, code: "ERROR" });
        }
    }

    successResponse({
        res,
        status: 200,
        message: "Bulk status update processed",
        data: { updated, skipped },
    });
};

export const getAllAssignments = async (req, res, next) => {
    const userTeams = await teamModel.find({
        deletedAt: null,
        $or: [
            { teamMembers: req.member._id },
            { teamAdims: req.member._id },
            { addedBy: req.member._id },
        ],
    }).distinct("_id");
    const visibleTaskIds = await taskModel.find({
        deletedAt: null,
        $or: [
            { createdBy: req.member._id },
            { team: { $in: userTeams } },
        ],
    }).distinct("_id");
    const assignedTaskIds = await taskAssignmentModel.find({ member: req.member._id }).distinct("task");
    const taskIds = [...new Set([...visibleTaskIds.map(String), ...assignedTaskIds.map(String)])];
    const assignments = await taskAssignmentModel
        .find({ task: { $in: taskIds } })
        .populate({ path: "task", populate: { path: "team", select: "name" } })
        .populate("member", "fname lname email profilePicture")
        .sort({ assignedAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "All assignments",
        data: assignments || [],
    });
};

export const getMyAssignments = async (req, res, next) => {
    const { status } = req.query;
    const filter = { member: req.member._id };
    if (status) {
        filter.status = normalizeTaskStatus(status);
    }

    const assignments = await taskAssignmentModel
        .find(filter)
        .populate({ path: "task", populate: { path: "team", select: "name" } })
        .populate("member", "fname lname email profilePicture")
        .sort({ assignedAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "My assignments",
        data: assignments || [],
    });
};