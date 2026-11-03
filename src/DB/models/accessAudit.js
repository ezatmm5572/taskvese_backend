import mongoose from "mongoose";

const accessAuditSchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "member", required: true },
    action: { type: String, enum: ["access.enabled", "access.disabled", "preset.changed", "override.changed", "role.changed"], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: "member", default: null },
    text: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed, default: undefined },
    after: { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.models.accessAudit || mongoose.model("accessAudit", accessAuditSchema);
