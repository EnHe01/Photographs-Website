import os
import sys
from PIL import Image, ImageDraw, ImageFont

UPLOADS_DIR = "static/uploads"
WATERMARK_TEXT = "© EnHe"
SKIP_FILES = {"avatar.jpg", "avatar.jpeg"}

def add_watermark(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        w, h = img.size

        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        font_size = max(12, int(min(w, h) * 0.025))
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        except:
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        margin = int(min(w, h) * 0.02)
        x = w - text_w - margin
        y = h - text_h - margin

        draw.text((x + 1, y + 1), WATERMARK_TEXT, font=font, fill=(0, 0, 0, 60))
        draw.text((x, y), WATERMARK_TEXT, font=font, fill=(255, 255, 255, 140))

        combined = Image.alpha_composite(img, overlay)
        result = combined.convert("RGB")
        result.save(img_path, quality=92, optimize=True)
        print(f"  Watermarked: {img_path}")
    except Exception as e:
        print(f"  Skipped {img_path}: {e}")

def main():
    if not os.path.exists(UPLOADS_DIR):
        print("No uploads directory found.")
        return

    for fname in os.listdir(UPLOADS_DIR):
        if fname in SKIP_FILES:
            continue
        if fname.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            add_watermark(os.path.join(UPLOADS_DIR, fname))

if __name__ == "__main__":
    main()
