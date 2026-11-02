import activityModel from "../../DB/models/activity.js";

export const recordActivity = async ({
    actor,
    action,
    task = null,
    team = null,
    meta = {},
}) => {
    try {
        if (!actor || !action) return null;
        return await activityModel.create({
            actor,
            action,
            task: task || null,
            team: team || null,
            meta,
        });
    } catch (err) {
        console.error("Failed to record activity log:", err.message);
        return null;
    }
};
