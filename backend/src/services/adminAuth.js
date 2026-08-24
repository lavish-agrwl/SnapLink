const crypto = require("crypto");

const COOKIE_NAME = "snaplink_admin";
const SESSION_VALUE = "authenticated";

function sign(value, password) {
  return crypto.createHmac("sha256", password).update(value).digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const prefix = `${name}=`;

  return header
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
}

function createAdminAuth({ password, isProduction = false }) {
  function isAuthenticated(req) {
    const token = getCookie(req, COOKIE_NAME);
    if (!token) return false;

    const expected = `${SESSION_VALUE}.${sign(SESSION_VALUE, password)}`;
    return safeEqual(token, expected);
  }

  function setSession(res) {
    const token = `${SESSION_VALUE}.${sign(SESSION_VALUE, password)}`;
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/admin",
    });
  }

  function clearSession(res) {
    res.clearCookie(COOKIE_NAME, { path: "/admin" });
  }

  function requireAuth(req, res, next) {
    if (isAuthenticated(req)) return next();

    return res.redirect(303, "/admin/login");
  }

  return {
    clearSession,
    isAuthenticated,
    requireAuth,
    setSession,
    safeEqual,
  };
}

module.exports = {
  COOKIE_NAME,
  createAdminAuth,
};
