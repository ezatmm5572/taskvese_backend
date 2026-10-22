import joi from "joi";
import { TaskStatusEnum } from "../../commn/enums/task.enums.js";


export const addMemberToTaskValidation = {
    body: joi.object({
        taskId: joi.string().required(),
        memberId: joi.string().required(),
    })
}

export const taskStatusByMemberValidation = {
    body: joi.object({
        taskId: joi.string().required(),
        status: joi.string().valid(...Object.values(TaskStatusEnum)).required(),
    })
}