import joi from "joi";

const VALID_PRIORITIES = ["low", "medium", "high", "urgent", ""];
const VALID_RECURRENCES = ["none", "daily", "weekly", "monthly"];

export const createTaskValidation = {
    body: joi.object({
        title: joi.string().trim().min(2).max(150).required(),
        description: joi.string().trim().max(20000).allow("").default(""),
        startDate: joi.date().allow(null),
        endDate: joi.date().allow(null),
        teamId: joi.string().hex().length(24).allow(null, ""),
        team: joi.string().hex().length(24).allow(null, ""),
        priority: joi.string().valid(...VALID_PRIORITIES).allow("").default(""),
        tags: joi.array().items(joi.string().trim().max(24)).max(10).default([]),
        recurrence: joi.string().valid(...VALID_RECURRENCES).default("none"),
        remindBefore: joi.number().integer().min(0).max(30).default(0),
        estimateMin: joi.number().integer().min(0).default(0),
        subtasks: joi.array().items(joi.alternatives().try(
            joi.string().trim().max(140),
            joi.object({
                text: joi.string().trim().max(140).required(),
                done: joi.boolean().default(false),
            })
        )).max(100).default([]),
        assignees: joi.array().items(joi.string().hex().length(24)).default([]),
    }),
};

export const updateTaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        title: joi.string().trim().min(2).max(150),
        description: joi.string().trim().max(20000).allow(""),
        startDate: joi.date().allow(null),
        endDate: joi.date().allow(null),
        team: joi.string().hex().length(24).allow(null),
        teamId: joi.string().hex().length(24).allow(null),
        priority: joi.string().valid(...VALID_PRIORITIES).allow(""),
        tags: joi.array().items(joi.string().trim().max(24)).max(10),
        recurrence: joi.string().valid(...VALID_RECURRENCES),
        remindBefore: joi.number().integer().min(0).max(30),
        estimateMin: joi.number().integer().min(0),
        archived: joi.boolean(),
    }).min(1),
};

export const deleteTaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24),
    }),
};

export const restoreTaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
};

export const bulkTasksValidation = {
    body: joi.object({
        ids: joi.array().items(joi.string().hex().length(24)).min(1).max(200).required(),
    }),
};

// Subtasks
export const createSubtaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        text: joi.string().trim().min(1).max(140).required(),
    }),
};

export const updateSubtaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        subId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        done: joi.boolean(),
        text: joi.string().trim().min(1).max(140),
    }).min(1),
};

export const deleteSubtaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        subId: joi.string().hex().length(24).required(),
    }),
};

// Comments
export const getCommentsValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
};

export const createCommentValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        text: joi.string().trim().min(1).max(2000).required(),
    }),
};

export const updateCommentValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        commentId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        text: joi.string().trim().min(1).max(2000).required(),
    }),
};

export const deleteCommentValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        commentId: joi.string().hex().length(24).required(),
    }),
};

// Attachments
export const getAttachmentsValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
};

export const deleteAttachmentValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        attId: joi.string().hex().length(24).required(),
    }),
};

// Time
export const getTimeValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
};

export const logTimeValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    }),
    body: joi.object({
        minutes: joi.number().integer().min(1).max(1440).required(),
        note: joi.string().trim().max(140).allow("").default(""),
        at: joi.date().default(Date.now),
    }),
};

export const deleteTimeValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
        entryId: joi.string().hex().length(24).required(),
    }),
};
