const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");
const { triggerBuild } = require("./_lib/build");

exports.handler = async (event) =>
  handle(async () => {
    requireAuth(event);
    if (event.httpMethod !== "POST") throw new HttpError(405, "Method not allowed");

    const res = await triggerBuild();
    if (!res.ok) throw new HttpError(502, `Build hook failed: ${res.status}`);

    return json(200, { ok: true });
  });
