import joi from "joi";

export const getActivityValidation = {
    query: joi.object({
        taskId: joi.string().hex().length(24),
        teamId: joi.string().hex().length(24),
        limit: joi.number().integer().min(1).max(100).default(50),
    }),
};
