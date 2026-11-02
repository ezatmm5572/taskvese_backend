import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
            index: true,
        },
        action: {
            type: String,
            required: true,
            index: true,
        },
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "task",
            default: null,
            index: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "team",
            default: null,
            index: true,
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        text: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

activitySchema.index({ task: 1, createdAt: -1 });
activitySchema.index({ team: 1, createdAt: -1 });

const activityModel =
    mongoose.models.activity || mongoose.model("activity", activitySchema);

export default activityModel;
