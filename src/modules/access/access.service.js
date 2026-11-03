import mongoose from "mongoose";
import accessConfigModel from "../../DB/models/accessConfig.js";
import accessOverrideModel from "../../DB/models/accessOverride.js";
import accessAuditModel from "../../DB/models/accessAudit.js";
import memberModel from "../../DB/models/member.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { httpError } from "../../commn/utils/permissions.js";
import { broadcastEvent } from "../events/events.service.js";
import {
    getAccessConfig, resolveEffectivePermissions, validatePermissionKeys,
} from "../../commn/utils/access-control.js";

const audit = (actor, action, text, before, after, target = null) =>
    accessAuditModel.create({ actor: actor._id, action, text, before, after, target });

export const getMyAccess = async (req, res) => {
    const config = await getAccessConfig();
    const resolved = await resolveEffectivePermissions(req.member, config);
    return successResponse({ res, status: 200, message: "Effective access permissions", data: resolved });
};

export const getAccessConfiguration = async (req, res) => {
    const config = await getAccessConfig();
    return successResponse({
        res, status: 200, message: "Access configuration",
        data: { enabled: config.enabled, rolePresets: config.presets },
    });
};

export const updateAccessConfiguration = async (req, res) => {
    const body = req.body || {};
    const current = await getAccessConfig();
    const before = { enabled: current.enabled, rolePresets: current.presets };
    const update = {};
    if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean") throw httpError("enabled must be boolean", 422, "VALIDATION_ERROR");
        update.enabled = body.enabled;
    }
    if (body.rolePresets !== undefined) {
        if (!body.rolePresets || typeof body.rolePresets !== "object" || Array.isArray(body.rolePresets)) {
            throw httpError("rolePresets must be an object", 422, "VALIDATION_ERROR");
        }
        const presets = { ...current.presets };
        for (const role of ["member", "viewer"]) {
            if (body.rolePresets[role] !== undefined) presets[role] = validatePermissionKeys(body.rolePresets[role], `rolePresets.${role}`);
        }
        update.presets = presets;
    }
    if (!Object.keys(update).length) throw httpError("No supported access configuration fields supplied", 422, "VALIDATION_ERROR");

    const saved = await accessConfigModel.findOneAndUpdate(
        { _id: "global" }, { $set: { ...update, updatedBy: req.member._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const after = { enabled: saved.enabled, rolePresets: saved.presets };
    if (update.enabled !== undefined && update.enabled !== current.enabled) {
        await audit(req.member, update.enabled ? "access.enabled" : "access.disabled",
            `Access control ${update.enabled ? "enabled" : "disabled"}`, before, after);
    }
    if (update.presets !== undefined && JSON.stringify(before.rolePresets) !== JSON.stringify(after.rolePresets)) {
        await audit(req.member, "preset.changed", "Role permission presets updated", before.rolePresets, after.rolePresets);
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) {
        broadcastEvent({ type: "access.updated", actorId: String(req.member._id), message: "config" });
    }
    return successResponse({ res, status: 200, message: "Access configuration updated", data: after });
};

export const getAccessUsers = async (req, res) => {
    const overrides = await accessOverrideModel.find().select("member allow deny").lean();
    return successResponse({
        res, status: 200, message: "Access overrides",
        data: overrides.map((item) => ({ memberId: item.member, allow: item.allow || [], deny: item.deny || [] })),
    });
};

export const updateAccessUser = async (req, res) => {
    const { memberId } = req.params;
    if (!mongoose.isValidObjectId(memberId)) throw httpError("Member not found", 404, "USER_NOT_FOUND");
    const member = await memberModel.findById(memberId).select("_id fname lname role");
    if (!member) throw httpError("Member not found", 404, "USER_NOT_FOUND");
    if (!req.body || !Array.isArray(req.body.allow) || !Array.isArray(req.body.deny)) {
        throw httpError("allow and deny must both be arrays", 422, "VALIDATION_ERROR");
    }
    const allow = validatePermissionKeys(req.body.allow, "allow");
    const deny = validatePermissionKeys(req.body.deny, "deny");
    const overlap = allow.filter((key) => deny.includes(key));
    if (overlap.length) throw httpError(`A permission cannot be both allowed and blocked: ${overlap.join(", ")}`, 422, "VALIDATION_ERROR");

    const previous = await accessOverrideModel.findOne({ member: memberId }).lean();
    let saved = null;
    if (!allow.length && !deny.length) {
        await accessOverrideModel.deleteOne({ member: memberId });
    } else {
        saved = await accessOverrideModel.findOneAndUpdate(
            { member: memberId },
            { $set: { allow, deny, updatedBy: req.member._id } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    }
    const after = saved ? { member: saved.member, allow: saved.allow, deny: saved.deny } : null;
    await audit(req.member, "override.changed", `Access overrides updated for ${member.fname} ${member.lname}`,
        previous ? { allow: previous.allow, deny: previous.deny } : null, after, memberId);
    broadcastEvent({
        type: "access.updated",
        actorId: String(req.member._id),
        targetUserId: String(memberId),
        message: "override",
    });
    return successResponse({
        res, status: 200, message: "Member access override updated",
        data: after || { member: memberId, allow: [], deny: [] },
    });
};

export const getAccessAudit = async (req, res) => {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;
    const rows = await accessAuditModel.find()
        .populate("actor", "fname lname")
        .sort({ createdAt: -1 }).limit(limit).lean();
    return successResponse({
        res, status: 200, message: "Access audit history",
        data: rows.map((row) => ({
            _id: row._id,
            actorName: row.actor ? `${row.actor.fname} ${row.actor.lname}`.trim() : "Deleted user",
            text: row.text,
            createdAt: row.createdAt,
        })),
    });
};
