export const TaskStatusEnum = {
    TODO: 'toDo',
    IN_PROGRESS: 'inProgress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    // Legacy aliases
    COMPLETE: 'complete',
    FAIL: 'fail'
};

export const normalizeTaskStatus = (status) => {
    if (!status) return TaskStatusEnum.TODO;
    const s = String(status).trim();
    if (s === "complete" || s === "completed") return TaskStatusEnum.COMPLETED;
    if (s === "fail" || s === "failed") return TaskStatusEnum.FAILED;
    if (s === "inProgress") return TaskStatusEnum.IN_PROGRESS;
    if (s === "toDo") return TaskStatusEnum.TODO;
    return s;
};