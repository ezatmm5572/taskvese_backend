import * as DB_services from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { TaskStatusEnum } from "../../commn/enums/task.enums.js";
import { taskAssignedTemplate } from "../../commn/email/email_task.teamplate.js";
import emailEventEmitter from "../../commn/email/email.events.js";
import { eventsEnum } from "../../commn/enums/eventsEnum.js";
import { httpError, canManageTask } from "../../commn/utils/permissions.js";
import { sendEmail } from "../../commn/email/send.email.js";

export const addMemberToTask = async (req, res, next) => {
    const { taskId, memberId } = req.body;

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw new Error("Task not found");
    }

    const member = await DB_services.findOne({ model: memberModel, filter: { _id: memberId } });
    if (!member) {
        throw new Error("Member not found");
    }

    const team = task.team ? await DB_services.findOne({ model: teamModel, filter: { _id: task.team } }) : null;
    if (!canManageTask(req.member, task, team)) {
        throw httpError("You are not allowed to assign this task", 403);
    }

    const already = await DB_services.findOne({ model: taskAssignmentModel, filter: { task: taskId, member: memberId } });
    if (already) {
        throw httpError("This member is already assigned to the task", 409);
    }

    const assignment = await DB_services.createDocument({
        model: taskAssignmentModel,
        doc: {
            task: taskId,
            member: memberId,
            assignedBy: req.member._id,
            assignedAt: new Date(),
            status: TaskStatusEnum.IN_PROGRESS,
            completedAt: null
        }
    });

    try {
        emailEventEmitter.emit(eventsEnum.confirmEmail, async () => {
            await sendEmail({
                to: member.email,
                subject: "New Task Assignment",
                html: taskAssignedTemplate({
                    memberName: (member.fname || '') + " " + (member.lname || ''),
                    taskTitle: task.title,
                    taskDescription: task.description,
                    startDate: task.startDate,
                    dueDate: task.endDate,
                    priority: 'High',
                    assignedBy: (req.member?.fname || '') + " " + (req.member?.lname || ''),
                })
            });
        });
    } catch (e) {
        console.error("Email notification error:", e.message);
    }

    successResponse({
        res,
        status: 201,
        message: "Member added to task successfully",
        data: assignment
    });
};

export const taskStatusByMember = async (req, res, next) => {
    const { taskId, status } = req.body;

    const task = await DB_services.findOne({ model: taskModel, filter: { _id: taskId } });
    if (!task) {
        throw new Error("Task not found");
    }

    // Only the signed-in member's own assignment may be changed.
    const updated = await DB_services.updateDocument({
        model: taskAssignmentModel,
        filter: { task: taskId, member: req.member._id },
        update: { $set: { status, completedAt: status === TaskStatusEnum.COMPLETE ? new Date() : null } },
        option: { new: true }
    });
    if (!updated) {
        throw httpError("You are not assigned to this task", 404);
    }

    successResponse({
        res,
        status: 200,
        message: "Task status updated successfully",
        data: updated
    });
};

export const getAllAssignments = async (req, res, next) => {
    const filter = req.member.role === 'admin' ? {} : { member: req.member._id };
    const assignments = await taskAssignmentModel.find(filter)
        .populate({ path: "task", populate: { path: "team", select: "name" } })
        .populate("member", "fname lname email")
        .sort({ assignedAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "All assignments",
        data: assignments || []
    });
};