// Shared permission helpers.
// NOTE: the team schema field is spelled "teamAdims" (kept as-is to match existing data).

export const httpError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const same = (a, b) => String(a?._id || a) === String(b?._id || b);

export const isSystemAdmin = (member) => member?.role === "admin";

// Owner/admin of a team (or a system admin)
export const isTeamManager = (team, member) => {
    if (!team || !member) return false;
    if (isSystemAdmin(member)) return true;
    if (same(team.addedBy, member._id)) return true;
    return (team.teamAdims || []).some((a) => same(a, member._id));
};

// Can edit/delete/assign a task
export const canManageTask = (member, task, team) => {
    if (isSystemAdmin(member)) return true;
    if (same(task.createdBy, member._id)) return true;
    return isTeamManager(team, member);
};
