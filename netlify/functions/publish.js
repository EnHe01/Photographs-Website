const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth, requireEnv } = require("./_lib/auth");

exports.handler = async (event) =>
  handle(async () => {
    requireAuth(event);
    if (event.httpMethod !== "POST") throw new HttpError(405, "Method not allowed");

    const hookUrl = requireEnv("NETLIFY_BUILD_HOOK_URL");
    const res = await fetch(hookUrl, { method: "POST" });
    if (!res.ok) throw new HttpError(502, `Build hook failed: ${res.status}`);

    return json(200, { ok: true });
  });
