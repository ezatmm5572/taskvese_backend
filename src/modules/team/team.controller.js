import { Router } from "express";
import {
    createTeam,
    getAllTeams,
    getTeamById,
    getTeamActivity,
    addMemberToTeam,
    removeMemberFromTeam,
    updateMemberRoleInTeam,
    updateTeamName,
    deleteTeam,
    restoreTeam,
} from "./team.service.js";
import {
    createTeamValidation,
    addMemberToTeamValidation,
    removeMemberFromTeamValidation,
    updateMemberRoleInTeamValidation,
    updateTeamNameValidation,
    deleteTeamValidation,
    restoreTeamValidation,
} from "./team.validation.js";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";

import { requirePermission } from "../../commn/utils/access-control.js";

const teamRouter = Router();

teamRouter.get("/", authonticaation, requirePermission("view.teams"), getAllTeams);
teamRouter.get("/all", authonticaation, requirePermission("view.teams"), getAllTeams);
teamRouter.post(
    "/createTeam",
    authonticaation,
    requirePermission("team.create"),
    validation(createTeamValidation),
    createTeam
);
teamRouter.post("/addMemberToTeam", authonticaation, requirePermission("team.manage"), validation(addMemberToTeamValidation), addMemberToTeam);
teamRouter.post("/removeMemberFromTeam", authonticaation, requirePermission("team.manage"), validation(removeMemberFromTeamValidation), removeMemberFromTeam);
teamRouter.post("/updateMemberRoleInTeam", authonticaation, requirePermission("team.manage"), validation(updateMemberRoleInTeamValidation), updateMemberRoleInTeam);
teamRouter.post("/updateTeamName", authonticaation, requirePermission("team.manage"), validation(updateTeamNameValidation), updateTeamName);
teamRouter.post("/deleteTeam", authonticaation, requirePermission("team.delete"), validation(deleteTeamValidation), deleteTeam);
teamRouter.post("/restore", authonticaation, requirePermission("team.delete"), validation(restoreTeamValidation), restoreTeam);

// Parameterized team routes
teamRouter.get("/:id", authonticaation, requirePermission("view.teams"), getTeamById);
teamRouter.get("/:id/activity", authonticaation, requirePermission("view.reports"), getTeamActivity);

export default teamRouter;