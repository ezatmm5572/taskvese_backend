import mongoose from "mongoose";

const accessConfigSchema = new mongoose.Schema({
    _id: { type: String, default: "global" },
    enabled: { type: Boolean, default: false },
    presets: {
        member: { type: [String], default: undefined },
        viewer: { type: [String], default: undefined },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "member", default: null },
}, { timestamps: true });

export default mongoose.models.accessConfig || mongoose.model("accessConfig", accessConfigSchema);
