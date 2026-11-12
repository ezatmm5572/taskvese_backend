import notificationModel from "../../DB/models/notification.js";
import memberModel from "../../DB/models/member.js";
import { sendEmail } from "../email/send.email.js";
import taskModel from "../../DB/models/task.js";
import { broadcastEvent } from "../../modules/events/events.service.js";

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


const BOARD_EVENT_META = {
    viewed: { code: "TASK_VIEWED", preference: "activityViews" },
    updated: { code: "TASK_UPDATED", preference: "activityChanges" },
    status: { code: "TASK_STATUS_CHANGED", preference: "activityChanges" },
    completed: { code: "TASK_COMPLETED", preference: "activityChanges" },
    comment: { code: "TASK_COMMENTED", preference: "activityChanges" },
    attachment: { code: "TASK_ATTACHMENT_ADDED", preference: "activityChanges" },
    subtask: { code: "TASK_SUBTASK_CHANGED", preference: "activityChanges" },
    time: { code: "TASK_TIME_LOGGED", preference: "activityChanges" },
    task_created: { code: "TASK_CREATED", preference: "activityChanges" },
    task_deleted: { code: "TASK_DELETED", preference: "activityChanges" },
    assigned: { code: "TASK_ASSIGNED", preference: "activityChanges" },
    board_visit: { code: "BOARD_VISITED", preference: "activityViews" },
    member_joined: { code: "MEMBER_JOINED", preference: "activityJoins" },
    team_member_added: { code: "TEAM_MEMBER_ADDED", preference: "activityJoins" },
};

export const createBoardActivityNotifications = async ({
    type, actorId, taskId = null, teamId = null, params = {}, text = "",
}) => {
    const meta = BOARD_EVENT_META[type];
    if (!meta || !actorId) return [];
    const task = taskId ? await taskModel.findById(taskId).select("_id title createdBy team").lean() : null;
    const recipientIds = new Set();
    const admins = await memberModel.find({ role: "admin", active: { $ne: false } }).select("_id preferences").lean();
    for (const admin of admins) recipientIds.add(String(admin._id));
    if (task?.createdBy) recipientIds.add(String(task.createdBy));
    recipientIds.delete(String(actorId));

    const created = [];
    for (const userId of recipientIds) {
        const recipient = await memberModel.findById(userId).select("preferences").lean();
        const prefs = recipient?.preferences || {};
        if (prefs[meta.preference] === false) continue;
        const now = new Date();
        const filter = {
            user: userId,
            type,
            actor: actorId,
            ...(taskId ? { task: taskId } : { task: null }),
        };
        if (type === "viewed" || type === "board_visit") {
            const recent = await notificationModel.findOne({
                ...filter, createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) },
            }).select("_id");
            if (recent) continue;
        }
        if (type === "updated") {
            const recent = await notificationModel.findOne({
                ...filter, createdAt: { $gte: new Date(now.getTime() - 2 * 60 * 1000) },
            }).sort({ createdAt: -1 });
            if (recent) {
                recent.text = text || recent.text;
                recent.params = params;
                recent.code = meta.code;
                recent.createdAt = now;
                await recent.save();
                broadcastEvent({ type: "notification.created", targetUserId: userId, taskId: taskId ? String(taskId) : null });
                continue;
            }
        }
        const notification = await notificationModel.create({
            user: userId, type, text: text || type, task: taskId, team: teamId || task?.team || null,
            actor: actorId, code: meta.code, params: { ...params, ...(task?.title ? { title: task.title } : {}) },
        });
        created.push(notification);
        broadcastEvent({ type: "notification.created", targetUserId: userId, taskId: taskId ? String(taskId) : null });
    }
    return created;
};
