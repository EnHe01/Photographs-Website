function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {}),
    body: JSON.stringify(body),
  };
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function handle(fn) {
  try {
    return await fn();
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    if (status === 500) console.error(err);
    return json(status, { error: err.message || "Internal error" });
  }
}

module.exports = { json, HttpError, handle };
