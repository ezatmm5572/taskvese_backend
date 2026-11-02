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

const taskRouter = Router();

// Lists & Creation
taskRouter.get("/", authonticaation, getAllTasks);
taskRouter.get("/all", authonticaation, getAllTasks);
taskRouter.post("/createTask", authonticaation, validation(createTaskValidation), createTask);

// Bulk operations (must be registered before /:taskId)
taskRouter.post("/bulkDelete", authonticaation, validation(bulkTasksValidation), bulkDeleteTasks);
taskRouter.post("/bulkRestore", authonticaation, validation(bulkTasksValidation), bulkRestoreTasks);

// Legacy route (taskId in body/query)
taskRouter.delete("/deleteTask", authonticaation, deleteTask);

// Subtasks routes
taskRouter.post(
    "/:taskId/subtasks",
    authonticaation,
    validation(createSubtaskValidation),
    createSubtask
);
taskRouter.patch(
    "/:taskId/subtasks/:subId",
    authonticaation,
    validation(updateSubtaskValidation),
    updateSubtask
);
taskRouter.delete(
    "/:taskId/subtasks/:subId",
    authonticaation,
    validation(deleteSubtaskValidation),
    deleteSubtask
);

// Comments routes
taskRouter.get(
    "/:taskId/comments",
    authonticaation,
    validation(getCommentsValidation),
    getComments
);
taskRouter.post(
    "/:taskId/comments",
    authonticaation,
    validation(createCommentValidation),
    createComment
);
taskRouter.patch(
    "/:taskId/comments/:commentId",
    authonticaation,
    validation(updateCommentValidation),
    updateComment
);
taskRouter.delete(
    "/:taskId/comments/:commentId",
    authonticaation,
    validation(deleteCommentValidation),
    deleteComment
);

// Attachments routes
taskRouter.get(
    "/:taskId/attachments",
    authonticaation,
    validation(getAttachmentsValidation),
    getAttachments
);
taskRouter.post(
    "/:taskId/attachments",
    authonticaation,
    attachmentUpload,
    uploadAttachment
);
taskRouter.delete(
    "/:taskId/attachments/:attId",
    authonticaation,
    validation(deleteAttachmentValidation),
    deleteAttachment
);

// Time tracking routes
taskRouter.get(
    "/:taskId/time",
    authonticaation,
    validation(getTimeValidation),
    getTimeEntries
);
taskRouter.post(
    "/:taskId/time",
    authonticaation,
    validation(logTimeValidation),
    logTime
);
taskRouter.delete(
    "/:taskId/time/:entryId",
    authonticaation,
    validation(deleteTimeValidation),
    deleteTimeEntry
);

// Share routes
taskRouter.post("/:taskId/share", authonticaation, shareTask);
taskRouter.delete("/:taskId/share", authonticaation, revokeShareTask);

// Recurrence manual completion trigger
taskRouter.post("/:taskId/complete-and-spawn", authonticaation, completeAndSpawnTask);

// Task restore
taskRouter.post("/:taskId/restore", authonticaation, validation(restoreTaskValidation), restoreTask);

// Task get by ID, update, and delete
taskRouter.get("/:taskId", authonticaation, getTaskById);
taskRouter.patch("/:taskId", authonticaation, validation(updateTaskValidation), updateTask);
taskRouter.delete("/:taskId", authonticaation, validation(deleteTaskValidation), deleteTask);

export default taskRouter;
