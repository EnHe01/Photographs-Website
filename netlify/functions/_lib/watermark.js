const sharp = require("sharp");
const glyphBase64 = require("./watermark-glyph-data");

const glyphMask = Buffer.from(glyphBase64, "base64");
let glyphMeta = null;

// Recolors a black-on-transparent text mask by compositing it (as an alpha
// mask, via the "dest-in" blend) over a solid rgba canvas of the same size.
async function tintedGlyph(width, height, r, g, b, alpha) {
  const resized = await sharp(glyphMask).resize(width, height).toBuffer();
  const canvas = sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha } } });
  return canvas.composite([{ input: resized, blend: "dest-in" }]).png().toBuffer();
}

// Returns sharp composite() overlay descriptors for a "© EnHe" watermark in
// the bottom-right corner of an image of the given size (white text with a
// subtle drop shadow, mirroring the site's original Python/Pillow
// watermark), or [] if the image is too small to fit even a minimal one.
//
// The glyph shape comes from a pre-rasterized PNG (./watermark-glyph-data.js)
// baked in at build time, not from rendering text at request time. Netlify
// Functions run without a reliable fontconfig/Pango setup, so sharp's text
// input — even given an explicit fontfile — is unreliable there: it worked
// in local testing but silently produced an invisible watermark for real
// uploads in production. Compositing an existing bitmap sidesteps runtime
// font rasterization entirely.
async function watermarkOverlays(width, height) {
  if (!glyphMeta) glyphMeta = await sharp(glyphMask).metadata();

  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.025));
  const margin = Math.round(Math.min(width, height) * 0.02);

  const scale = fontSize / glyphMeta.height;
  const textWidth = Math.max(1, Math.round(glyphMeta.width * scale));
  const textHeight = Math.max(1, Math.round(glyphMeta.height * scale));

  const x = width - margin - textWidth;
  const y = height - margin - textHeight;
  if (x < 0 || y < 0) return [];

  const [whiteText, blackShadow] = await Promise.all([
    tintedGlyph(textWidth, textHeight, 255, 255, 255, 0.55),
    tintedGlyph(textWidth, textHeight, 0, 0, 0, 0.35),
  ]);

  return [
    { input: blackShadow, left: x + 1, top: y + 1 },
    { input: whiteText, left: x, top: y },
  ];
}

module.exports = { watermarkOverlays };
