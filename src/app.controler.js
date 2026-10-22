import express from "express";
import { PORT } from "../config/config.env.js";
import { connectDB } from "./DB/DB.connection.js";
import { redis_connect } from "./DB/redis/redise.connection.js";
import authRouter from "./modules/auth/auth.controller.js";
import memberRouter from "./modules/members/member.controller.js";
import teamRouter from "./modules/team/team.controller.js";
import taskRouter from "./modules/tasks/task.controller.js";
import taskAssignmentRouter from "./modules/taskAssignment/taskAssignment.controller.js";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cors from "cors";

const app = express();
const port = PORT || 3000;
let initPromise = null;

// Vercel (and most hosts) sit behind a proxy; required for rate limiting by real client IP.
app.set("trust proxy", 1);

// Middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again in a few minutes" },
});

// Set CORS_ORIGIN to your frontend URL(s), comma separated, e.g. https://taskverse.vercel.app
// If unset, any origin is allowed (fine for local dev, tighten it in production).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(limiter);

// Health check root
app.get("/", (req, res) => {
    res.json({ message: "TaskVerse API is running", status: "healthy" });
});
app.get("/api", (req, res) => {
    res.json({ message: "TaskVerse API is running", status: "healthy" });
});

// Mount routes directly
app.use("/auth", authRouter);
app.use("/member", memberRouter);
app.use("/team", teamRouter);
app.use("/task", taskRouter);
app.use("/taskAssignment", taskAssignmentRouter);

// Also mount routes under /api for flexible serverless rewrites
app.use("/api/auth", authRouter);
app.use("/api/member", memberRouter);
app.use("/api/team", teamRouter);
app.use("/api/task", taskRouter);
app.use("/api/taskAssignment", taskAssignmentRouter);

// Error handling
app.use((err, req, res, next) => {
    const status = err.statusCode || (err.code === 11000 ? 409 : 400);
    const body = { message: err.code === 11000 ? "Already exists" : (err.message || "Something went wrong") };
    if (process.env.NODE_ENV !== "production") body.stack = err.stack;
    res.status(status).json(body);
});

// Initialise DB/Redis once per server instance. If it fails, the next request retries.
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