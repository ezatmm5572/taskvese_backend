import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import {
    getNotifications,
    markNotificationsAsRead,
    deleteNotification,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
} from "./notifications.service.js";

export const notificationRouter = Router();

notificationRouter.get("/", authonticaation, getNotifications);
notificationRouter.post("/read", authonticaation, markNotificationsAsRead);
notificationRouter.delete("/:id", authonticaation, deleteNotification);

export const pushRouter = Router();

pushRouter.get("/key", getVapidPublicKey);
pushRouter.post("/subscribe", authonticaation, subscribePush);
pushRouter.delete("/subscribe", authonticaation, unsubscribePush);

export default notificationRouter;
