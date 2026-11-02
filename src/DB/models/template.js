import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        scope: {
            type: String,
            required: true,
            enum: ["user", "team"],
            default: "user",
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
            index: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "team",
            default: null,
            index: true,
        },
        title: {
            type: String,
            default: "",
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        priority: {
            type: String,
            enum: ["", "low", "medium", "high", "urgent"],
            default: "",
        },
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        recurrence: {
            type: String,
            enum: ["none", "daily", "weekly", "monthly"],
            default: "none",
        },
        remindBefore: {
            type: Number,
            default: 0,
        },
        estimateMin: {
            type: Number,
            default: 0,
        },
        checklist: [
            {
                type: String,
                trim: true,
            },
        ],
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

const templateModel =
    mongoose.models.template || mongoose.model("template", templateSchema);

export default templateModel;
