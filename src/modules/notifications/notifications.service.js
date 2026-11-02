import notificationModel from "../../DB/models/notification.js";
import memberModel from "../../DB/models/member.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { httpError } from "../../commn/utils/permissions.js";

export const getNotifications = async (req, res, next) => {
    const { unread } = req.query;
    const filter = { user: req.member._id };

    if (unread === "true" || unread === true) {
        filter.readAt = null;
    }

    const notifications = await notificationModel
        .find(filter)
        .populate("actor", "fname lname email profilePicture")
        .populate("task", "title")
        .populate("team", "name")
        .sort({ createdAt: -1 })
        .limit(100);

    const unreadCount = await notificationModel.countDocuments({
        user: req.member._id,
        readAt: null,
    });

    successResponse({
        res,
        status: 200,
        message: "Notifications retrieved successfully",
        data: notifications || [],
        meta: {
            unread: unreadCount,
            total: notifications.length,
        },
    });
};

export const markNotificationsAsRead = async (req, res, next) => {
    const { ids, all } = req.body;

    if (all === true) {
        await notificationModel.updateMany(
            { user: req.member._id, readAt: null },
            { $set: { readAt: new Date() } }
        );
        return successResponse({
            res,
            status: 200,
            message: "All notifications marked as read",
        });
    }

    if (Array.isArray(ids) && ids.length > 0) {
        await notificationModel.updateMany(
            { _id: { $in: ids }, user: req.member._id },
            { $set: { readAt: new Date() } }
        );
        return successResponse({
            res,
            status: 200,
            message: "Selected notifications marked as read",
            data: { ids },
        });
    }

    throw httpError("Either 'all: true' or 'ids: []' is required", 400, "VALIDATION_ERROR");
};

export const deleteNotification = async (req, res, next) => {
    const { id } = req.params;
    const result = await notificationModel.deleteOne({ _id: id, user: req.member._id });
    if (result.deletedCount === 0) {
        throw httpError("Notification not found", 404, "NOT_FOUND");
    }

    successResponse({
        res,
        status: 200,
        message: "Notification deleted successfully",
        data: { _id: id },
    });
};

// Web Push (VAPID) handlers
export const getVapidPublicKey = (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY || "BNP-placeholder-vapid-public-key-for-taskverse";
    successResponse({
        res,
        status: 200,
        message: "VAPID public key",
        data: { publicKey },
    });
};

export const subscribePush = async (req, res, next) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys) {
        throw httpError("Endpoint and keys are required for push subscription", 400, "VALIDATION_ERROR");
    }

    await memberModel.updateOne(
        { _id: req.member._id },
        {
            $pull: { pushSubscriptions: { endpoint } },
        }
    );

    await memberModel.updateOne(
        { _id: req.member._id },
        {
            $push: { pushSubscriptions: { endpoint, keys } },
        }
    );

    successResponse({
        res,
        status: 201,
        message: "Push subscription registered successfully",
    });
};

export const unsubscribePush = async (req, res, next) => {
    const { endpoint } = req.body;
    if (!endpoint) {
        throw httpError("Endpoint is required to unsubscribe", 400, "VALIDATION_ERROR");
    }

    await memberModel.updateOne(
        { _id: req.member._id },
        {
            $pull: { pushSubscriptions: { endpoint } },
        }
    );

    successResponse({
        res,
        status: 200,
        message: "Push subscription removed successfully",
    });
};
