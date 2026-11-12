const COOKIE_NAME = "taskverse_refresh";

const parseCookieHeader = (header = "") => Object.fromEntries(
    header.split(";").map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return ["", ""];
        const rawValue = part.slice(index + 1).trim();
        let value = rawValue;
        try { value = decodeURIComponent(rawValue); } catch {}
        return [part.slice(0, index).trim(), value];
    }).filter(([key]) => key)
);

export const getRefreshCookie = (req) => parseCookieHeader(req.headers?.cookie || "")[COOKIE_NAME] || "";

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
});

export const setRefreshCookie = (res, token) => {
    res.cookie(COOKIE_NAME, token, cookieOptions());
};

export const clearRefreshCookie = (res) => {
    const { maxAge, ...options } = cookieOptions();
    res.clearCookie(COOKIE_NAME, options);
};
