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
import { authorization } from "../../commn/middleware/authorization.js";
import { RoleEnum } from "../../commn/enums/member.enums.js";
import { validation } from "../../commn/middleware/validation.js";

const teamRouter = Router();

teamRouter.get("/", authonticaation, getAllTeams);
teamRouter.get("/all", authonticaation, getAllTeams);
teamRouter.post(
    "/createTeam",
    authonticaation,
    authorization([RoleEnum.ADMIN]),
    validation(createTeamValidation),
    createTeam
);
teamRouter.post("/addMemberToTeam", authonticaation, validation(addMemberToTeamValidation), addMemberToTeam);
teamRouter.post("/removeMemberFromTeam", authonticaation, validation(removeMemberFromTeamValidation), removeMemberFromTeam);
teamRouter.post("/updateMemberRoleInTeam", authonticaation, validation(updateMemberRoleInTeamValidation), updateMemberRoleInTeam);
teamRouter.post("/updateTeamName", authonticaation, validation(updateTeamNameValidation), updateTeamName);
teamRouter.post("/deleteTeam", authonticaation, validation(deleteTeamValidation), deleteTeam);
teamRouter.post("/restore", authonticaation, validation(restoreTeamValidation), restoreTeam);

// Parameterized team routes
teamRouter.get("/:id", authonticaation, getTeamById);
teamRouter.get("/:id/activity", authonticaation, getTeamActivity);

export default teamRouter;