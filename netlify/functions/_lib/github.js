const { requireEnv } = require("./auth");
const { HttpError } = require("./response");

const API = "https://api.github.com";

function config() {
  return {
    repo: requireEnv("GITHUB_REPO"), // "owner/name"
    branch: process.env.GITHUB_BRANCH || "main",
    token: requireEnv("GITHUB_TOKEN"),
  };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "photographs-admin",
  };
}

// Returns { text, sha, encoding } or null if the file doesn't exist.
async function getFile(path) {
  const { repo, branch, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}?ref=${branch}`, {
    headers: headers(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, `GitHub getFile failed: ${await res.text()}`);
  const data = await res.json();
  if (Array.isArray(data)) throw new HttpError(400, `${path} is a directory`);
  const text = Buffer.from(data.content, data.encoding || "base64").toString("utf-8");
  return { text, sha: data.sha };
}

// Returns the file's sha without downloading/decoding its content (cheaper
// for binary files where we only need to know whether it already exists).
async function getFileSha(path) {
  const { repo, branch, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}?ref=${branch}`, {
    headers: headers(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, `GitHub getFileSha failed: ${await res.text()}`);
  const data = await res.json();
  if (Array.isArray(data)) throw new HttpError(400, `${path} is a directory`);
  return data.sha;
}

// Returns array of { name, path, sha, type } or [] if the directory doesn't exist.
async function listDir(path) {
  const { repo, branch, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}?ref=${branch}`, {
    headers: headers(token),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new HttpError(res.status, `GitHub listDir failed: ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new HttpError(400, `${path} is not a directory`);
  return data.map((e) => ({ name: e.name, path: e.path, sha: e.sha, type: e.type }));
}

// content: string (utf-8 text) or Buffer (binary). sha: pass when updating an existing file.
async function putFile(path, content, message, sha) {
  const { repo, branch, token } = config();
  const contentBase64 = Buffer.isBuffer(content)
    ? content.toString("base64")
    : Buffer.from(content, "utf-8").toString("base64");
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new HttpError(res.status, `GitHub putFile failed: ${await res.text()}`);
  const data = await res.json();
  return { sha: data.content.sha };
}

async function deleteFile(path, message, sha) {
  const { repo, branch, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}`, {
    method: "DELETE",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok) throw new HttpError(res.status, `GitHub deleteFile failed: ${await res.text()}`);
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

module.exports = { getFile, getFileSha, listDir, putFile, deleteFile };
