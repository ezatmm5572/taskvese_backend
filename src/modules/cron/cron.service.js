import taskModel from "../../DB/models/task.js";
import teamModel from "../../DB/models/team.js";
import memberModel from "../../DB/models/member.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import notificationModel from "../../DB/models/notification.js";
import sessionModel from "../../DB/models/session.js";
import attachmentModel from "../../DB/models/attachment.js";
import { createNotification } from "../../commn/utils/notification.service.js";
import { deleteCloudinaryResource } from "../../commn/utils/fileUpload.js";

// Hourly Reminders
export const runRemindersCron = async () => {
    const now = new Date();
    const tasks = await taskModel.find({
        deletedAt: null,
        completedAt: null,
        endDate: { $ne: null },
    });

    let reminderCount = 0;
    let overdueCount = 0;

    for (const task of tasks) {
        const endDate = new Date(task.endDate);
        const remindDays = task.remindBefore || 0;
        const reminderThreshold = new Date(endDate.getTime() - remindDays * 24 * 60 * 60 * 1000);

        // Due soon reminder
        if (remindDays > 0 && now >= reminderThreshold && now < endDate && !task.remindedAt) {
            const assignments = await taskAssignmentModel.find({ task: task._id });
            for (const a of assignments) {
                await createNotification({
                    user: a.member,
                    type: "due_soon",
                    text: `Task "${task.title}" is due on ${endDate.toLocaleDateString()}`,
                    task: task._id,
                    team: task.team,
                    emailSubject: `Reminder: Task "${task.title}" is due soon`,
                });
            }
            task.remindedAt = now;
            await task.save();
            reminderCount++;
        }

        // Overdue notification
        if (now > endDate && !task.remindedAt) {
            const assignments = await taskAssignmentModel.find({ task: task._id });
            for (const a of assignments) {
                await createNotification({
                    user: a.member,
                    type: "overdue",
                    text: `Task "${task.title}" is overdue (due: ${endDate.toLocaleDateString()})`,
                    task: task._id,
                    team: task.team,
                    emailSubject: `Overdue: Task "${task.title}"`,
                });
            }
            task.remindedAt = now;
            await task.save();
            overdueCount++;
        }
    }

    return { reminderCount, overdueCount };
};

// Daily Purge (30-day retention for soft deletes, 90-day for notifications, expired sessions)
export const runPurgeCron = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Hard-delete soft-deleted tasks older than 30 days
    const expiredTasks = await taskModel.find({ deletedAt: { $lt: thirtyDaysAgo } });
    for (const t of expiredTasks) {
        // Delete Cloudinary attachments
        const attachments = await attachmentModel.find({ task: t._id });
        for (const att of attachments) {
            if (att.publicId || att.public_id) {
                await deleteCloudinaryResource(att.publicId || att.public_id);
            }
        }
        await attachmentModel.deleteMany({ task: t._id });
        await taskAssignmentModel.deleteMany({ task: t._id });
        await taskModel.deleteOne({ _id: t._id });
    }

    // Hard-delete soft-deleted teams older than 30 days
    await teamModel.deleteMany({ deletedAt: { $lt: thirtyDaysAgo } });

    // Hard-delete read notifications older than 90 days
    const purgedNotifs = await notificationModel.deleteMany({
        readAt: { $ne: null, $lt: ninetyDaysAgo },
    });

    // Hard-delete revoked sessions older than 30 days
    const purgedSessions = await sessionModel.deleteMany({
        revokedAt: { $ne: null, $lt: thirtyDaysAgo },
    });

    // Orphan attachment cleanup
    const allTaskIds = await taskModel.find().distinct("_id");
    const orphanAttachments = await attachmentModel.find({ task: { $nin: allTaskIds } });
    for (const att of orphanAttachments) {
        if (att.publicId || att.public_id) {
            await deleteCloudinaryResource(att.publicId || att.public_id);
        }
    }
    await attachmentModel.deleteMany({ task: { $nin: allTaskIds } });

    return {
        purgedTasks: expiredTasks.length,
        purgedNotifications: purgedNotifs.deletedCount,
        purgedSessions: purgedSessions.deletedCount,
        orphanAttachments: orphanAttachments.length,
    };
};
