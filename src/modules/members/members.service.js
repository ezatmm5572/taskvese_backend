import { HASH_SALT } from "../../../config/config.env.js";
import * as DB_services from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import teamModel from "../../DB/models/team.js";
import taskAssignmentModel from "../../DB/models/taskAssignment.js";
import { hashSync } from "bcrypt";
import { sendEmail } from "../../commn/email/send.email.js";
import { RoleEnum } from "../../commn/enums/member.enums.js";
import { fileUpload } from "../../commn/utils/fileUpload.js";
import { successResponse } from "../../commn/utils/successResponse.js";
import { signInInvitationTemplate } from "../../commn/email/signin_invetion_tamplate.js";
import {
    httpError,
    isSystemAdmin,
    same,
    normalizeTeamRole,
} from "../../commn/utils/permissions.js";
import crypto from "crypto";
import accessOverrideModel from "../../DB/models/accessOverride.js";
import accessAuditModel from "../../DB/models/accessAudit.js";
import { broadcastEvent } from "../events/events.service.js";

export const createMember = async (req, res, next) => {
    if (!isSystemAdmin(req.member)) {
        throw httpError("Forbidden: only system admins can create members", 403, "FORBIDDEN");
    }

    const { fname, lname, email, password, confirmPassword, gender } = req.body;
    if (password !== confirmPassword) {
        throw httpError("Password and confirm password do not match", 422, "VALIDATION_ERROR");
    }

    const member_exist = await DB_services.findOne({ model: memberModel, filter: { email } });
    if (member_exist) {
        throw httpError("Member already exists", 409, "MEMBER_EXISTS");
    }

    const encPassword = hashSync(password, Number(HASH_SALT) || 12);

    let uploadedFile = null;
    if (req.file) {
        uploadedFile = await fileUpload(req.file.buffer, "members");
    }

    const member = await DB_services.createDocument({
        model: memberModel,
        doc: {
            fname,
            lname,
            email,
            password: encPassword,
            gender,
            role: RoleEnum.MEMBER,
            profilePicture: uploadedFile?.secure_url || "default.png",
            confirmed: true,
            addedBy: req.member._id,
        },
    });

    const frontendBaseUrl = (
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        "https://taskverse-frontend-ochre.vercel.app"
    ).replace(/\/$/, "");

    try {
        await sendEmail({
            to: email,
            subject: "confirm email",
            html: signInInvitationTemplate({
                memberName: fname + " " + lname,
                memberEmail: email,
                memberPassword: password,
                signInUrl: `${frontendBaseUrl}/app`,
                invitedBy: (req.member?.fname || "") + " " + (req.member?.lname || ""),
            }),
        });
    } catch (emailErr) {
        console.error("Failed to send member invitation email:", emailErr?.message || emailErr);
    }

    successResponse({
        res,
        status: 201,
        message: "Member created successfully",
        data: member,
    });
};

export const getProfile = async (req, res, next) => {
    const member = await memberModel
        .findById(req.member._id)
        .populate("teams.teamId", "name")
        .select("-password");

    const mObj = member.toObject();
    mObj.teams = (mObj.teams || [])
        .filter((t) => t.teamId)
        .map((t) => ({
            teamId: t.teamId._id || t.teamId,
            name: t.teamId.name || "",
            role: normalizeTeamRole(t.role),
        }));

    successResponse({
        res,
        status: 200,
        message: "Profile",
        data: mObj,
    });
};

export const getAllMembers = async (req, res, next) => {
    // Section 2.10 Contract Fix: GET /member MUST include each member's teams: [{ teamId, name, role }]
    const memberFilter = isSystemAdmin(req.member)
        ? { $or: [{ _id: req.member._id }, { addedBy: req.member._id }] }
        : { teams: { $elemMatch: { teamId: { $in: (req.member.teams || []).map((t) => t.teamId) } } } };
    const members = await memberModel
        .find(memberFilter)
        .populate("teams.teamId", "name")
        .select("-password")
        .sort({ createdAt: -1 });

    const formatted = members.map((m) => {
        const mObj = m.toObject();
        mObj.teams = (mObj.teams || [])
            .filter((t) => t.teamId)
            .map((t) => ({
                teamId: t.teamId._id || t.teamId,
                name: t.teamId.name || "",
                role: normalizeTeamRole(t.role),
            }));
        return mObj;
    });

    successResponse({
        res,
        status: 200,
        message: "All members",
        data: formatted || [],
    });
};

// -------------------------------------------------------------
// Section 4.10 Member Management
// -------------------------------------------------------------

export const updateMember = async (req, res, next) => {
    const { id } = req.params;
    const isSelf = same(req.member._id, id);
    const isSA = isSystemAdmin(req.member);

    if (!isSelf && !isSA) {
        throw httpError("You are not allowed to update this member", 403, "FORBIDDEN");
    }

    const member = await memberModel.findById(id);
    if (!member || (isSA && !isSelf && String(member.addedBy || "") !== String(req.member._id))) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    const { fname, lname, gender, role } = req.body;
    let roleAudit = null;
    if (role !== undefined) {
        if (!isSA) throw httpError("Only system admins can change system roles", 403, "FORBIDDEN");
        if (!["admin", "member"].includes(role)) throw httpError("role must be admin or member", 422, "VALIDATION_ERROR");
        if (isSelf) throw httpError("You cannot change your own role", 403, "FORBIDDEN");
        if (member.role !== role) {
            if (member.role === "admin" && role === "member") {
                const adminCount = await memberModel.countDocuments({ role: "admin" });
                if (adminCount <= 1) throw httpError("The last system admin cannot be demoted", 409, "LAST_ADMIN");
            }
            const previousRole = member.role;
            member.role = role;
            roleAudit = {
                actor: req.member._id,
                action: "role.changed",
                target: member._id,
                text: `System role changed for ${member.fname} ${member.lname}: ${previousRole} → ${role}`,
                before: { role: previousRole },
                after: { role },
            };
        }
    }
    if (fname !== undefined) member.fname = fname;
    if (lname !== undefined) member.lname = lname;
    if (gender !== undefined) member.gender = gender;

    if (req.file) {
        const uploadedFile = await fileUpload(req.file.buffer, "members");
        if (uploadedFile?.secure_url) {
            member.profilePicture = uploadedFile.secure_url;
        }
    }

    await member.save();
    if (roleAudit) {
        await accessAuditModel.create(roleAudit);
        broadcastEvent({
            type: "access.updated",
            actorId: String(req.member._id),
            targetUserId: String(member._id),
            message: "role",
        });
    }

    const updated = await memberModel
        .findById(id)
        .populate("teams.teamId", "name")
        .select("-password");

    const mObj = updated.toObject();
    mObj.teams = (mObj.teams || [])
        .filter((t) => t.teamId)
        .map((t) => ({
            teamId: t.teamId._id || t.teamId,
            name: t.teamId.name || "",
            role: normalizeTeamRole(t.role),
        }));

    successResponse({
        res,
        status: 200,
        message: "Member updated successfully",
        data: mObj,
    });
};

export const deleteMember = async (req, res, next) => {
    if (!isSystemAdmin(req.member)) {
        throw httpError("Forbidden: only system admins can delete members", 403, "FORBIDDEN");
    }

    const { id } = req.params;
    if (same(req.member._id, id)) {
        throw httpError("You cannot delete your own admin account", 400, "BAD_REQUEST");
    }

    const memberToDelete = await memberModel.findById(id);
    if (!memberToDelete || String(memberToDelete.addedBy || "") !== String(req.member._id)) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    if (memberToDelete.role === "admin") {
        const adminCount = await memberModel.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
            throw httpError("The last system admin cannot be deleted", 409, "LAST_ADMIN");
        }
    }

    // Unassign from tasks
    await taskAssignmentModel.deleteMany({ member: id });

    // Remove from all teams
    await teamModel.updateMany(
        {},
        {
            $pull: {
                teamMembers: id,
                teamAdims: id,
            },
        }
    );

    await accessOverrideModel.deleteOne({ member: id });
    await memberModel.findByIdAndDelete(id);

    successResponse({
        res,
        status: 200,
        message: "Member deleted successfully",
        data: { _id: id },
    });
};

export const resetMemberPassword = async (req, res, next) => {
    if (!isSystemAdmin(req.member)) {
        throw httpError("Forbidden: only system admins can reset passwords", 403, "FORBIDDEN");
    }

    const { id } = req.params;
    const member = await memberModel.findById(id);
    if (!member || String(member.addedBy || "") !== String(req.member._id)) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    const tempPassword = "Temp@" + crypto.randomBytes(4).toString("hex") + "!";
    const encPassword = hashSync(tempPassword, Number(HASH_SALT) || 12);

    member.password = encPassword;
    member.changeCredentials = new Date();
    await member.save();

    try {
        await sendEmail({
            to: member.email,
            subject: "Your TaskVerse temporary password",
            html: `<p>Hello ${member.fname},</p><p>An administrator has reset your password. Your temporary password is:</p><p><strong>${tempPassword}</strong></p><p>Please log in and change your password immediately.</p>`,
        });
    } catch (emailErr) {
        console.error("Failed to send temporary password email:", emailErr?.message || emailErr);
    }

    successResponse({
        res,
        status: 200,
        message: "Temporary password generated and sent to member email",
    });
};

export const setMemberActive = async (req, res, next) => {
    if (!isSystemAdmin(req.member)) {
        throw httpError("Forbidden: only system admins can change active status", 403, "FORBIDDEN");
    }

    const { id } = req.params;
    const { active } = req.body;

    if (same(req.member._id, id) && active === false) {
        throw httpError("You cannot deactivate your own account", 400, "BAD_REQUEST");
    }

    const memberToUpdate = await memberModel.findOne({ _id: id, addedBy: req.member._id });
    if (!memberToUpdate) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }
    const member = await memberModel.findByIdAndUpdate(
        id,
        { active: active === true },
        { new: true }
    ).select("-password");

    if (!member) {
        throw httpError("Member not found", 404, "USER_NOT_FOUND");
    }

    successResponse({
        res,
        status: 200,
        message: `Member ${active ? "activated" : "deactivated"} successfully`,
        data: member,
    });
};

export const getPreferences = async (req, res, next) => {
    const member = await memberModel.findById(req.member._id);
    if (!member) throw httpError("User not found", 404, "USER_NOT_FOUND");

    const defaultPrefs = {
        emailAssigned: true,
        emailMention: true,
        emailDue: true,
        emailDigest: true,
        push: {},
        quietHours: {},
    };

    successResponse({
        res,
        status: 200,
        message: "Preferences retrieved successfully",
        data: { ...defaultPrefs, ...(member.preferences || {}) },
    });
};

export const updatePreferences = async (req, res, next) => {
    const member = await memberModel.findById(req.member._id);
    if (!member) throw httpError("User not found", 404, "USER_NOT_FOUND");

    const current = member.preferences || {};
    const updates = req.body || {};

    member.preferences = {
        ...current,
        ...updates,
    };

    await member.save();

    successResponse({
        res,
        status: 200,
        message: "Preferences updated successfully",
        data: member.preferences,
    });
};
