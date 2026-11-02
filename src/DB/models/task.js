import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 140,
        },
        done: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 150,
        },
        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 20000,
        },
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
        createdBy: {
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
        priority: {
            type: String,
            enum: ["", "low", "medium", "high", "urgent"],
            default: "",
        },
        tags: {
            type: [
                {
                    type: String,
                    maxlength: 24,
                    trim: true,
                    lowercase: true,
                },
            ],
            validate: [
                (val) => !val || val.length <= 10,
                "Maximum 10 tags allowed",
            ],
            default: [],
            set: (tags) => {
                if (!Array.isArray(tags)) return [];
                return Array.from(
                    new Set(tags.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean))
                ).slice(0, 10);
            },
        },
        recurrence: {
            type: String,
            enum: ["none", "daily", "weekly", "monthly"],
            default: "none",
        },
        remindBefore: {
            type: Number,
            min: 0,
            max: 30,
            default: 0,
        },
        remindedAt: {
            type: Date,
            default: null,
        },
        estimateMin: {
            type: Number,
            min: 0,
            default: 0,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        archived: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },
        subtasks: {
            type: [subtaskSchema],
            default: [],
            validate: [
                (val) => !val || val.length <= 100,
                "Maximum 100 subtasks allowed",
            ],
        },
        shareToken: {
            type: String,
            default: null,
            index: true,
        },
        spawnedFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "task",
            default: null,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes per spec Section 3.1
taskSchema.index({ team: 1, deletedAt: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ endDate: 1 });
taskSchema.index(
    { title: "text", description: "text", tags: "text" },
    { weights: { title: 5, tags: 3, description: 1 } }
);

const taskModel = mongoose.models.task || mongoose.model("task", taskSchema);

export default taskModel;