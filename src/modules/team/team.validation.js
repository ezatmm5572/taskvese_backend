import joi from "joi";
import { RoleEnum } from "../../commn/enums/member.enums.js";


export const createTeamValidation = {
    body: joi.object({
        name: joi.string().required()
    })
}

export const addMemberToTeamValidation = {
    body: joi.object({
        teamId: joi.string().required(),
        memberId: joi.string().required(),
        role: joi.string().required().valid(RoleEnum.MEMBER, RoleEnum.ADMIN),
    })
}

export const removeMemberFromTeamValidation = {
    body: joi.object({
        teamId: joi.string().required(),
        memberId: joi.string().required(),
    })
}

export const updateMemberRoleInTeamValidation = {
    body: joi.object({
        teamId: joi.string().required(),
        memberId: joi.string().required(),
        role: joi.string().required().valid(RoleEnum.MEMBER, RoleEnum.ADMIN),
    })
}

export const updateTeamNameValidation = {
    body: joi.object({
        teamId: joi.string().required(),
        name: joi.string().required(),
    })
}

export const deleteTeamValidation = {
    body: joi.object({
        teamId: joi.string().required(),
    })
}