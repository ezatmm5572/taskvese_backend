// Shared permission helpers.
// NOTE: the team schema field is spelled "teamAdims" (kept as-is to match existing data).

export const normalizeTeamRole = (role) => {
    if (!role) return "editor";
    const r = String(role).trim().toLowerCase();
    if (r === "admin" || r === "teamadmin") return "admin";
    if (r === "viewer" || r === "teamviewer") return "viewer";
    if (r === "editor" || r === "member" || r === "teammember") return "editor";
    return "editor";
};

export const httpError = (message, statusCode = 400, code = null, errors = null) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.errorCode = code;
    if (errors) error.errors = errors;
    return error;
};

export const same = (a, b) => String(a?._id || a || "") === String(b?._id || b || "");

export const isSystemAdmin = (member) => member?.role === "admin";

// Resolve a member's effective role in a team: 'admin' | 'editor' | 'viewer' | null
export const getMemberTeamRole = (team, member) => {
    if (!team || !member) return null;
    if (same(team.addedBy, member._id)) return "admin";
    if ((team.teamAdims || []).some((a) => same(a, member._id))) return "admin";
    if ((team.teamAdmins || []).some((a) => same(a, member._id))) return "admin";

    // Check member's teams array
    const memberTeamEntry = (member.teams || []).find((t) => same(t.teamId, team._id || team));
    if (memberTeamEntry) {
        return normalizeTeamRole(memberTeamEntry.role);
    }

    if ((team.teamMembers || []).some((m) => same(m, member._id))) {
        return "editor";
    }

    return null;
};

// Owner/admin of a team
export const isTeamManager = (team, member) => {
    if (!team || !member) return false;
    if (same(team.addedBy, member._id)) return true;
    if ((team.teamAdims || []).some((a) => same(a, member._id))) return true;
    if ((team.teamAdmins || []).some((a) => same(a, member._id))) return true;
    const role = getMemberTeamRole(team, member);
    return role === "admin";
};

// Check if member is strictly a viewer in the team (and not an admin / team manager)
export const isViewerInTeam = (team, member) => {
    if (!team || !member) return false;
    if (isTeamManager(team, member)) return false;
    const role = getMemberTeamRole(team, member);
    return role === "viewer";
};

// Assert viewer is rejected with 403 VIEWER_READ_ONLY
export const assertNotViewer = (team, member) => {
    if (team && isViewerInTeam(team, member)) {
        throw httpError("Viewers have read-only access", 403, "VIEWER_READ_ONLY");
    }
};

// Can create a task in a team: TMgr or Editor in that team (viewers cannot)
export const canCreateTask = (member, team) => {
    if (!member) return false;
    if (!team) return true; // Tasks without team
    if (isTeamManager(team, member)) return true;
    const role = getMemberTeamRole(team, member);
    return role === "editor";
};

// Can edit/delete/archive/assign/share a task: task creator or team manager
export const canManageTask = (member, task, team) => {
    if (!member) return false;
    if (same(task?.createdBy, member._id)) return true;
    return isTeamManager(team, member);
};

// Can view a task: creator, team member, or assigned member
export const canViewTask = (member, task, team = null, isAssigned = false) => {
    if (!member || !task) return false;
    if (canManageTask(member, task, team)) return true;
    if (same(task?.createdBy, member._id)) return true;
    if (isAssigned) return true;
    if (team) {
        const role = getMemberTeamRole(team, member);
        if (role) return true;
    }
    return false;
};
