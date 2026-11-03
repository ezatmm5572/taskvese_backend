import accessConfigModel from "../../DB/models/accessConfig.js";
import accessOverrideModel from "../../DB/models/accessOverride.js";
import { httpError, isSystemAdmin, normalizeTeamRole } from "./permissions.js";

export const PERMISSION_KEYS = Object.freeze([
    "view.overview", "view.tasks", "view.teams", "view.members", "view.assignments", "view.reports",
    "task.create", "task.edit", "task.delete", "task.assign", "task.status", "task.comment",
    "task.attach", "task.logTime", "task.share", "team.create", "team.manage", "team.delete",
    "member.invite", "member.edit", "report.export",
]);
const ALL = [...PERMISSION_KEYS];

export const DEFAULT_PRESETS = Object.freeze({
    member: [
        "view.overview", "view.tasks", "view.teams", "view.members", "view.assignments", "view.reports",
        "task.create", "task.edit", "task.status", "task.comment", "task.attach", "task.logTime",
        "task.share", "report.export",
    ],
    viewer: ["view.overview", "view.tasks", "view.teams", "view.members", "view.assignments"],
});

export const validatePermissionKeys = (keys, field = "permissions") => {
    if (!Array.isArray(keys)) throw httpError(`${field} must be an array`, 422, "VALIDATION_ERROR");
    const unknown = [...new Set(keys)].filter((key) => !PERMISSION_KEYS.includes(key));
    if (unknown.length) throw httpError(`Unknown permission key(s): ${unknown.join(", ")}`, 422, "VALIDATION_ERROR");
    return [...new Set(keys)];
};

export const getAccessConfig = async () => {
    let config = await accessConfigModel.findById("global").lean();
    if (!config) {
        try {
            config = await accessConfigModel.create({ _id: "global", enabled: false, presets: DEFAULT_PRESETS });
        } catch (error) {
            if (error?.code !== 11000) throw error;
            config = await accessConfigModel.findById("global");
        }
        config = config.toObject();
    }
    return {
        ...config,
        presets: {
            member: config.presets?.member ?? DEFAULT_PRESETS.member,
            viewer: config.presets?.viewer ?? DEFAULT_PRESETS.viewer,
        },
    };
};

export const deriveAccessRole = async (member) => {
    if (isSystemAdmin(member)) return "admin";
    const teamEntries = member?.teams || [];
    if (teamEntries.length > 0 && teamEntries.every((entry) => normalizeTeamRole(entry.role) === "viewer")) {
        return "viewer";
    }
    return "member";
};

export const resolveEffectivePermissions = async (member, config = null) => {
    const access = config || await getAccessConfig();
    const role = await deriveAccessRole(member);
    if (role === "admin") return { enabled: !!access.enabled, role, permissions: ALL };
    if (!access.enabled) return { enabled: false, role, permissions: ALL };

    const preset = access.presets?.[role] ?? DEFAULT_PRESETS[role];
    const override = await accessOverrideModel.findOne({ member: member._id }).lean();
    const allow = new Set(override?.allow || []);
    const deny = new Set(override?.deny || []);
    const effective = new Set(preset);
    for (const key of allow) effective.add(key);
    for (const key of deny) effective.delete(key);
    return { enabled: true, role, permissions: [...effective] };
};

export const requirePermission = (permission) => async (req, res, next) => {
    try {
        if (!req.member) throw httpError("Authentication required", 401, "UNAUTHORIZED");
        const config = await getAccessConfig();
        if (!config.enabled || isSystemAdmin(req.member)) return next();

        // Preserve the existing viewer read-only contract before evaluating custom permissions.
        // A viewer cannot gain write access by an Allow override.
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
            const role = await deriveAccessRole(req.member);
            if (role === "viewer") {
                return res.status(403).json({
                    code: "VIEWER_READ_ONLY",
                    message: "Viewers have read-only access",
                });
            }
        }
        const resolved = await resolveEffectivePermissions(req.member, config);
        if (!resolved.permissions.includes(permission)) {
            return res.status(403).json({
                code: "PERMISSION_DENIED",
                message: `Missing permission: ${permission}`,
                permission,
            });
        }
        req.access = resolved;
        next();
    } catch (error) { next(error); }
};

export const requireSystemAdmin = (req, res, next) => {
    if (!isSystemAdmin(req.member)) {
        return res.status(403).json({ message: "Only system admins can manage access control", code: "FORBIDDEN" });
    }
    next();
};


export const requirePermissionOrSelf = (permission, idParam = "id") => async (req, res, next) => {
    try {
        if (req.member && String(req.member._id) === String(req.params?.[idParam])) return next();
        return requirePermission(permission)(req, res, next);
    } catch (error) { next(error); }
};
