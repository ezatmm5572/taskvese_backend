import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
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
templateRouter.post("/:id/apply", authonticaation, applyTemplate);

export default templateRouter;
