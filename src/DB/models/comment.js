import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "task",
            required: true,
            index: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
            index: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 2000,
        },
        mentions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "member",
            },
        ],
        editedAt: {
            type: Date,
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

commentSchema.index({ task: 1, createdAt: 1 });

const commentModel = mongoose.models.comment || mongoose.model("comment", commentSchema);

export default commentModel;
