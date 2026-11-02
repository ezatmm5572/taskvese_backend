import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import {
    addMemberToTask,
    removeMemberFromTask,
    taskStatusByMember,
    bulkStatus,
    getAllAssignments,
    getMyAssignments,
} from "./taskAssignment.service.js";
import {
    addMemberToTaskValidation,
    removeMemberFromTaskValidation,
    taskStatusByMemberValidation,
    bulkStatusValidation,
} from "./taskAssignment.validation.js";

const taskAssignmentRouter = Router();

taskAssignmentRouter.get("/", authonticaation, getAllAssignments);
taskAssignmentRouter.get("/all", authonticaation, getAllAssignments);
taskAssignmentRouter.get("/mine", authonticaation, getMyAssignments);

taskAssignmentRouter.post(
    "/addMemberToTask",
    authonticaation,
    validation(addMemberToTaskValidation),
    addMemberToTask
);
taskAssignmentRouter.post(
    "/removeMemberFromTask",
    authonticaation,
    validation(removeMemberFromTaskValidation),
    removeMemberFromTask
);
taskAssignmentRouter.patch(
    "/taskStatusByMember",
    authonticaation,
    validation(taskStatusByMemberValidation),
    taskStatusByMember
);
taskAssignmentRouter.post(
    "/bulkStatus",
    authonticaation,
    validation(bulkStatusValidation),
    bulkStatus
);

export default taskAssignmentRouter;