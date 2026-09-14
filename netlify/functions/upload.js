const crypto = require("crypto");
const sharp = require("sharp");
const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");
const github = require("./_lib/github");
const { watermarkOverlays } = require("./_lib/watermark");

const UPLOAD_DIR = "static/uploads";
const MAX_DIMENSION = 2400;
const ALLOWED_EXT = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };

function extOf(filename) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

async function processImage(buffer, format, applyWatermark) {
  // .rotate() normalizes EXIF orientation, but sharp's .metadata() reports
  // the RAW pre-rotation width/height even on a pipeline that already has
  // .rotate() chained — for any photo that actually needs rotating (i.e.
  // almost every portrait phone/camera shot, which is stored as landscape
  // pixels plus an EXIF rotation tag), that swapped width/height silently
  // broke both the resize target and the watermark's position: the
  // watermark ended up composited past the real (rotated) image's edge,
  // which sharp neither draws nor errors on — it just vanishes. Materialize
  // the rotation first so every measurement after this reflects the image
  // as it will actually be rendered.
  const rotatedBuffer = await sharp(buffer, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(rotatedBuffer).metadata();
  let width = meta.width;
  let height = meta.height;
  let image = sharp(rotatedBuffer);

  // Resizing before watermarking (rather than after) means the watermark
  // and the composite it's drawn onto are both computed at the final,
  // typically much smaller size — cheaper, and keeps the watermark's
  // position/size math working from the dimensions the image actually ends
  // up at.
  if (Math.max(width, height) > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    image = image.resize(width, height);
  }

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
