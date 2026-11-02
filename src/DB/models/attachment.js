import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "task",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        size: {
            type: Number,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        publicId: {
            type: String,
            default: null,
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
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

// Support both public_id and publicId for backwards compatibility
attachmentSchema.virtual("public_id").get(function () {
    return this.publicId;
});

const attachmentModel =
    mongoose.models.attachment || mongoose.model("attachment", attachmentSchema);

export default attachmentModel;
