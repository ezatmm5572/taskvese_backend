import joi from "joi";
import { RoleEnum } from "../../commn/enums/member.enums.js";

const VALID_ROLES = [
    RoleEnum.MEMBER,
    RoleEnum.ADMIN,
    "member",
    "admin",
    "editor",
    "viewer",
    "teamMember",
    "teamAdmin",
    "teamViewer",
];

export const createTeamValidation = {
    body: joi.object({
        name: joi.string().trim().min(2).max(50).required(),
    }),
};

export const addMemberToTeamValidation = {
    body: joi
        .object({
            teamId: joi.string().hex().length(24).required(),
            memberId: joi.string().hex().length(24),
            memberIds: joi.array().items(joi.string().hex().length(24)),
            member_email: joi.string().email(),
            role: joi.string().valid(...VALID_ROLES).default("editor"),
        })
        .or("memberId", "memberIds", "member_email"),
};

export const removeMemberFromTeamValidation = {
    body: joi
        .object({
            teamId: joi.string().hex().length(24).required(),
            memberId: joi.string().hex().length(24),
            memberIds: joi.array().items(joi.string().hex().length(24)),
        })
        .or("memberId", "memberIds"),
};

export const updateMemberRoleInTeamValidation = {
    body: joi.object({
        teamId: joi.string().hex().length(24).required(),
        memberId: joi.string().hex().length(24).required(),
        role: joi.string().valid(...VALID_ROLES).required(),
    }),
};

export const updateTeamNameValidation = {
    body: joi.object({
        teamId: joi.string().hex().length(24).required(),
        name: joi.string().trim().min(2).max(50).required(),
    }),
};

export const deleteTeamValidation = {
    body: joi.object({
        teamId: joi.string().hex().length(24).required(),
    }),
};

export const restoreTeamValidation = {
    body: joi.object({
        teamId: joi.string().hex().length(24).required(),
    }),
};