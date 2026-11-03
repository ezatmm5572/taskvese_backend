import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { requirePermission } from "../../commn/utils/access-control.js";
import {
    getTemplates,
    createTemplate,
    deleteTemplate,
    applyTemplate,
} from "./templates.service.js";

const templateRouter = Router();

templateRouter.get("/", authonticaation, getTemplates);
templateRouter.post("/", authonticaation, createTemplate);
templateRouter.delete("/:id", authonticaation, deleteTemplate);
templateRouter.post("/:id/apply", authonticaation, requirePermission("task.create"), applyTemplate);

export default templateRouter;
