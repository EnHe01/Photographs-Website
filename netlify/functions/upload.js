const crypto = require("crypto");
const sharp = require("sharp");
const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");
const github = require("./_lib/github");
const { watermarkOverlays } = require("./_lib/watermark");
const { triggerBuild } = require("./_lib/build");

const UPLOAD_DIR = "static/uploads";
const MAX_DIMENSION = 2400;
const ALLOWED_EXT = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };

function extOf(filename) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

async function processImage(buffer, format, applyWatermark) {
  let image = sharp(buffer, { failOn: "none" }).rotate(); // rotate() normalizes EXIF orientation
  const meta = await image.metadata();
  let width = meta.width;
  let height = meta.height;

  if (applyWatermark) {
    try {
      const overlays = await watermarkOverlays(width, height);
      if (overlays.length) image = image.composite(overlays);
    } catch (err) {
      // Never let a watermark failure block the upload itself — the photo
      // still needs to get published even if the watermark can't be drawn.
      console.error("watermark failed, uploading without it:", err);
    }
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

    // Uploaded files only become servable at /uploads/... once the site
    // rebuilds (Hugo copies static/ into the deployed output) — without
    // this, an image just inserted into the editor shows as broken until
    // the next unrelated Publish. Kick off a rebuild now; the function
    // execution environment can be frozen right after the response is
    // sent, so this has to be awaited rather than fired-and-forgotten, but
    // its failure shouldn't fail the upload that already succeeded.
    try {
      await triggerBuild();
    } catch (err) {
      console.error("failed to trigger rebuild after upload:", err);
    }

    return json(200, { url: `/uploads/${outName}` });
  });
