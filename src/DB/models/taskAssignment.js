import mongoose from "mongoose";
import { TaskStatusEnum, normalizeTaskStatus } from "../../commn/enums/task.enums.js";

const taskAssignmentSchema = new mongoose.Schema(
    {
        task: { type: mongoose.Schema.Types.ObjectId, ref: "task", required: true, index: true },
        member: { type: mongoose.Schema.Types.ObjectId, ref: "member", required: true, index: true },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "member", required: true },
        status: {
            type: String,
            enum: ["toDo", "inProgress", "completed", "failed", "complete", "fail"],
            default: TaskStatusEnum.TODO,
            set: (val) => normalizeTaskStatus(val),
        },
        // Progress is per assignment; members working on the same task never overwrite each other.
        progress: { type: Number, min: 0, max: 100, default: 0 },
        progressStatus: {
            type: String,
            enum: ["todo", "in-progress", "submitted", "approved", "rejected"],
            default: "todo",
            index: true,
        },
        progressNote: { type: String, trim: true, maxlength: 2000, default: "" },
        submittedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "member", default: null },
        reviewNote: { type: String, trim: true, maxlength: 2000, default: "" },
        assignedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true, strictQuery: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

taskAssignmentSchema.index({ task: 1, member: 1 }, { unique: true });

const taskAssignmentModel =
    mongoose.models.taskAssignment ||
    mongoose.model("taskAssignment", taskAssignmentSchema);

export default taskAssignmentModel;