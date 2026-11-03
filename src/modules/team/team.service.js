import mongoose from "mongoose";
import { successResponse } from "../../commn/utils/successResponse.js";
import * as DB_services from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import activityModel from "../../DB/models/activity.js";
import accessAuditModel from "../../DB/models/accessAudit.js";
import { deriveAccessRole } from "../../commn/utils/access-control.js";
import { broadcastEvent } from "../events/events.service.js";
import { isTeamManager, httpError, normalizeTeamRole } from "../../commn/utils/permissions.js";
import { recordActivity } from "../../commn/utils/activity.service.js";


const recordTeamAccessRoleChange = async ({
    actorId, memberId, teamId, teamName, beforeTeamRole, afterTeamRole, beforeEffectiveRole,
}) => {
    const updatedMember = await memberModel.findById(memberId)
        .select("_id fname lname role teams")
        .lean();
    if (!updatedMember) return;

    const afterEffectiveRole = await deriveAccessRole(updatedMember);
    await accessAuditModel.create({
        actor: actorId,
        action: "role.changed",
        target: memberId,
        text: `Team role changed for ${updatedMember.fname} ${updatedMember.lname} in ${teamName}: ${beforeTeamRole || "not a member"} → ${afterTeamRole || "removed"}`,
        before: {
            teamId,
            teamRole: beforeTeamRole || null,
            effectiveRole: beforeEffectiveRole,
        },
        after: {
            teamId,
            teamRole: afterTeamRole || null,
            effectiveRole: afterEffectiveRole,
        },
    });
    broadcastEvent({
        type: "access.updated",
        actorId: String(actorId),
        targetUserId: String(memberId),
        message: "team-role",
    });
};

export const createTeam = async (req, res, next) => {
    const { name } = req.body;

    const team = await DB_services.createDocument({
        model: teamModel,
        doc: {
            name,
            addedBy: req.member._id,
            teamAdims: [req.member._id],
            teamMembers: [req.member._id],
        },
    });

    await DB_services.updateDocument({
        model: memberModel,
        filter: { _id: req.member._id },
        update: { $push: { teams: { teamId: team._id, role: "admin" } } },
    });

    await recordActivity({
        actor: req.member._id,
        action: "team_created",
        team: team._id,
        meta: { name: team.name },
    });

    successResponse({
        res,
        status: 201,
        message: "Team created successfully",
        data: team,
    });
};

export const getAllTeams = async (req, res, next) => {
    const filter = {
        deletedAt: null,
        $or: [
            { teamMembers: req.member._id },
            { addedBy: req.member._id },
            { teamAdims: req.member._id },
        ],
    };

    const teams = await teamModel
        .find(filter)
        .populate("teamMembers", "fname lname email")
        .populate("addedBy", "fname lname email")
        .sort({ createdAt: -1 });

    successResponse({
        res,
        status: 200,
        message: "All teams",
        data: teams || [],
    });
};

export const getTeamById = async (req, res, next) => {
    const { id } = req.params;

    const team = await teamModel
        .findOne({ _id: id, deletedAt: null })
        .populate("teamMembers", "fname lname email profilePicture")
        .populate("teamAdims", "fname lname email profilePicture")
        .populate("addedBy", "fname lname email profilePicture");

    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }
    const canViewTeam = String(team.addedBy) === String(req.member._id) ||
        (team.teamAdims || []).some((id) => String(id) === String(req.member._id)) ||
        (team.teamMembers || []).some((id) => String(id) === String(req.member._id));
    if (!canViewTeam) throw httpError("You are not a member of this team", 403, "FORBIDDEN");

    // Get task counts for this team
    const totalTasks = await taskModel.countDocuments({ team: id, deletedAt: null });
    const completedTasks = await taskModel.countDocuments({
        team: id,
        deletedAt: null,
        completedAt: { $ne: null },
    });
    const overdueTasks = await taskModel.countDocuments({
        team: id,
        deletedAt: null,
        completedAt: null,
        endDate: { $lt: new Date() },
    });

    // Populate role per member
    const membersWithRole = await Promise.all(
        (team.teamMembers || []).map(async (m) => {
            const memberDoc = await memberModel.findById(m._id);
            const teamEntry = (memberDoc?.teams || []).find(
                (t) => String(t.teamId) === String(team._id)
            );
            const role = normalizeTeamRole(teamEntry?.role);
            return {
                member: m,
                role: (team.teamAdims || []).some((a) => String(a._id) === String(m._id))
                    ? "admin"
                    : role,
            };
        })
    );

    const teamObj = team.toObject();
    teamObj.membersWithRoles = membersWithRole;
    teamObj.taskCounts = {
        total: totalTasks,
        completed: completedTasks,
        open: totalTasks - completedTasks,
        overdue: overdueTasks,
    };

    successResponse({
        res,
        status: 200,
        message: "Team details",
        data: teamObj,
    });
};

export const getTeamActivity = async (req, res, next) => {
    const { id } = req.params;

    const team = await teamModel.findOne({ _id: id, deletedAt: null });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }
    const canViewTeam = String(team.addedBy) === String(req.member._id) ||
        (team.teamAdims || []).some((id) => String(id) === String(req.member._id)) ||
        (team.teamMembers || []).some((id) => String(id) === String(req.member._id));
    if (!canViewTeam) throw httpError("You are not a member of this team", 403, "FORBIDDEN");

    const activities = await activityModel
        .find({ team: id })
        .populate("actor", "fname lname email profilePicture")
        .populate("task", "title")
        .sort({ createdAt: -1 })
        .limit(100);

    successResponse({
        res,
        status: 200,
        message: "Team activity log",
        data: activities || [],
    });
};

export const addMemberToTeam = async (req, res, next) => {
    const { teamId, memberId, memberIds, role = "editor" } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId, deletedAt: null } });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    const canonicalRole = normalizeTeamRole(role);
    const asAdmin = canonicalRole === "admin";

    // Bulk mode
    if (Array.isArray(memberIds) && memberIds.length > 0) {
        const added = [];
        for (const mId of memberIds) {
            if (!mongoose.isValidObjectId(mId)) continue;
            const member = await DB_services.findOne({ model: memberModel, filter: { _id: mId } });
            if (!member) continue;

            const isMember = await DB_services.findOne({
                model: teamModel,
                filter: { _id: teamId, teamMembers: member._id },
            });
            if (isMember) continue;
            const beforeTeamRole = null;
            const beforeEffectiveRole = await deriveAccessRole(member);

            await DB_services.updateDocument({
                model: teamModel,
                filter: { _id: teamId },
                update: {
                    $addToSet: asAdmin
                        ? { teamMembers: member._id, teamAdims: member._id }
                        : { teamMembers: member._id },
                },
            });

            await DB_services.updateDocument({
                model: memberModel,
                filter: { _id: member._id },
                update: {
                    $push: {
                        teams: { teamId: team._id, role: canonicalRole },
                    },
                },
            });

            added.push(mId);
            await recordTeamAccessRoleChange({
                actorId: req.member._id,
                memberId: member._id,
                teamId: team._id,
                teamName: team.name,
                beforeTeamRole,
                afterTeamRole: canonicalRole,
                beforeEffectiveRole,
            });

            await recordActivity({
                actor: req.member._id,
                action: "member_added_to_team",
                team: teamId,
                meta: { memberId: member._id, role: canonicalRole },
            });
        }

        return successResponse({
            res,
            status: 200,
            message: "Members added to team successfully",
            data: { teamId, addedMembers: added },
        });
    }

    // Single mode
    const targetId = memberId;
    if (!targetId || !mongoose.isValidObjectId(targetId)) {
        throw httpError("A valid memberId is required", 400, "VALIDATION_ERROR");
    }

    const member = await DB_services.findOne({ model: memberModel, filter: { _id: targetId } });
    if (!member) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    const isMember = await DB_services.findOne({
        model: teamModel,
        filter: { _id: teamId, teamMembers: member._id },
    });
    if (isMember) {
        throw httpError("Member already in team", 409, "MEMBER_EXISTS");
    }
    const beforeEffectiveRole = await deriveAccessRole(member);

    await DB_services.updateDocument({
        model: teamModel,
        filter: { _id: teamId },
        update: {
            $addToSet: asAdmin
                ? { teamMembers: member._id, teamAdims: member._id }
                : { teamMembers: member._id },
        },
    });

    await DB_services.updateDocument({
        model: memberModel,
        filter: { _id: member._id },
        update: {
            $push: {
                teams: { teamId: team._id, role: canonicalRole },
            },
        },
    });

    await recordTeamAccessRoleChange({
        actorId: req.member._id,
        memberId: member._id,
        teamId: team._id,
        teamName: team.name,
        beforeTeamRole: null,
        afterTeamRole: canonicalRole,
        beforeEffectiveRole,
    });

    await recordActivity({
        actor: req.member._id,
        action: "member_added_to_team",
        team: teamId,
        meta: { memberId: member._id, role: canonicalRole },
    });

    successResponse({
        res,
        status: 200,
        message: "Member added to team successfully",
        data: { teamId, memberId: member._id, role: canonicalRole },
    });
};

export const removeMemberFromTeam = async (req, res, next) => {
    const { teamId, memberId, memberIds } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId } });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    const idsToRemove = Array.isArray(memberIds) && memberIds.length > 0
        ? memberIds
        : (memberId ? [memberId] : []);

    if (idsToRemove.length === 0) {
        throw httpError("At least one memberId is required", 400, "VALIDATION_ERROR");
    }

    for (const mId of idsToRemove) {
        if (!mongoose.isValidObjectId(mId)) continue;
        const memberBeforeRemoval = await memberModel.findById(mId).select("_id fname lname role teams").lean();
        const beforeTeamRole = memberBeforeRemoval?.teams?.find((entry) => String(entry.teamId) === String(teamId))?.role || null;
        const beforeEffectiveRole = memberBeforeRemoval ? await deriveAccessRole(memberBeforeRemoval) : null;
        await DB_services.updateDocument({
            model: teamModel,
            filter: { _id: teamId },
            update: { $pull: { teamMembers: mId, teamAdims: mId } },
        });
        await DB_services.updateDocument({
            model: memberModel,
            filter: { _id: mId },
            update: { $pull: { teams: { teamId } } },
        });
        if (memberBeforeRemoval) {
            await recordTeamAccessRoleChange({
                actorId: req.member._id,
                memberId: mId,
                teamId: team._id,
                teamName: team.name,
                beforeTeamRole,
                afterTeamRole: null,
                beforeEffectiveRole,
            });
        }
        await recordActivity({
            actor: req.member._id,
            action: "member_removed_from_team",
            team: teamId,
            meta: { memberId: mId },
        });
    }

    successResponse({
        res,
        status: 200,
        message: "Members removed from team successfully",
        data: { teamId, removedMembers: idsToRemove },
    });
};

export const updateMemberRoleInTeam = async (req, res, next) => {
    const { teamId, memberId, role } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId, deletedAt: null } });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    const member = await DB_services.findOne({ model: memberModel, filter: { _id: memberId } });
    if (!member) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    const isMember = await DB_services.findOne({
        model: teamModel,
        filter: { _id: teamId, teamMembers: memberId },
    });
    if (!isMember) {
        throw httpError("Member not found in team", 404, "USER_NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    const canonicalRole = normalizeTeamRole(role);
    const beforeTeamRole = member.teams?.find((entry) => String(entry.teamId) === String(teamId))?.role || null;
    const beforeEffectiveRole = await deriveAccessRole(member);
    const asAdmin = canonicalRole === "admin";

    if (asAdmin) {
        await DB_services.updateDocument({
            model: teamModel,
            filter: { _id: teamId },
            update: { $addToSet: { teamAdims: memberId } },
        });
    } else {
        await DB_services.updateDocument({
            model: teamModel,
            filter: { _id: teamId },
            update: { $pull: { teamAdims: memberId } },
        });
    }

    // Update role in member's teams array
    const memberRoleUpdate = await memberModel.updateOne(
        { _id: memberId, "teams.teamId": teamId },
        { $set: { "teams.$.role": canonicalRole } }
    );
    if (!memberRoleUpdate.matchedCount) {
        // Repair older/inconsistent membership records instead of silently leaving
        // the derived access role unchanged.
        await memberModel.updateOne(
            { _id: memberId },
            { $push: { teams: { teamId, role: canonicalRole } } }
        );
    }

    await recordTeamAccessRoleChange({
        actorId: req.member._id,
        memberId,
        teamId: team._id,
        teamName: team.name,
        beforeTeamRole,
        afterTeamRole: canonicalRole,
        beforeEffectiveRole,
    });

    await recordActivity({
        actor: req.member._id,
        action: "member_role_updated",
        team: teamId,
        meta: { memberId, role: canonicalRole },
    });

    successResponse({
        res,
        status: 200,
        message: "Member role updated successfully",
        data: { teamId, memberId, role: canonicalRole },
    });
};

export const updateTeamName = async (req, res, next) => {
    const { teamId, name } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId, deletedAt: null } });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    const updateTeam = await DB_services.updateDocument({
        model: teamModel,
        filter: { _id: teamId },
        update: { $set: { name } },
        option: { new: true },
    });

    await recordActivity({
        actor: req.member._id,
        action: "team_name_updated",
        team: teamId,
        meta: { name },
    });

    successResponse({
        res,
        status: 200,
        message: "Team name updated successfully",
        data: updateTeam,
    });
};

export const deleteTeam = async (req, res, next) => {
    const { teamId } = req.body;

    const team = await DB_services.findOne({ model: teamModel, filter: { _id: teamId } });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    // Section 4.11 & 5.4: Soft delete team (tasks keep team until 30-day purge)
    await DB_services.updateDocument({
        model: teamModel,
        filter: { _id: teamId },
        update: { $set: { deletedAt: new Date() } },
    });

    await recordActivity({
        actor: req.member._id,
        action: "team_deleted",
        team: teamId,
        meta: { name: team.name },
    });

    successResponse({
        res,
        status: 200,
        message: "Team deleted successfully",
        data: { _id: teamId, deletedAt: new Date() },
    });
};

export const restoreTeam = async (req, res, next) => {
    const { teamId } = req.body;

    const team = await teamModel.findOne({ _id: teamId });
    if (!team) {
        throw httpError("Team not found", 404, "NOT_FOUND");
    }

    if (!isTeamManager(team, req.member)) {
        throw httpError("You are not the team admin", 403, "NOT_TEAM_MANAGER");
    }

    if (!team.deletedAt) {
        throw httpError("Team is not deleted", 400, "BAD_REQUEST");
    }

    // Check 30-day restore window
    const daysSinceDelete = (Date.now() - new Date(team.deletedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > 30) {
        throw httpError("Cannot restore team: past 30-day retention window", 400, "RESTORE_WINDOW_EXPIRED");
    }

    team.deletedAt = null;
    await team.save();

    await recordActivity({
        actor: req.member._id,
        action: "team_restored",
        team: teamId,
        meta: { name: team.name },
    });

    successResponse({
        res,
        status: 200,
        message: "Team restored successfully",
        data: team,
    });
};
