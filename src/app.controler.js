import express from "express";
import jwt from "jsonwebtoken";
import { PORT } from "../config/config.env.js";
import { connectDB } from "./DB/DB.connection.js";
import { redis_connect } from "./DB/redis/redise.connection.js";
import authRouter from "./modules/auth/auth.controller.js";
import memberRouter from "./modules/members/member.controller.js";
import teamRouter from "./modules/team/team.controller.js";
import taskRouter from "./modules/tasks/task.controller.js";
import taskAssignmentRouter from "./modules/taskAssignment/taskAssignment.controller.js";
import activityRouter from "./modules/activity/activity.controller.js";
import dashboardRouter from "./modules/dashboard/dashboard.controller.js";
import templateRouter from "./modules/templates/templates.controller.js";
import notificationRouter, { pushRouter } from "./modules/notifications/notifications.controller.js";
import { searchRouter, changesRouter, exportRouter } from "./modules/sync_export/sync_export.controller.js";
import publicRouter from "./modules/public/public.controller.js";
import eventsRouter from "./modules/events/events.controller.js";
import cronRouter from "./modules/cron/cron.controller.js";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cors from "cors";

const app = express();
const port = PORT || 3000;
let initPromise = null;

// Proxy trust for real IP behind proxies (Vercel, AWS, Nginx)
app.set("trust proxy", 1);

// Helper to extract user ID from JWT if present in Authorization header
const getUserIdFromReq = (req) => {
    if (req.member?._id) return String(req.member._id);
    try {
        const auth = req.headers?.authorization;
        if (auth && auth.startsWith("Bearer ")) {
            const token = auth.slice(7);
            const decoded = jwt.decode(token);
            if (decoded && (decoded.id || decoded._id)) {
                return String(decoded.id || decoded._id);
            }
        }
    } catch (e) {}
    return null;
};

// Section 2.7 Rate Limiter: Keyed by user id when authenticated (600 / 15 min), IP-based for anonymous (300 / 15 min)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: (req) => (getUserIdFromReq(req) ? 600 : 300),
    keyGenerator: (req) => getUserIdFromReq(req) || req.ip || "unknown",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many requests, please try again in a few minutes",
            code: "RATE_LIMITED",
        });
    },
});

// Stricter rate limiter for auth routes (20 / 15 min / IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => req.ip || "unknown",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many authentication attempts, please try again in a few minutes",
            code: "RATE_LIMITED",
        });
    },
});

// Section 2.8 CORS: explicit origin list from env, never '*' when credentials: true
const rawOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "";
const allowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter((o) => o && o !== "*");

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.length === 0) {
                return callback(null, origin);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, origin);
            }
            return callback(new Error("CORS origin not allowed: " + origin));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Last-Event-ID",
            "Idempotency-Key",
            "If-Unmodified-Since",
        ],
        exposedHeaders: ["Content-Disposition", "ETag"],
    })
);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

// Health check roots
app.get("/", (req, res) => {
    res.json({ message: "TaskVerse API is running", status: "healthy" });
});
app.get("/api", (req, res) => {
    res.json({ message: "TaskVerse API is running", status: "healthy" });
});

// Public endpoints (no auth)
app.use("/public", publicRouter);
app.use("/api/public", publicRouter);

// Main endpoints
app.use("/auth", authLimiter, authRouter);
app.use("/member", memberRouter);
app.use("/team", teamRouter);
app.use("/task", taskRouter);
app.use("/taskAssignment", taskAssignmentRouter);
app.use("/activity", activityRouter);
app.use("/dashboard", dashboardRouter);
app.use("/templates", templateRouter);
app.use("/notifications", notificationRouter);
app.use("/push", pushRouter);
app.use("/search", searchRouter);
app.use("/changes", changesRouter);
app.use("/export", exportRouter);
app.use("/events", eventsRouter);
app.use("/cron", cronRouter);

// Mount under /api as well for serverless rewrites
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/member", memberRouter);
app.use("/api/team", teamRouter);
app.use("/api/task", taskRouter);
app.use("/api/taskAssignment", taskAssignmentRouter);
app.use("/api/activity", activityRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/templates", templateRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/push", pushRouter);
app.use("/api/search", searchRouter);
app.use("/api/changes", changesRouter);
app.use("/api/export", exportRouter);
app.use("/api/events", eventsRouter);
app.use("/api/cron", cronRouter);

// Standardized error handling middleware
app.use((err, req, res, next) => {
    let status = err.statusCode || (err.code === 11000 ? 409 : (err.name === "ValidationError" ? 422 : 400));
    let code = err.errorCode || err.code;

    if (err.code === 11000) {
        code = "ALREADY_EXISTS";
        status = 409;
    } else if (err.code === "LIMIT_FILE_SIZE") {
        code = "FILE_TOO_LARGE";
        status = 400;
    } else if (typeof code !== "string" || !code || !/^[A-Z0-9_]+$/.test(code)) {
        if (status === 401) code = "UNAUTHORIZED";
        else if (status === 403) code = "FORBIDDEN";
        else if (status === 404) code = "NOT_FOUND";
        else if (status === 409) code = "CONFLICT";
        else if (status === 422) code = "VALIDATION_ERROR";
        else if (status === 429) code = "RATE_LIMITED";
        else code = "BAD_REQUEST";
    }

    const body = {
        message: err.code === 11000 ? "Resource already exists" : (err.message || "Something went wrong"),
        code: code,
    };
    if (err.errors) body.errors = err.errors;
    if (process.env.NODE_ENV !== "production") body.stack = err.stack;
    res.status(status).json(body);
});

// Database & Redis initialisation
export const getApp = async () => {
    if (!initPromise) {
        initPromise = (async () => {
            await connectDB();
            try {
                await redis_connect();
            } catch (e) {
                console.warn("Redis connection warning:", e.message);
            }
        })().catch((err) => {
            initPromise = null;
            throw err;
        });
    }
    await initPromise;
    return app;
};

export const bootstrap = async () => {
    await getApp();
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
};

export default app;