import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        task: { type: mongoose.Schema.Types.ObjectId, ref: "task", required: true, index: true },
        // Optional assignment scope preserves legacy task-wide comments.
        taskAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "taskAssignment", default: null, index: true },
        parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "comment", default: null, index: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "member", required: true, index: true },
        text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
        mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "member" }],
        editedAt: { type: Date, default: null },
    },
    { timestamps: true, strictQuery: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

commentSchema.index({ task: 1, createdAt: 1 });
commentSchema.index({ taskAssignment: 1, createdAt: 1 });

const commentModel = mongoose.models.comment || mongoose.model("comment", commentSchema);
export default commentModel;