import activityModel from "../../DB/models/activity.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { httpError } from "../../commn/utils/permissions.js";

export const getActivity = async (req, res, next) => {
    const { taskId, teamId } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const filter = {};
    if (taskId) {
        filter.task = taskId;
    }
    if (teamId) {
        filter.team = teamId;
    }

    const activities = await activityModel
        .find(filter)
        .populate("actor", "_id fname lname email profilePicture")
        .populate("task", "_id title")
        .populate("team", "_id name")
        .sort({ createdAt: -1 })
        .limit(limit);

    successResponse({
        res,
        status: 200,
        message: "Activity log retrieved successfully",
        data: activities || [],
    });
};
