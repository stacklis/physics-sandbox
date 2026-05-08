"""Generate the Physics Sandbox icon set.

Produces (in repo root):
  - icon-master-1024.png  (master art)
  - icon-512.png
  - icon-512-maskable.png  (with the safe-zone padding maskable PWA icons need)
  - icon-192.png
  - apple-touch-icon.png   (180x180)
  - favicon.ico            (multi-size: 16, 32, 48)

Concept: extends the existing `⊙` placeholder. A circle (the "ball") sits inside
a tilted ring/orbit, with a small inner accent — geometric, calm, brand-aligned
with the topbar logo gradient (#6aa6ff → #8ad0ff on a near-black bg).

Pure stdlib + Pillow. Run: python scripts/generate_icons.py
"""

from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Brand palette (matches styles.css :root tokens)
BG_DARK_TOP = (17, 20, 27)       # var(--bg-1)
BG_DARK_BOT = (11, 13, 18)       # var(--bg)
BALL_OUTER = (138, 208, 255)     # var(--accent-2)
BALL_INNER = (106, 166, 255)     # var(--accent)
RING_COLOR = (138, 208, 255)
HIGHLIGHT  = (231, 236, 245)     # var(--text)


def _bg(size: int, *, transparent: bool = False) -> Image.Image:
    """Square background. Transparent for maskable & favicon if requested,
    otherwise a vertical dark gradient that matches the topbar."""
    if transparent:
        return Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img = Image.new('RGBA', (size, size), BG_DARK_BOT + (255,))
    # Cheap two-stop vertical gradient.
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(BG_DARK_TOP[0] * (1 - t) + BG_DARK_BOT[0] * t)
        g = int(BG_DARK_TOP[1] * (1 - t) + BG_DARK_BOT[1] * t)
        b = int(BG_DARK_TOP[2] * (1 - t) + BG_DARK_BOT[2] * t)
        ImageDraw.Draw(img).line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img


def _draw_mark(img: Image.Image, *, scale: float = 1.0) -> None:
    """Draw the ball-on-orbit mark, centered, scaled to `scale` of the canvas."""
    size = img.size[0]
    cx = cy = size / 2

    # Outer ring (orbit) — tilted ellipse.
    ring_r_x = size * 0.40 * scale
    ring_r_y = size * 0.16 * scale
    ring_w = max(2, int(size * 0.025 * scale))
    # Render onto an oversampled tilted layer so the ellipse rotates cleanly.
    over = 4
    layer = Image.new('RGBA', (size * over, size * over), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    lcx, lcy = (size * over) / 2, (size * over) / 2
    ldraw.ellipse(
        [lcx - ring_r_x * over, lcy - ring_r_y * over,
         lcx + ring_r_x * over, lcy + ring_r_y * over],
        outline=RING_COLOR + (235,),
        width=ring_w * over,
    )
    layer = layer.rotate(-22, resample=Image.BICUBIC)
    layer = layer.resize((size, size), Image.LANCZOS)
    img.alpha_composite(layer)

    # Ball — radial-ish gradient via concentric circles.
    ball_r = size * 0.22 * scale
    # Soft glow halo first.
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for i, alpha in enumerate([18, 14, 10, 6]):
        rr = ball_r + (i + 1) * size * 0.012
        gdraw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                      fill=BALL_OUTER + (alpha,))
    img.alpha_composite(glow)

    # Body of the ball, faked radial gradient (offset highlight).
    steps = 64
    for i in range(steps, 0, -1):
        t = i / steps
        # Outer = accent, inner-to-highlight = accent-2 lighter
        r = int(BALL_INNER[0] * t + BALL_OUTER[0] * (1 - t))
        g = int(BALL_INNER[1] * t + BALL_OUTER[1] * (1 - t))
        b = int(BALL_INNER[2] * t + BALL_OUTER[2] * (1 - t))
        rr = ball_r * t
        # Offset center toward upper-left for a lit-from-30%-30% feel
        ox = cx - ball_r * 0.18 * (1 - t)
        oy = cy - ball_r * 0.22 * (1 - t)
        ImageDraw.Draw(img).ellipse(
            [ox - rr, oy - rr, ox + rr, oy + rr],
            fill=(r, g, b, 255),
        )

    # Highlight speck (matches the box-shadow / radial-gradient on .logo)
    spec_r = ball_r * 0.16
    spec_x = cx - ball_r * 0.42
    spec_y = cy - ball_r * 0.46
    ImageDraw.Draw(img).ellipse(
        [spec_x - spec_r, spec_y - spec_r, spec_x + spec_r, spec_y + spec_r],
        fill=HIGHLIGHT + (200,),
    )

    # Tiny axis dot at orbit-ring intersection — gives the ⊙ "axis" feel.
    pin_r = size * 0.018 * scale
    # Place along the rotated ring at +x extreme.
    import math
    theta = math.radians(-22)
    px = cx + math.cos(theta) * ring_r_x
    py = cy + math.sin(theta) * ring_r_x
    ImageDraw.Draw(img).ellipse(
        [px - pin_r, py - pin_r, px + pin_r, py + pin_r],
        fill=HIGHLIGHT + (255,),
    )


def make_master(size: int = 1024) -> Image.Image:
    """Branded square icon — used for favicon, apple-touch, normal PWA icon."""
    img = _bg(size)
    _draw_mark(img, scale=1.0)
    return img


def make_maskable(size: int = 512) -> Image.Image:
    """Maskable PWA icon — needs a 'safe zone' (the inner 80% circle / ~64% area
    must contain the recognizable mark; the outer 20% may be cropped to any
    shape by the OS)."""
    img = _bg(size)
    # Squeeze the mark so the whole thing fits in the inner ~62% — generous.
    _draw_mark(img, scale=0.62)
    return img


def write_png(img: Image.Image, path: Path) -> None:
    img.save(path, format='PNG', optimize=True)
    print(f'wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})')


def write_ico(master: Image.Image, path: Path) -> None:
    sizes = [(16, 16), (32, 32), (48, 48)]
    # Pillow's ICO writer takes a `sizes` argument and resamples down from the
    # source. Pass a 256x256 source for clean LANCZOS downsample.
    src = master.resize((256, 256), Image.LANCZOS)
    src.save(path, format='ICO', sizes=sizes)
    print(f'wrote {path.relative_to(ROOT)} (16/32/48)')


def main() -> int:
    master = make_master(1024)
    write_png(master, ROOT / 'icon-master-1024.png')
    write_png(master.resize((512, 512), Image.LANCZOS), ROOT / 'icon-512.png')
    write_png(master.resize((192, 192), Image.LANCZOS), ROOT / 'icon-192.png')
    write_png(master.resize((180, 180), Image.LANCZOS), ROOT / 'apple-touch-icon.png')
    write_png(make_maskable(512), ROOT / 'icon-512-maskable.png')
    write_ico(master, ROOT / 'favicon.ico')

    # Open Graph image (1200x630) — used by landing OG tags. Reuse the
    # gradient bg + mark so social previews look on-brand without extra work.
    og = Image.new('RGBA', (1200, 630), BG_DARK_BOT + (255,))
    # Gradient
    for y in range(630):
        t = y / 629
        r = int(BG_DARK_TOP[0] * (1 - t) + BG_DARK_BOT[0] * t)
        g = int(BG_DARK_TOP[1] * (1 - t) + BG_DARK_BOT[1] * t)
        b = int(BG_DARK_TOP[2] * (1 - t) + BG_DARK_BOT[2] * t)
        ImageDraw.Draw(og).line([(0, y), (1200, y)], fill=(r, g, b, 255))
    # Place a 460px master mark on the left.
    mark = master.resize((460, 460), Image.LANCZOS)
    og.paste(mark, (110, 85), mark)
    # Crude wordmark, drawn with the default PIL bitmap font (no font deps).
    d = ImageDraw.Draw(og)
    try:
        from PIL import ImageFont
        # Try a system font; fall back gracefully.
        font_big = ImageFont.truetype('seguisb.ttf', 64)
        font_sm = ImageFont.truetype('segoeui.ttf', 28)
    except Exception:
        from PIL import ImageFont
        font_big = ImageFont.load_default()
        font_sm = ImageFont.load_default()
    d.text((620, 230), 'Physics Sandbox', fill=HIGHLIGHT + (255,), font=font_big)
    d.text((622, 320), 'Learn physics by playing.', fill=(180, 192, 215, 255), font=font_sm)
    d.text((622, 360), 'sandbox.stacklis.com', fill=(106, 166, 255, 255), font=font_sm)
    write_png(og, ROOT / 'og-image.png')

    print('\nDone. Outputs in repo root.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
