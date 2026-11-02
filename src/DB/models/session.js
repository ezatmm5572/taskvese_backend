import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
            index: true,
        },
        refreshTokenHash: {
            type: String,
            required: true,
            index: true,
        },
        userAgent: {
            type: String,
            default: "",
        },
        ip: {
            type: String,
            default: "",
        },
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
        revokedAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                delete ret.refreshTokenHash;
                return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (doc, ret) => {
                delete ret.refreshTokenHash;
                return ret;
            },
        },
    }
);

sessionSchema.index({ member: 1, revokedAt: 1 });

const sessionModel =
    mongoose.models.session || mongoose.model("session", sessionSchema);

export default sessionModel;
