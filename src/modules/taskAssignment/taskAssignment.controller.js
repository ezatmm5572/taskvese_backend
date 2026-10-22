import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import { addMemberToTask, taskStatusByMember, getAllAssignments } from "./taskAssignment.service.js";
import { addMemberToTaskValidation, taskStatusByMemberValidation } from "./taskAssignment.validation.js";

const taskAssignmentRouter = Router();

taskAssignmentRouter.get("/", authonticaation, getAllAssignments);
taskAssignmentRouter.get("/all", authonticaation, getAllAssignments);
taskAssignmentRouter.post("/addMemberToTask", authonticaation, validation(addMemberToTaskValidation), addMemberToTask);
taskAssignmentRouter.patch("/taskStatusByMember", authonticaation, validation(taskStatusByMemberValidation), taskStatusByMember);

export default taskAssignmentRouter;