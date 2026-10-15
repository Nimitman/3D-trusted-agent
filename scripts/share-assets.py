"""
Generates the share assets from the badge's own geometry, so they always match
the film: public/favicon.svg, public/apple-touch-icon.png and public/og.png.

Re-run after changing the brand purple:  python3 scripts/share-assets.py
Needs Pillow (pip install pillow). Uses the Archivo instances in public/fonts.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

VOID = "#0c0b0a"
BONE = "#ece7de"
STONE = "#8d8a83"
PLINTH = "#57534d"
# Placeholder for the Housing.com purple, as light (#7a45ff reads at icon size).
PURPLE_LIT = "#7a45ff"

# Mirrors src/three/geometry/keystone.ts.
R1, R2, H, STONES, JOINT, KEY_RISE = 0.62, 1.0, 1.05, 9, 0.012, 0.17


def outlines():
    voussoirs, key = [], None
    for i in range(STONES):
        a0 = math.pi - i * math.pi / STONES - JOINT
        a1 = math.pi - (i + 1) * math.pi / STONES + JOINT
        ro = R2 + KEY_RISE if i == 4 else R2
        pts = [
            (math.cos(a0) * R1, H + math.sin(a0) * R1),
            (math.cos(a0) * ro, H + math.sin(a0) * ro),
            (math.cos(a1) * ro, H + math.sin(a1) * ro),
            (math.cos(a1) * R1, H + math.sin(a1) * R1),
        ]
        if i == 4:
            key = pts
        else:
            voussoirs.append(pts)
    plinth = [(-1.3, -0.24), (1.3, -0.24), (1.3, -0.03), (-1.3, -0.03)]
    pier_l = [(-R2, 0), (-R1, 0), (-R1, H), (-R2, H)]
    pier_r = [(R1, 0), (R2, 0), (R2, H), (R1, H)]
    return plinth, [pier_l, pier_r] + voussoirs, key


PLINTH_PTS, BODY_PTS, KEY_PTS = outlines()
TOP = H + R2 + KEY_RISE  # highest point of the keystone


def svg_path(pts, scale, ox, oy):
    return "M" + " L".join(f"{ox + x * scale:.2f} {oy - y * scale:.2f}" for x, y in pts) + " Z"


def favicon_svg():
    size, pad = 64, 7
    scale = (size - 2 * pad) / (TOP + 0.24)
    ox, oy = size / 2, size - pad - 0.24 * scale
    body = "".join(f'<path d="{svg_path(p, scale, ox, oy)}" fill="{BONE}"/>' for p in BODY_PTS)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
        f'<rect width="{size}" height="{size}" rx="14" fill="{VOID}"/>'
        f'<path d="{svg_path(PLINTH_PTS, scale, ox, oy)}" fill="{STONE}"/>'
        f"{body}"
        f'<path d="{svg_path(KEY_PTS, scale, ox, oy)}" fill="{PURPLE_LIT}"/>'
        "</svg>\n"
    )


def draw_mark(draw, cx, base_y, height, key_color):
    scale = height / (TOP + 0.24)
    to_px = lambda pts: [(cx + x * scale, base_y - (y + 0.24) * scale) for x, y in pts]
    draw.polygon(to_px(PLINTH_PTS), fill=PLINTH)
    for p in BODY_PTS:
        draw.polygon(to_px(p), fill=BONE)
    draw.polygon(to_px(KEY_PTS), fill=key_color)


def apple_icon():
    ss = 4
    img = Image.new("RGB", (180 * ss, 180 * ss), VOID)
    draw_mark(ImageDraw.Draw(img), 90 * ss, 150 * ss, 118 * ss, PURPLE_LIT)
    return img.resize((180, 180), Image.LANCZOS)


def og_image():
    w, h, ss = 1200, 630, 2
    img = Image.new("RGB", (w * ss, h * ss), VOID)

    # A low warm glow behind the mark, like the light of the opening chapter.
    glow = Image.new("RGB", img.size, VOID)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w * ss * 0.32, h * ss * 0.02, w * ss * 0.68, h * ss * 0.62], fill="#2a1f16")
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(90 * ss)), 1.0)

    d = ImageDraw.Draw(img)
    draw_mark(d, w * ss / 2, 300 * ss, 210 * ss, PURPLE_LIT)

    title_font = ImageFont.truetype(str(PUBLIC / "fonts/Archivo-Expanded-ExtraBold.ttf"), 92 * ss)
    sub_font = ImageFont.truetype(str(PUBLIC / "fonts/Archivo-Condensed-ExtraLight.ttf"), 40 * ss)

    def centred(text, font, y, fill, tracking=0):
        widths = [d.textlength(ch, font=font) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        x = (w * ss - total) / 2
        for ch, cw in zip(text, widths):
            d.text((x, y), ch, font=font, fill=fill)
            x += cw + tracking

    centred("TRUSTED AGENT", title_font, 360 * ss, BONE, tracking=-1 * ss)
    centred("TRUST IS EARNED.", sub_font, 486 * ss, STONE, tracking=10 * ss)
    return img.resize((w, h), Image.LANCZOS)


if __name__ == "__main__":
    (PUBLIC / "favicon.svg").write_text(favicon_svg())
    apple_icon().save(PUBLIC / "apple-touch-icon.png", optimize=True)
    og_image().save(PUBLIC / "og.png", optimize=True)
    print("wrote favicon.svg, apple-touch-icon.png, og.png")
