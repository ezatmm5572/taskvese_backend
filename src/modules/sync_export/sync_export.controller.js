import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import {
    search,
    getChanges,
    exportTasksCsv,
    exportReport,
} from "./sync_export.service.js";

export const searchRouter = Router();
searchRouter.get("/", authonticaation, search);

export const changesRouter = Router();
changesRouter.get("/", authonticaation, getChanges);

export const exportRouter = Router();
exportRouter.get("/tasks.csv", authonticaation, exportTasksCsv);
exportRouter.get("/report.pdf", authonticaation, exportReport);

export default {
    searchRouter,
    changesRouter,
    exportRouter,
};
