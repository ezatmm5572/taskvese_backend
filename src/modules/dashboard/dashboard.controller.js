import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { getDashboardOverview, getDashboardTime } from "./dashboard.service.js";

const dashboardRouter = Router();

dashboardRouter.get("/", authonticaation, getDashboardOverview);
dashboardRouter.get("/time", authonticaation, getDashboardTime);

export default dashboardRouter;
