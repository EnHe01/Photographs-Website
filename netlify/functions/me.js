const { json, handle } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");

// Lightweight endpoint the frontend calls on load to check whether the
// session cookie is still valid, without needing to fetch real data.
exports.handler = async (event) =>
  handle(async () => {
    const session = requireAuth(event);
    return json(200, { ok: true, username: session.sub });
  });
