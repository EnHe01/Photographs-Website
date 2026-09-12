const bcrypt = require("bcryptjs");
const { json, handle, HttpError } = require("./_lib/response");
const { requireEnv, signSession, sessionCookie } = require("./_lib/auth");

exports.handler = async (event) =>
  handle(async () => {
    if (event.httpMethod !== "POST") throw new HttpError(405, "Method not allowed");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const { username, password } = body;
    if (!username || !password) throw new HttpError(400, "Missing username or password");

    const expectedUsername = requireEnv("ADMIN_USERNAME");
    const passwordHash = requireEnv("ADMIN_PASSWORD_HASH");

    // Constant-time-ish: always run bcrypt.compare even on username mismatch,
    // so failed logins don't leak which field was wrong via timing.
    const validPassword = await bcrypt.compare(password, passwordHash);
    const validUsername = username === expectedUsername;

    if (!validUsername || !validPassword) throw new HttpError(401, "Invalid credentials");

    const token = signSession(username);
    return json(200, { ok: true }, { "Set-Cookie": sessionCookie(token) });
  });
