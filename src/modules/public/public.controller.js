import { Router } from "express";
import { getPublicTask } from "../tasks/tasks.service.js";

const publicRouter = Router();

publicRouter.get("/task/:token", getPublicTask);

export default publicRouter;
