import { Router } from "express";
import { createTask, deleteTask, getAllTasks } from "./tasks.service.js";
import { deleteTaskValidation } from "./task.validation.js";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";

const taskRouter = Router();

taskRouter.get("/", authonticaation, getAllTasks);
taskRouter.get("/all", authonticaation, getAllTasks);
taskRouter.post("/createTask", authonticaation, createTask);

// Legacy route (taskId in body/query) - must stay above "/:taskId"
taskRouter.delete("/deleteTask", authonticaation, deleteTask);
taskRouter.delete("/:taskId", authonticaation, validation(deleteTaskValidation), deleteTask);

export default taskRouter;
