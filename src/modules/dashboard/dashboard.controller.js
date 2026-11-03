import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { getDashboardOverview, getDashboardTime } from "./dashboard.service.js";

import { requirePermission } from "../../commn/utils/access-control.js";

const dashboardRouter = Router();

dashboardRouter.get("/", authonticaation, requirePermission("view.reports"), getDashboardOverview);
dashboardRouter.get("/time", authonticaation, requirePermission("view.reports"), getDashboardTime);

export default dashboardRouter;
