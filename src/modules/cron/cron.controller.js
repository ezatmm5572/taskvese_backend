import { Router } from "express";
import { runRemindersCron, runPurgeCron } from "./cron.service.js";
import { successResponse } from "../../commn/utils/successResponse.js";

const cronRouter = Router();

// Middleware to verify cron secret in production
const verifyCronSecret = (req, res, next) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ message: "Unauthorized cron trigger", code: "UNAUTHORIZED" });
        }
    }
    next();
};

cronRouter.post("/reminders", verifyCronSecret, async (req, res, next) => {
    try {
        const result = await runRemindersCron();
        successResponse({
            res,
            status: 200,
            message: "Reminders cron job completed",
            data: result,
        });
    } catch (e) {
        next(e);
    }
});

cronRouter.post("/purge", verifyCronSecret, async (req, res, next) => {
    try {
        const result = await runPurgeCron();
        successResponse({
            res,
            status: 200,
            message: "Purge cron job completed",
            data: result,
        });
    } catch (e) {
        next(e);
    }
});

export default cronRouter;
