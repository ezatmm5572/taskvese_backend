import joi from "joi";

export const createTaskValidation = {
    body: joi.object({
        title: joi.string().required(),
        description: joi.string().required(),
        startDate: joi.date().required(),
        endDate: joi.date().required(),
        teamId: joi.string().required(),
    })
}

export const deleteTaskValidation = {
    params: joi.object({
        taskId: joi.string().hex().length(24).required(),
    })
};
