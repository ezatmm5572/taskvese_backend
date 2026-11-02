import { getApp } from "../src/app.controler.js";
import { flushEmails } from "../src/commn/email/email.events.js";

export default async function handler(req, res) {
    try {
        const app = await getApp();
        // Wait for the response to finish, then let any queued emails (OTP, invitations)
        // complete before the serverless function is frozen.
        await new Promise((resolve) => {
            res.once("finish", resolve);
            res.once("close", resolve);
            res.once("error", resolve);
            app(req, res);
        });
        await flushEmails();
    } catch (error) {
        console.error("Failed to initialise app:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Server failed to initialise" });
        }
    }
}
