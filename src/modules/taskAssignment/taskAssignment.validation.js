import joi from "joi";

const VALID_STATUSES = ["toDo", "inProgress", "completed", "failed", "complete", "fail"];

export const addMemberToTaskValidation = {
    body: joi.object({
        taskId: joi.string().hex().length(24).required(),
        memberId: joi.string().hex().length(24),
        memberIds: joi.array().items(joi.string().hex().length(24)),
    }).or("memberId", "memberIds"),
};

export const removeMemberFromTaskValidation = {
    body: joi.object({
        taskId: joi.string().hex().length(24).required(),
        memberId: joi.string().hex().length(24),
        memberIds: joi.array().items(joi.string().hex().length(24)),
    }).or("memberId", "memberIds"),
};

export const taskStatusByMemberValidation = {
    body: joi.object({
        taskId: joi.string().hex().length(24).required(),
        status: joi.string().valid(...VALID_STATUSES).required(),
        memberId: joi.string().hex().length(24),
    }),
};

export const bulkStatusValidation = {
    body: joi.object({
        taskIds: joi.array().items(joi.string().hex().length(24)).min(1).required(),
        status: joi.string().valid(...VALID_STATUSES).required(),
    }),
};

export const updateProgressValidation = {
    body: joi.object({
        taskId: joi.string().hex().length(24).required(),
        progress: joi.number().integer().min(0).max(100),
        progressStatus: joi.string().valid("todo", "in-progress", "submitted"),
        progressNote: joi.string().allow("").max(2000),
    }).or("progress", "progressStatus", "progressNote"),
};

export const reviewProgressValidation = {
    body: joi.object({
        taskId: joi.string().hex().length(24).required(),
        memberId: joi.string().hex().length(24).required(),
        decision: joi.string().valid("approved", "rejected").required(),
        reviewNote: joi.string().allow("").max(2000),
    }),
};