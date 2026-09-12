const { json, handle } = require("./_lib/response");
const { clearedCookie } = require("./_lib/auth");

exports.handler = async () =>
  handle(async () => json(200, { ok: true }, { "Set-Cookie": clearedCookie() }));
