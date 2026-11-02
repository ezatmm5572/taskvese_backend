import mongoose from "mongoose";

const timeEntrySchema = new mongoose.Schema(
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
        minutes: {
            type: Number,
            required: true,
            min: 1,
            max: 1440,
        },
        note: {
            type: String,
            default: "",
            trim: true,
            maxlength: 140,
        },
        at: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

timeEntrySchema.index({ task: 1 });
timeEntrySchema.index({ author: 1, at: -1 });

const timeEntryModel =
    mongoose.models.timeEntry || mongoose.model("timeEntry", timeEntrySchema);

export default timeEntryModel;
