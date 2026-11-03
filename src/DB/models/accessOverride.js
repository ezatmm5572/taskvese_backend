import mongoose from "mongoose";

const accessOverrideSchema = new mongoose.Schema({
    member: { type: mongoose.Schema.Types.ObjectId, ref: "member", required: true, unique: true, index: true },
    allow: { type: [String], default: [] },
    deny: { type: [String], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "member", default: null },
}, { timestamps: true });

export default mongoose.models.accessOverride || mongoose.model("accessOverride", accessOverrideSchema);
