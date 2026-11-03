import taskModel from "../../DB/models/task.js";
import teamModel from "../../DB/models/team.js";
import memberModel from "../../DB/models/member.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import commentModel from "../../DB/models/comment.js";
import timeEntryModel from "../../DB/models/timeEntry.js";
import { successResponse } from "../../commn/utils/successResponse.js";

import { deriveTaskStatus } from "../taskAssignment/taskAssignment.service.js";
import { normalizeTaskStatus } from "../../commn/enums/task.enums.js";
import accessConfigModel from "../../DB/models/accessConfig.js";
import accessOverrideModel from "../../DB/models/accessOverride.js";
import accessAuditModel from "../../DB/models/accessAudit.js";
import { isSystemAdmin, getAdminHierarchyScope } from "../../commn/utils/permissions.js";

// Global Search
export const search = async (req, res, next) => {
    const { q = "", types = "task,team,member", limit = 20 } = req.query;
    const searchLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const searchTypes = types.split(",").map((t) => t.trim().toLowerCase());

    const regex = new RegExp(String(q).trim(), "i");
    const results = {};
    const scope = await getAdminHierarchyScope(req.member);
    const visibleTeamIds = await teamModel.find({
        deletedAt: null,
        $or: [
            { teamMembers: req.member._id }, { teamAdims: req.member._id }, { addedBy: req.member._id },
            ...(isSystemAdmin(req.member) ? [
                { addedBy: { $in: scope.memberIds } },
                { teamMembers: { $in: scope.memberIds } },
                { teamAdims: { $in: scope.memberIds } },
            ] : []),
        ],
    }).distinct("_id");
    const assignedTaskIds = await taskAssignmentModel.find({ member: req.member._id }).distinct("task");

    if (searchTypes.includes("task") && q) {
        results.tasks = await taskModel
            .find({
                deletedAt: null,
                $and: [
                    { $or: [{ title: regex }, { description: regex }, { tags: regex }] },
                    { $or: [
                        { team: { $in: visibleTeamIds } },
                        { _id: { $in: assignedTaskIds } },
                        ...(isSystemAdmin(req.member) ? [{ createdBy: { $in: scope.memberIds } }] : []),
                        { createdBy: req.member._id },
                    ] },
                ],
            })
            .populate("team", "name")
            .limit(searchLimit)
            .select("_id title description priority tags team startDate endDate completedAt");
    }

    if (searchTypes.includes("team") && q) {
        results.teams = await teamModel
            .find({
                deletedAt: null,
                name: regex,
                _id: { $in: visibleTeamIds },
            })
            .limit(searchLimit)
            .select("_id name");
    }

    if (searchTypes.includes("member") && q) {
        results.members = await memberModel
            .find({
                active: { $ne: false },
                $and: [
                    { $or: [{ fname: regex }, { lname: regex }, { email: regex }] },
                    isSystemAdmin(req.member)
                        ? { _id: { $in: scope.memberIds } }
                        : { teams: { $elemMatch: { teamId: { $in: visibleTeamIds } } } },
                ],
            })
            .limit(searchLimit)
            .select("_id fname lname email profilePicture");
    }

    successResponse({
        res,
        status: 200,
        message: "Search results",
        data: results,
    });
};

// Delta Changes Endpoint (/changes?since=<ISO>)
export const getChanges = async (req, res, next) => {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    // Tasks upserted and deleted
    const upsertedTasks = await taskModel
        .find({ updatedAt: { $gte: sinceDate }, deletedAt: null })
        .distinct("_id");
    const deletedTasks = await taskModel
        .find({ deletedAt: { $gte: sinceDate } })
        .distinct("_id");

    // Teams upserted and deleted
    const upsertedTeams = await teamModel
        .find({ updatedAt: { $gte: sinceDate }, deletedAt: null })
        .distinct("_id");
    const deletedTeams = await teamModel
        .find({ deletedAt: { $gte: sinceDate } })
        .distinct("_id");

    // Members upserted
    const upsertedMembers = await memberModel
        .find({ updatedAt: { $gte: sinceDate } })
        .distinct("_id");

    // Assignments upserted
    const upsertedAssignments = await taskAssignmentModel
        .find({ updatedAt: { $gte: sinceDate } })
        .distinct("_id");

    // Restrict delta IDs to entities the current member is allowed to discover.
    const scope = await getAdminHierarchyScope(req.member);
    let visibleTeamIds = await teamModel.find({
        $or: [
            { teamMembers: req.member._id }, { teamAdims: req.member._id }, { addedBy: req.member._id },
            ...(isSystemAdmin(req.member) ? [
                { addedBy: { $in: scope.memberIds } },
                { teamMembers: { $in: scope.memberIds } },
                { teamAdims: { $in: scope.memberIds } },
            ] : []),
        ],
    }).distinct("_id");
    let visibleTaskIds = await taskModel.find({
        $or: [
            { createdBy: req.member._id },
            ...(isSystemAdmin(req.member) ? [{ createdBy: { $in: scope.memberIds } }] : []),
            { team: { $in: visibleTeamIds } },
        ],
    }).distinct("_id");
    const assignedIds = await taskAssignmentModel.find({ member: req.member._id }).distinct("task");
    visibleTaskIds = [...new Set([...visibleTaskIds.map(String), ...assignedIds.map(String)])];
    const visibleMemberIds = isSystemAdmin(req.member)
        ? scope.memberIds
        : await memberModel.find({ teams: { $elemMatch: { teamId: { $in: visibleTeamIds } } } }).distinct("_id");
    const filterIds = (values, allowed) => values.filter((id) => allowed.has(String(id)));
    const allowedTasks = new Set(visibleTaskIds);
    const allowedTeams = new Set(visibleTeamIds.map(String));
    const allowedMembers = new Set(visibleMemberIds.map(String));
    const visibleAssignmentIds = await taskAssignmentModel
        .find({ _id: { $in: upsertedAssignments }, task: { $in: visibleTaskIds } })
        .distinct("_id");

    const config = await accessConfigModel.findOne().lean();
    const override = await accessOverrideModel.findOne({ member: req.member._id }).lean();
    const accessAuditChanged = await accessAuditModel.exists({
        action: { $in: ["override.changed", "role.changed"] },
        target: req.member._id,
        createdAt: { $gte: sinceDate },
    });
    const accessChanged = (config?.updatedAt && config.updatedAt >= sinceDate) ||
        (override?.updatedAt && override.updatedAt >= sinceDate) || !!accessAuditChanged;
    successResponse({
        res,
        status: 200,
        message: "Changes delta",
        data: {
            now: now.toISOString(),
            tasks: { upserted: filterIds(upsertedTasks, allowedTasks), deleted: filterIds(deletedTasks, allowedTasks) },
            teams: { upserted: filterIds(upsertedTeams, allowedTeams), deleted: filterIds(deletedTeams, allowedTeams) },
            members: { upserted: filterIds(upsertedMembers, allowedMembers), deleted: [] },
            assignments: { upserted: visibleAssignmentIds, deleted: [] },
            access: { upserted: accessChanged ? ["config", String(req.member._id)] : [], deleted: [] },
        },
    });
};

// CSV Export with UTF-8 BOM
export const exportTasksCsv = async (req, res, next) => {
    const { team, status, priority, tag, archived } = req.query;
    const query = { deletedAt: null };

    if (archived === "true") query.archived = true;
    else query.archived = false;

    if (team) query.team = team;
    if (priority) query.priority = priority;
    if (tag) query.tags = tag.toLowerCase();

    // Access scoping
    {
        const scope = await getAdminHierarchyScope(req.member);
        const userTeams = await teamModel
            .find({
                deletedAt: null,
                $or: [
                    { teamMembers: req.member._id },
                    { teamAdims: req.member._id },
                    { addedBy: req.member._id },
                    ...(isSystemAdmin(req.member) ? [
                        { addedBy: { $in: scope.memberIds } },
                        { teamMembers: { $in: scope.memberIds } },
                        { teamAdims: { $in: scope.memberIds } },
                    ] : []),
                ],
            })
            .distinct("_id");

        const assignedTaskIds = await taskAssignmentModel
            .find({ member: req.member._id })
            .distinct("task");

        query.$or = [
            { createdBy: req.member._id },
            ...(isSystemAdmin(req.member) ? [{ createdBy: { $in: scope.memberIds } }] : []),
            { team: { $in: userTeams } },
            { _id: { $in: assignedTaskIds } },
        ];
    }

    const tasks = await taskModel
        .find(query)
        .populate("team", "name")
        .sort({ createdAt: -1 });

    const taskIds = tasks.map((t) => t._id);
    const assignments = await taskAssignmentModel
        .find({ task: { $in: taskIds } })
        .populate("member", "fname lname email");

    const assignmentsByTask = {};
    for (const a of assignments) {
        const tId = String(a.task);
        if (!assignmentsByTask[tId]) assignmentsByTask[tId] = [];
        assignmentsByTask[tId].push(a);
    }

    const timeAgg = await timeEntryModel.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$task", totalMin: { $sum: "$minutes" } } },
    ]);
    const timeMap = Object.fromEntries(timeAgg.map((te) => [String(te._id), te.totalMin]));

    // CSV Headers
    const headers = [
        "Title",
        "Team",
        "Status",
        "Priority",
        "Tags",
        "Assignees",
        "Start",
        "Due",
        "Estimated (h)",
        "Logged (h)",
        "Subtasks done/total",
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = tasks.map((t) => {
        const taskAssigns = assignmentsByTask[String(t._id)] || [];
        const derivedStatus = deriveTaskStatus(taskAssigns);
        const assigneeNames = taskAssigns
            .map((a) => `${a.member?.fname || ""} ${a.member?.lname || ""}`.trim())
            .join("; ");
        const subtasksTotal = t.subtasks?.length || 0;
        const subtasksDone = (t.subtasks || []).filter((s) => s.done).length;
        const loggedMin = timeMap[String(t._id)] || 0;

        return [
            escapeCsv(t.title),
            escapeCsv(t.team?.name || "None"),
            escapeCsv(derivedStatus),
            escapeCsv(t.priority || "Normal"),
            escapeCsv((t.tags || []).join(", ")),
            escapeCsv(assigneeNames),
            escapeCsv(t.startDate ? t.startDate.toISOString().split("T")[0] : ""),
            escapeCsv(t.endDate ? t.endDate.toISOString().split("T")[0] : ""),
            escapeCsv(((t.estimateMin || 0) / 60).toFixed(1)),
            escapeCsv((loggedMin / 60).toFixed(1)),
            escapeCsv(`${subtasksDone}/${subtasksTotal}`),
        ].join(",");
    });

    // UTF-8 BOM: \uFEFF
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="tasks.csv"');
    res.status(200).send(csvContent);
};

// Summary Report PDF / JSON fallback
export const exportReport = async (req, res, next) => {
    const { team } = req.query;
    const query = { deletedAt: null };
    if (team) query.team = team;

    const scope = await getAdminHierarchyScope(req.member);
    const userTeams = await teamModel
        .find({
            deletedAt: null,
            $or: [
                { teamMembers: req.member._id },
                { teamAdims: req.member._id },
                { addedBy: req.member._id },
                ...(isSystemAdmin(req.member) ? [
                    { addedBy: { $in: scope.memberIds } },
                    { teamMembers: { $in: scope.memberIds } },
                    { teamAdims: { $in: scope.memberIds } },
                ] : []),
            ],
        })
        .distinct("_id");
    const assignedTaskIds = await taskAssignmentModel
        .find({ member: req.member._id })
        .distinct("task");
    query.$or = [
        { createdBy: req.member._id },
        ...(isSystemAdmin(req.member) ? [{ createdBy: { $in: scope.memberIds } }] : []),
        { team: { $in: userTeams } },
        { _id: { $in: assignedTaskIds } },
    ];

    const tasks = await taskModel.find(query).populate("team", "name");
    const summary = {
        generatedAt: new Date().toISOString(),
        team: team || "All",
        totalTasks: tasks.length,
        completed: tasks.filter((t) => t.completedAt).length,
        open: tasks.filter((t) => !t.completedAt).length,
    };

    successResponse({
        res,
        status: 200,
        message: "Report summary",
        data: summary,
    });
};
