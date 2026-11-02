import notificationModel from "../../DB/models/notification.js";
import memberModel from "../../DB/models/member.js";
import { sendEmail } from "../email/send.email.js";

export const createNotification = async ({
    user,
    type,
    text,
    task = null,
    team = null,
    actor = null,
    sendEmailNotification = true,
    emailSubject = "TaskVerse Notification",
    emailHtml = null,
}) => {
    try {
        if (!user || !type || !text) return null;

        const notif = await notificationModel.create({
            user,
            type,
            text,
            task,
            team,
            actor,
        });

        if (sendEmailNotification) {
            const userId = user?._id || user;
            const member = await memberModel.findById(userId);
            if (member && member.email) {
                // Check preferences
                const prefs = member.preferences || {};
                let shouldSend = true;
                if (type === "assigned" && prefs.emailAssigned === false) shouldSend = false;
                if (type === "mention" && prefs.emailMention === false) shouldSend = false;
                if ((type === "due_soon" || type === "overdue" || type === "reminder") && prefs.emailDue === false) shouldSend = false;

                if (shouldSend) {
                    try {
                        await sendEmail({
                            to: member.email,
                            subject: emailSubject,
                            html: emailHtml || `<p>${text}</p>`,
                        });
                    } catch (e) {
                        console.error("Email send error in notification:", e?.message || e);
                    }
                }
            }
        }

        return notif;
    } catch (err) {
        console.error("Failed to create notification:", err.message);
        return null;
    }
};
