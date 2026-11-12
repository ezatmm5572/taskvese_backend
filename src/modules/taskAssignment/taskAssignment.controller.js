import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import {
    addMemberToTask, removeMemberFromTask, taskStatusByMember, bulkStatus,
    getAllAssignments, getMyAssignments,
} from "./taskAssignment.service.js";
import { updateMyProgress, reviewProgress } from "./progress.service.js";
import {
    addMemberToTaskValidation, removeMemberFromTaskValidation,
    taskStatusByMemberValidation, bulkStatusValidation,
    updateProgressValidation, reviewProgressValidation,
} from "./taskAssignment.validation.js";
import { requirePermission } from "../../commn/utils/access-control.js";

const taskAssignmentRouter = Router();
taskAssignmentRouter.get("/", authonticaation, requirePermission("view.tasks"), getAllAssignments);
taskAssignmentRouter.get("/all", authonticaation, requirePermission("view.tasks"), getAllAssignments);
taskAssignmentRouter.get("/mine", authonticaation, requirePermission("view.assignments"), getMyAssignments);
taskAssignmentRouter.post("/addMemberToTask", authonticaation, requirePermission("task.assign"), validation(addMemberToTaskValidation), addMemberToTask);
taskAssignmentRouter.post("/removeMemberFromTask", authonticaation, requirePermission("task.assign"), validation(removeMemberFromTaskValidation), removeMemberFromTask);
taskAssignmentRouter.patch("/taskStatusByMember", authonticaation, requirePermission("task.status"), validation(taskStatusByMemberValidation), taskStatusByMember);
taskAssignmentRouter.patch("/progress", authonticaation, requirePermission("task.status"), validation(updateProgressValidation), updateMyProgress);
taskAssignmentRouter.patch("/review", authonticaation, requirePermission("task.status"), validation(reviewProgressValidation), reviewProgress);
taskAssignmentRouter.post("/bulkStatus", authonticaation, requirePermission("task.status"), validation(bulkStatusValidation), bulkStatus);
export default taskAssignmentRouter;