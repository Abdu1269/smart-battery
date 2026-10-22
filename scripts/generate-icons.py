#!/usr/bin/env python3
"""Generate BatteryBloom's app and tray icons without external assets."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "src-tauri" / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

CREAM = (246, 244, 237, 255)
INK = (25, 45, 37, 255)
FOREST = (34, 111, 80, 255)
EMERALD = (63, 151, 111, 255)
MINT = (197, 225, 207, 255)
AMBER = (201, 137, 43, 255)


def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_leaf(draw, center, scale, angle=0):
    # A simple two-arc leaf, drawn at a fixed angle from a small polygon.
    cx, cy = center
    points = []
    for i in range(36):
        import math

        t = i / 35
        x = 0.5 * math.cos(math.pi * t) * scale
        y = (t - 0.5) * scale * 1.7
        points.append((x, y))
    for i in range(35, -1, -1):
        import math

        t = i / 35
        x = -0.55 * math.cos(math.pi * t) * scale
        y = (t - 0.5) * scale * 1.7
        points.append((x, y))
    import math

    rad = math.radians(angle)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    transformed = [
        (cx + x * cos_a - y * sin_a, cy + x * sin_a + y * cos_a) for x, y in points
    ]
    draw.polygon(transformed, fill=FOREST)


def app_icon(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.04)
    rounded_rect(
        draw,
        (pad, pad, size - pad, size - pad),
        radius=int(size * 0.23),
        fill=CREAM,
        outline=(226, 222, 209, 255),
        width=max(2, size // 180),
    )

    # Battery body.
    body = (
        int(size * 0.29),
        int(size * 0.34),
        int(size * 0.67),
        int(size * 0.80),
    )
    rounded_rect(
        draw,
        body,
        radius=int(size * 0.08),
        fill=(255, 255, 255, 70),
        outline=INK,
        width=int(size * 0.035),
    )
    # Terminal.
    rounded_rect(
        draw,
        (
            int(size * 0.43),
            int(size * 0.28),
            int(size * 0.53),
            int(size * 0.36),
        ),
        radius=int(size * 0.014),
        fill=INK,
    )
    # Charge fill, clipped to a rounded inner shape.
    fill = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fill_draw = ImageDraw.Draw(fill)
    fill_top = int(size * 0.50)
    rounded_rect(
        fill_draw,
        (
            int(size * 0.325),
            fill_top,
            int(size * 0.635),
            int(size * 0.765),
        ),
        radius=int(size * 0.045),
        fill=EMERALD,
    )
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    rounded_rect(
        mask_draw,
        (
            int(size * 0.315),
            int(size * 0.365),
            int(size * 0.645),
            int(size * 0.775),
        ),
        radius=int(size * 0.06),
        fill=255,
    )
    img.alpha_composite(Image.composite(fill, Image.new("RGBA", (size, size)), mask))

    # Leaves growing from the top-right of the battery.
    draw_leaf(draw, (int(size * 0.73), int(size * 0.30)), int(size * 0.105), 24)
    draw_leaf(draw, (int(size * 0.82), int(size * 0.38)), int(size * 0.075), 72)
    draw.line(
        [
            (int(size * 0.68), int(size * 0.37)),
            (int(size * 0.735), int(size * 0.29)),
            (int(size * 0.80), int(size * 0.35)),
        ],
        fill=FOREST,
        width=int(size * 0.012),
        joint="curve",
    )

    # A small calm highlight.
    draw.arc(
        (
            int(size * 0.36),
            int(size * 0.43),
            int(size * 0.60),
            int(size * 0.70),
        ),
        start=200,
        end=250,
        fill=MINT,
        width=int(size * 0.018),
    )
    return img


def tray_icon(color, size=64, alert=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    outline = color
    body = (12, 17, 52, 55)
    rounded_rect(draw, body, radius=7, outline=outline, width=4)
    rounded_rect(draw, (25, 10, 39, 17), radius=2, fill=outline)
    if alert:
        draw.rounded_rectangle((19, 25, 45, 45), radius=5, fill=AMBER)
        draw.line((32, 22, 32, 31), fill=(255, 255, 255, 255), width=4)
        draw.ellipse((29, 34, 35, 40), fill=(255, 255, 255, 255))
    else:
        draw.rounded_rectangle((18, 33, 46, 49), radius=5, fill=EMERALD)
        draw.arc((20, 22, 44, 41), start=200, end=300, fill=color, width=3)
    return img


if __name__ == "__main__":
    app_icon().save(ICON_DIR / "app-icon.png")
    tray_icon(FOREST).save(ICON_DIR / "tray-normal.png")
    tray_icon(AMBER, alert=True).save(ICON_DIR / "tray-alert.png")
    print(f"Wrote icons to {ICON_DIR}")
