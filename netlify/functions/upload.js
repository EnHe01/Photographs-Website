const crypto = require("crypto");
const sharp = require("sharp");
const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");
const github = require("./_lib/github");

const UPLOAD_DIR = "static/uploads";
const WATERMARK_TEXT = "© EnHe";
const MAX_DIMENSION = 2400;
const ALLOWED_EXT = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };

function extOf(filename) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

function watermarkSvg(width, height) {
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.025));
  const margin = Math.round(Math.min(width, height) * 0.02);
  const x = width - margin;
  const y = height - margin;
  const escaped = WATERMARK_TEXT.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x + 1}" y="${y + 1}" font-family="sans-serif" font-size="${fontSize}"
            text-anchor="end" fill="black" fill-opacity="0.24">${escaped}</text>
      <text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}"
            text-anchor="end" fill="white" fill-opacity="0.55">${escaped}</text>
    </svg>
  `);
}

async function processImage(buffer, format, applyWatermark) {
  let image = sharp(buffer, { failOn: "none" }).rotate(); // rotate() normalizes EXIF orientation
  const meta = await image.metadata();
  let width = meta.width;
  let height = meta.height;

  if (applyWatermark) {
    image = image.composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }]);
  }

  if (Math.max(width, height) > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    image = image.resize(width, height);
  }

  if (format === "jpeg") image = image.jpeg({ quality: 82, mozjpeg: true });
  else if (format === "png") image = image.png({ quality: 82 });
  else if (format === "webp") image = image.webp({ quality: 82 });

  return image.toBuffer();
}

exports.handler = async (event) =>
  handle(async () => {
    requireAuth(event);
    if (event.httpMethod !== "POST") throw new HttpError(405, "Method not allowed");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const { filename, dataBase64, watermark } = body;
    if (!filename || !dataBase64) throw new HttpError(400, "filename and dataBase64 are required");

    const ext = extOf(filename);
    const format = ALLOWED_EXT[ext];
    if (!format) throw new HttpError(400, `Unsupported image type: .${ext}`);

    const inputBuffer = Buffer.from(dataBase64, "base64");
    if (inputBuffer.length > 15 * 1024 * 1024) throw new HttpError(413, "Image too large (max 15MB)");

    const outputBuffer = await processImage(inputBuffer, format, watermark !== false);

    const hash = crypto.createHash("md5").update(inputBuffer).digest("hex");
    const outExt = format === "jpeg" ? "jpg" : format;
    const outName = `${hash}.${outExt}`;
    const repoPath = `${UPLOAD_DIR}/${outName}`;

    const existingSha = await github.getFileSha(repoPath);
    await github.putFile(repoPath, outputBuffer, `Upload image ${outName}`, existingSha || undefined);

    return json(200, { url: `/uploads/${outName}` });
  });
