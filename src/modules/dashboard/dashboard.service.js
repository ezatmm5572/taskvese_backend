import taskModel from "../../DB/models/task.js";
import teamModel from "../../DB/models/team.js";
import memberModel from "../../DB/models/member.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import timeEntryModel from "../../DB/models/timeEntry.js";
import { successResponse } from "../../commn/utils/successResponse.js";

import { TaskStatusEnum, normalizeTaskStatus } from "../../commn/enums/task.enums.js";

export const getDashboardOverview = async (req, res, next) => {
    const { team } = req.query;
    const query = { deletedAt: null };

    if (team && team !== "all") {
        query.team = team;
    }

    // Task access scoping
    {
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

        const assignedTaskIds = await taskAssignmentModel
            .find({ member: req.member._id })
            .distinct("task");

        query.$or = [
            { createdBy: req.member._id },
            { team: { $in: userTeams } },
            { _id: { $in: assignedTaskIds } },
        ];
    }

    const tasks = await taskModel
        .find(query)
        .populate("team", "_id name")
        .select("_id title startDate endDate completedAt priority estimateMin team createdAt");

    const taskIds = tasks.map((t) => t._id);
    const assignments = await taskAssignmentModel
        .find({ task: { $in: taskIds } })
        .populate("member", "_id fname lname email profilePicture");

    const assignmentsByTask = {};
    for (const a of assignments) {
        const tId = String(a.task);
        if (!assignmentsByTask[tId]) assignmentsByTask[tId] = [];
        assignmentsByTask[tId].push(a);
    }

    const now = new Date();
    let totalTasks = tasks.length;
    let completedCount = 0;
    let overdueCount = 0;
    let blockedCount = 0;
    let inProgressCount = 0;
    let toDoCount = 0;

    const byStatus = {
        toDo: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
    };

    for (const t of tasks) {
        const taskAssigns = assignmentsByTask[String(t._id)] || [];
        const statuses = taskAssigns.map((a) => normalizeTaskStatus(a.status));

        let derived = "toDo";
        if (statuses.length > 0) {
            if (statuses.every((s) => s === "completed")) derived = "completed";
            else if (statuses.some((s) => s === "failed")) derived = "failed";
            else if (statuses.some((s) => s === "inProgress")) derived = "inProgress";
        }

        byStatus[derived] = (byStatus[derived] || 0) + 1;

        if (derived === "completed" || t.completedAt) completedCount++;
        else if (derived === "failed") blockedCount++;
        else if (derived === "inProgress") inProgressCount++;
        else toDoCount++;

        if (!t.completedAt && t.endDate && new Date(t.endDate) < now) {
            overdueCount++;
        }
    }

    const openCount = totalTasks - completedCount;

    // By team breakdown
    const teamMap = {};
    for (const t of tasks) {
        const teamKey = t.team ? String(t.team._id || t.team) : "no_team";
        const teamName = t.team?.name || "No Team";
        if (!teamMap[teamKey]) {
            teamMap[teamKey] = { team: { _id: teamKey, name: teamName }, total: 0, done: 0 };
        }
        teamMap[teamKey].total++;
        if (t.completedAt) teamMap[teamKey].done++;
    }
    const byTeam = Object.values(teamMap);

    // By member breakdown
    const memberMap = {};
    for (const a of assignments) {
        if (!a.member) continue;
        const mId = String(a.member._id || a.member);
        if (!memberMap[mId]) {
            memberMap[mId] = {
                member: {
                    _id: mId,
                    fname: a.member?.fname || "",
                    lname: a.member?.lname || "",
                    email: a.member?.email || "",
                },
                open: 0,
                done: 0,
                late: 0,
                minutes: 0,
            };
        }
        const st = normalizeTaskStatus(a.status);
        if (st === "completed") {
            memberMap[mId].done++;
        } else {
            memberMap[mId].open++;
        }
    }

    // Time logged breakdown
    const timeEntries = await timeEntryModel.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$author", totalMin: { $sum: "$minutes" } } },
    ]);
    for (const te of timeEntries) {
        const mId = String(te._id);
        if (memberMap[mId]) {
            memberMap[mId].minutes = te.totalMin;
        }
    }
    const byMember = Object.values(memberMap);

    const totalLoggedMin = timeEntries.reduce((sum, te) => sum + te.totalMin, 0);
    const totalEstimateMin = tasks.reduce((sum, t) => sum + (t.estimateMin || 0), 0);

    // Burn-down chart calculation for the last 14 days
    const days = 14;
    const fromDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);

    const ideal = [];
    const actual = [];

    for (let i = 0; i < days; i++) {
        const dayEnd = new Date(fromDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
        // Tasks created before dayEnd and not completed before dayEnd
        const activeTasksAtDay = tasks.filter((t) => {
            const createdAt = new Date(t.createdAt);
            if (createdAt > dayEnd) return false;
            if (!t.completedAt) return true;
            return new Date(t.completedAt) > dayEnd;
        }).length;

        actual.push(activeTasksAtDay);
        // Ideal straight line from total to 0
        ideal.push(Math.round(totalTasks * (1 - (i + 1) / days)));
    }

    const overview = {
        totals: {
            tasks: totalTasks,
            completed: completedCount,
            open: openCount,
            overdue: overdueCount,
            blocked: blockedCount,
        },
        byStatus,
        byTeam,
        byMember,
        time: {
            logged: totalLoggedMin,
            estimated: totalEstimateMin,
        },
        burndown: {
            from: fromDate.toISOString(),
            to: now.toISOString(),
            days,
            ideal,
            actual,
        },
    };

    successResponse({
        res,
        status: 200,
        message: "Dashboard overview retrieved successfully",
        data: overview,
    });
};

export const getDashboardTime = async (req, res, next) => {
    const { from, to, team } = req.query;
    const filter = {};

    if (from || to) {
        filter.at = {};
        if (from) filter.at.$gte = new Date(from);
        if (to) filter.at.$lte = new Date(to);
    }

    if (team) {
        const teamTaskIds = await taskModel.find({ team, deletedAt: null }).distinct("_id");
        filter.task = { $in: teamTaskIds };
    }

    const timeByMember = await timeEntryModel.aggregate([
        { $match: filter },
        {
            $group: {
                _id: "$author",
                totalMinutes: { $sum: "$minutes" },
                entryCount: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: "members",
                localField: "_id",
                foreignField: "_id",
                as: "member",
            },
        },
        { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                totalMinutes: 1,
                entryCount: 1,
                "member.fname": 1,
                "member.lname": 1,
                "member.email": 1,
            },
        },
    ]);

    const timeByTask = await timeEntryModel.aggregate([
        { $match: filter },
        {
            $group: {
                _id: "$task",
                totalMinutes: { $sum: "$minutes" },
                entryCount: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: "tasks",
                localField: "_id",
                foreignField: "_id",
                as: "task",
            },
        },
        { $unwind: { path: "$task", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                totalMinutes: 1,
                entryCount: 1,
                "task.title": 1,
            },
        },
    ]);

    successResponse({
        res,
        status: 200,
        message: "Dashboard time breakdown retrieved successfully",
        data: {
            byMember: timeByMember,
            byTask: timeByTask,
        },
    });
};
