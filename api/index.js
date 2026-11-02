import { getApp } from "../src/app.controler.js";

export default async function handler(req, res) {
    try {
        const app = await getApp();
        // All transactional emails are awaited inside their request handlers.
        // Keep the serverless invocation alive until the HTTP response completes.
        await new Promise((resolve) => {
            res.once("finish", resolve);
            res.once("close", resolve);
            res.once("error", resolve);
            app(req, res);
        });
    } catch (error) {
        console.error("Failed to initialise app:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Server failed to initialise" });
        }
    }
}
