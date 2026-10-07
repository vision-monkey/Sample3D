"""Generates the Google Play store graphics for 진동 도감.

Usage: python3 make_graphics.py <font.ttc> <output-dir>

- icon-512.png      512 x 512 hi-res app icon (Play applies its own mask)
- feature-1024x500.png  feature graphic
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG_TOP = (15, 23, 32)
BG_BOTTOM = (13, 61, 66)
TEAL = (79, 209, 197)
WHITE = (240, 253, 250)
MUTED = (153, 246, 228)

# Same waveform as the adaptive launcher icon (108 x 108 viewport).
WAVE = [(30, 54), (38, 54), (43, 40), (50, 70), (56, 32), (62, 74), (68, 44), (73, 58), (78, 54)]


def gradient(size):
    w, h = size
    img = Image.new("RGB", size, BG_TOP)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def draw_wave(draw, center, scale, width, color):
    cx, cy = center
    pts = [(cx + (x - 54) * scale, cy + (y - 54) * scale) for x, y in WAVE]
    draw.line(pts, fill=color, width=width, joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def icon(out: Path):
    size = 512
    img = gradient((size, size))
    d = ImageDraw.Draw(img)
    draw_wave(d, (256, 256), 7.0, 34, TEAL)
    img.save(out / "icon-512.png", optimize=True)


def feature(font_path: str, out: Path):
    w, h = 1024, 500
    img = gradient((w, h))
    d = ImageDraw.Draw(img)
    draw_wave(d, (250, 250), 6.0, 26, TEAL)
    title = ImageFont.truetype(font_path, 104, index=0)
    sub = ImageFont.truetype(font_path, 40, index=0)
    d.text((470, 150), "진동 도감", font=title, fill=WHITE)
    d.text((474, 300), "50가지 진동을 손끝으로", font=sub, fill=MUTED)
    img.save(out / "feature-1024x500.png", optimize=True)


if __name__ == "__main__":
    font, out_dir = sys.argv[1], Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    icon(out_dir)
    feature(font, out_dir)
    print("wrote", sorted(p.name for p in out_dir.iterdir()))
