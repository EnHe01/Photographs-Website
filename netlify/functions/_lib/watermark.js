const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const fontBase64 = require("./watermark-font-data");

const WATERMARK_TEXT = "© EnHe";

let fontFilePath = null;

// Materializes the embedded font to a real file once per warm function
// instance (sharp's text renderer needs a file path, not a buffer) and
// reuses it on subsequent calls.
function getFontFilePath() {
  if (fontFilePath) return fontFilePath;
  const dest = path.join(os.tmpdir(), "watermark-font.ttf");
  fs.writeFileSync(dest, Buffer.from(fontBase64, "base64"));
  fontFilePath = dest;
  return fontFilePath;
}

// Recolors a black-on-transparent text mask by compositing it (as an alpha
// mask, via the "dest-in" blend) over a solid rgba canvas of the same size.
async function tintedText(mask, width, height, r, g, b, alpha) {
  const canvas = sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha } } });
  return canvas.composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

// Returns sharp composite() overlay descriptors for a "© EnHe" watermark in
// the bottom-right corner of an image of the given size (white text with a
// subtle drop shadow, mirroring the site's original Python/Pillow
// watermark), or [] if the image is too small to fit even a minimal one.
//
// Text is rendered via sharp's native text-to-image input with an explicit
// fontfile, not an SVG <text> element with a font-family name — Netlify
// Functions run with no system fonts installed at all, so font-family
// lookups (even "sans-serif") silently fail and every glyph renders as a
// tofu box. An explicit font file sidesteps font-family matching entirely.
async function watermarkOverlays(width, height) {
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.025));
  const margin = Math.round(Math.min(width, height) * 0.02);

  let mask = await sharp({
    text: { text: WATERMARK_TEXT, fontfile: getFontFilePath(), dpi: 300, rgba: true },
  }).png().toBuffer();
  const maskMeta = await sharp(mask).metadata();

  const scale = fontSize / maskMeta.height;
  const textWidth = Math.max(1, Math.round(maskMeta.width * scale));
  const textHeight = Math.max(1, Math.round(maskMeta.height * scale));
  mask = await sharp(mask).resize(textWidth, textHeight).toBuffer();

  const x = width - margin - textWidth;
  const y = height - margin - textHeight;
  if (x < 0 || y < 0) return [];

  const [whiteText, blackShadow] = await Promise.all([
    tintedText(mask, textWidth, textHeight, 255, 255, 255, 0.55),
    tintedText(mask, textWidth, textHeight, 0, 0, 0, 0.35),
  ]);

  return [
    { input: blackShadow, left: x + 1, top: y + 1 },
    { input: whiteText, left: x, top: y },
  ];
}

module.exports = { watermarkOverlays };
