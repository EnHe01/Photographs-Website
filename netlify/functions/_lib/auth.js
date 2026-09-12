const jwt = require("jsonwebtoken");
const { HttpError } = require("./response");

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Missing required env var: ${name}`);
  return v;
}

function signSession(username) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign({ sub: username }, secret, { expiresIn: SESSION_TTL_SECONDS });
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearedCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function requireAuth(event) {
  const secret = requireEnv("JWT_SECRET");
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) throw new HttpError(401, "Not authenticated");
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    throw new HttpError(401, "Session expired or invalid");
  }
}

module.exports = {
  COOKIE_NAME,
  requireEnv,
  signSession,
  sessionCookie,
  clearedCookie,
  requireAuth,
};
