import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                "assigned",
                "unassigned",
                "mention",
                "comment",
                "status",
                "due_soon",
                "overdue",
                "reminder",
                "team_added",
                "team_removed",
                "viewed", "updated", "completed", "subtask", "attachment", "time",
                "board_visit", "member_joined", "team_member_added", "task_created", "task_deleted",
            ],
        },
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "task",
            default: null,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "team",
            default: null,
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            default: null,
        },
        code: { type: String, default: null },
        params: { type: mongoose.Schema.Types.Mixed, default: {} },
        text: {
            type: String,
            required: true,
            trim: true,
        },
        readAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

const notificationModel =
    mongoose.models.notification || mongoose.model("notification", notificationSchema);

export default notificationModel;
