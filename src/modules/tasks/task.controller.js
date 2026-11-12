import { Router } from "express";
import {
    createTask,
    deleteTask,
    getAllTasks,
    getTaskById,
    updateTask,
    restoreTask,
    bulkDeleteTasks,
    bulkRestoreTasks,
    completeAndSpawnTask,
    shareTask,
    revokeShareTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    getComments,
    createComment,
    updateComment,
    deleteComment,
    getAttachments,
    uploadAttachment,
    deleteAttachment,
    getTimeEntries,
    logTime,
    deleteTimeEntry,
} from "./tasks.service.js";
import {
    createTaskValidation,
    deleteTaskValidation,
    updateTaskValidation,
    restoreTaskValidation,
    bulkTasksValidation,
    createSubtaskValidation,
    updateSubtaskValidation,
    deleteSubtaskValidation,
    getCommentsValidation,
    createCommentValidation,
    updateCommentValidation,
    deleteCommentValidation,
    getAttachmentsValidation,
    deleteAttachmentValidation,
    getTimeValidation,
    logTimeValidation,
    deleteTimeValidation,
} from "./task.validation.js";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import { attachmentUpload } from "../../commn/middleware/multer.js";

import { requirePermission, requireTaskFieldPermissions } from "../../commn/utils/access-control.js";

const taskRouter = Router();

// Lists & Creation
taskRouter.get("/", authonticaation, requirePermission("view.tasks"), getAllTasks);
taskRouter.get("/all", authonticaation, requirePermission("view.tasks"), getAllTasks);
taskRouter.post("/createTask", authonticaation, requirePermission("task.create"), validation(createTaskValidation), createTask);

// Bulk operations (must be registered before /:taskId)
taskRouter.post("/bulkDelete", authonticaation, requirePermission("task.delete"), validation(bulkTasksValidation), bulkDeleteTasks);
taskRouter.post("/bulkRestore", authonticaation, requirePermission("task.delete"), validation(bulkTasksValidation), bulkRestoreTasks);

// Legacy route (taskId in body/query)
taskRouter.delete("/deleteTask", authonticaation, requirePermission("task.delete"), deleteTask);

// Subtasks routes
taskRouter.post(
    "/:taskId/subtasks",
    authonticaation,
    requireTaskFieldPermissions,
    validation(createSubtaskValidation),
    createSubtask
);
taskRouter.patch(
    "/:taskId/subtasks/:subId",
    authonticaation,
    requireTaskFieldPermissions,
    validation(updateSubtaskValidation),
    updateSubtask
);
taskRouter.delete(
    "/:taskId/subtasks/:subId",
    authonticaation,
    requireTaskFieldPermissions,
    validation(deleteSubtaskValidation),
    deleteSubtask
);

// Comments routes
taskRouter.get(
    "/:taskId/comments",
    authonticaation,
    requirePermission("view.tasks"),
    validation(getCommentsValidation),
    getComments
);
taskRouter.post(
    "/:taskId/comments",
    authonticaation,
    requirePermission("task.comment"),
    validation(createCommentValidation),
    createComment
);
taskRouter.patch(
    "/:taskId/comments/:commentId",
    authonticaation,
    requirePermission("task.comment"),
    validation(updateCommentValidation),
    updateComment
);
taskRouter.delete(
    "/:taskId/comments/:commentId",
    authonticaation,
    requirePermission("task.comment"),
    validation(deleteCommentValidation),
    deleteComment
);

// Attachments routes
taskRouter.get(
    "/:taskId/attachments",
    authonticaation,
    requirePermission("view.tasks"),
    validation(getAttachmentsValidation),
    getAttachments
);
taskRouter.post(
    "/:taskId/attachments",
    authonticaation,
    requirePermission("task.attach"),
    attachmentUpload,
    uploadAttachment
);
taskRouter.delete(
    "/:taskId/attachments/:attId",
    authonticaation,
    requirePermission("task.attach"),
    validation(deleteAttachmentValidation),
    deleteAttachment
);

// Time tracking routes
taskRouter.get(
    "/:taskId/time",
    authonticaation,
    requirePermission("view.tasks"),
    validation(getTimeValidation),
    getTimeEntries
);
taskRouter.post(
    "/:taskId/time",
    authonticaation,
    requirePermission("task.logTime"),
    validation(logTimeValidation),
    logTime
);
taskRouter.delete(
    "/:taskId/time/:entryId",
    authonticaation,
    requirePermission("task.logTime"),
    validation(deleteTimeValidation),
    deleteTimeEntry
);

// Share routes
taskRouter.post("/:taskId/share", authonticaation, requirePermission("task.share"), shareTask);
taskRouter.delete("/:taskId/share", authonticaation, requirePermission("task.share"), revokeShareTask);

// Recurrence manual completion trigger
taskRouter.post("/:taskId/complete-and-spawn", authonticaation, requirePermission("task.status"), completeAndSpawnTask);

// Task restore
taskRouter.post("/:taskId/restore", authonticaation, requirePermission("task.delete"), validation(restoreTaskValidation), restoreTask);

// Task get by ID, update, and delete
taskRouter.get("/:taskId", authonticaation, requirePermission("view.tasks"), getTaskById);
taskRouter.patch("/:taskId", authonticaation, requireTaskFieldPermissions, validation(updateTaskValidation), updateTask);
taskRouter.delete("/:taskId", authonticaation, requirePermission("task.delete"), validation(deleteTaskValidation), deleteTask);

export default taskRouter;
