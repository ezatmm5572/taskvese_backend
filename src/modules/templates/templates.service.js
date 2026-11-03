import templateModel from "../../DB/models/template.js";
import taskModel from "../../DB/models/task.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import teamModel from "../../DB/models/team.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { httpError, same, isTeamManager, getAdminHierarchyScope, isSystemAdmin, canManageTeamInAdminScope } from "../../commn/utils/permissions.js";
import { TaskStatusEnum } from "../../commn/enums/task.enums.js";

export const getTemplates = async (req, res, next) => {
    // Find user's teams
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

    const templates = await templateModel
        .find({
            $or: [
                { owner: req.member._id },
                ...(isSystemAdmin(req.member) ? [{ owner: { $in: scope.memberIds } }] : []),
                { scope: "team", team: { $in: userTeams } },
            ],
        })
        .populate("owner", "fname lname email")
        .populate("team", "name")
        .sort({ createdAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "Templates retrieved successfully",
        data: templates || [],
    });
};

export const createTemplate = async (req, res, next) => {
    const {
        name,
        scope = "user",
        team = null,
        title = "",
        description = "",
        priority = "",
        tags = [],
        recurrence = "none",
        remindBefore = 0,
        estimateMin = 0,
        checklist = [],
    } = req.body;

    if (!name || !name.trim()) {
        throw httpError("Template name is required", 400, "VALIDATION_ERROR");
    }

    if (scope === "team" && !team) {
        throw httpError("Team is required when scope is 'team'", 400, "VALIDATION_ERROR");
    }

    if (scope === "team" && team) {
        const teamDoc = await teamModel.findById(team);
        if (!teamDoc) throw httpError("Team not found", 404, "NOT_FOUND");
        if (!(await canManageTeamInAdminScope(teamDoc, req.member))) {
            throw httpError("Only team managers can create team templates", 403, "FORBIDDEN");
        }
    }

    const template = await templateModel.create({
        name: name.trim(),
        scope,
        owner: req.member._id,
        team: scope === "team" ? team : null,
        title,
        description,
        priority,
        tags,
        recurrence,
        remindBefore,
        estimateMin,
        checklist: (Array.isArray(checklist) ? checklist : []).slice(0, 50),
    });

    successResponse({
        res,
        status: 201,
        message: "Template created successfully",
        data: template,
    });
};

export const deleteTemplate = async (req, res, next) => {
    const { id } = req.params;
    const template = await templateModel.findById(id);
    if (!template) {
        throw httpError("Template not found", 404, "NOT_FOUND");
    }

    let allowed = same(template.owner, req.member._id);
    if (!allowed && template.team) {
        const teamDoc = await teamModel.findById(template.team);
        if (teamDoc && await canManageTeamInAdminScope(teamDoc, req.member)) {
            allowed = true;
        }
    }

    if (!allowed) {
        throw httpError("You are not allowed to delete this template", 403, "FORBIDDEN");
    }

    await templateModel.deleteOne({ _id: id });

    successResponse({
        res,
        status: 200,
        message: "Template deleted successfully",
        data: { _id: id },
    });
};

export const applyTemplate = async (req, res, next) => {
    const { id } = req.params;
    const { team = null, startDate = new Date(), endDate = null, assignees = [] } = req.body;

    const template = await templateModel.findById(id);
    if (!template) {
        throw httpError("Template not found", 404, "NOT_FOUND");
    }

    const subtasks = (template.checklist || []).map((text) => ({
        text,
        done: false,
    }));

    const task = await taskModel.create({
        title: template.title || template.name,
        description: template.description || "",
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        team: team || template.team,
        createdBy: req.member._id,
        priority: template.priority || "",
        tags: template.tags || [],
        recurrence: template.recurrence || "none",
        remindBefore: template.remindBefore || 0,
        estimateMin: template.estimateMin || 0,
        subtasks,
    });

    if (Array.isArray(assignees) && assignees.length > 0) {
        for (const mId of assignees) {
            await taskAssignmentModel.create({
                task: task._id,
                member: mId,
                assignedBy: req.member._id,
                status: TaskStatusEnum.TODO,
                assignedAt: new Date(),
            });
        }
    }

    successResponse({
        res,
        status: 201,
        message: "Task created from template successfully",
        data: task,
    });
};
