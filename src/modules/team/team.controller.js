import {Router} from "express"
import { createTeam } from "./team.service.js"
import { createTeamValidation } from "./team.validation.js"
import { authonticaation } from "../../commn/middleware/authontication.js"
import { authorization } from "../../commn/middleware/authorization.js"
import { RoleEnum } from "../../commn/enums/member.enums.js"
import {
    addMemberToTeam,
    removeMemberFromTeam,
    updateMemberRoleInTeam,
    updateTeamName,
    deleteTeam,
    getAllTeams
} from "./team.service.js"
import {
    addMemberToTeamValidation,
    removeMemberFromTeamValidation,
    updateMemberRoleInTeamValidation,
    updateTeamNameValidation,
    deleteTeamValidation
} from "./team.validation.js"
import { validation } from "../../commn/middleware/validation.js"



const teamRouter=Router()

teamRouter.get("/", authonticaation, getAllTeams)
teamRouter.get("/all", authonticaation, getAllTeams)
teamRouter.post("/createTeam",authonticaation,authorization([RoleEnum.ADMIN]),validation(createTeamValidation),createTeam)
teamRouter.post("/addMemberToTeam",authonticaation,validation(addMemberToTeamValidation),addMemberToTeam)
teamRouter.post("/removeMemberFromTeam",authonticaation,validation(removeMemberFromTeamValidation),removeMemberFromTeam)
teamRouter.post("/updateMemberRoleInTeam",authonticaation,validation(updateMemberRoleInTeamValidation),updateMemberRoleInTeam)
teamRouter.post("/updateTeamName",authonticaation,validation(updateTeamNameValidation),updateTeamName)
teamRouter.post("/deleteTeam",authonticaation,validation(deleteTeamValidation),deleteTeam)


export default teamRouter