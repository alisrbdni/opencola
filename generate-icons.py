"""Generate ColaBot extension icons at 16, 48, and 128px."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)

# ── Palette ──────────────────────────────────────────────────────────────────
BG_OUTER   = (15,  15,  19,   0)   # transparent outer
BG         = (22,  16,  52, 255)   # deep indigo
GRAD_TOP   = (90,  60, 200, 255)   # purple-violet
GRAD_BOT   = (46,  28, 110, 255)
HEAD_FILL  = (38,  28,  80, 255)
HEAD_STROKE= (124, 109, 250, 255)  # accent #7c6dfa
EYE_L      = (167, 139, 250, 255)  # soft purple
EYE_R      = (52,  211, 153, 255)  # teal / green
ANTENNA    = (124, 109, 250, 255)
ANT_TIP    = (229, 222, 255, 255)
MOUTH      = (167, 139, 250, 200)
BOLT       = (255, 220,  80, 255)  # yellow spark


def round_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                           fill=fill, outline=outline, width=width)


def make_icon(size: int) -> Image.Image:
    S = size
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad  = max(1, S // 16)
    r_bg = max(2, S // 5)

    # ── Background pill ──────────────────────────────────────────────────────
    # gradient simulation: draw multiple horizontal slices
    for y in range(pad, S - pad):
        t = (y - pad) / max(1, S - 2 * pad - 1)
        c = tuple(int(GRAD_TOP[i] * (1 - t) + GRAD_BOT[i] * t) for i in range(3)) + (255,)
        draw.line([(pad, y), (S - pad - 1, y)], fill=c)
    # mask to rounded rect
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, S - pad - 1, S - pad - 1],
                                           radius=r_bg, fill=255)
    # blend gradient into transparent base
    solid = img.copy()
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    img.paste(solid, mask=mask)
    draw = ImageDraw.Draw(img)

    # subtle border glow
    round_rect(draw, [pad, pad, S - pad - 1, S - pad - 1],
               r_bg, fill=None, outline=HEAD_STROKE,
               width=max(1, S // 48))

    if size <= 16:
        # ── Tiny 16px: just a robot face ────────────────────────────────────
        cx, cy = S // 2, S // 2
        hw = S // 3
        hh = S // 3
        round_rect(draw, [cx - hw, cy - hh + 1, cx + hw, cy + hh],
                   max(1, S // 8), fill=HEAD_FILL, outline=HEAD_STROKE, width=1)
        ew = max(1, S // 10)
        ex = S // 3
        ey = cy - 1
        draw.ellipse([cx - ex - ew, ey - ew, cx - ex + ew, ey + ew], fill=EYE_L)
        draw.ellipse([cx + ex - ew, ey - ew, cx + ex + ew, ey + ew], fill=EYE_R)
        mw = S // 5
        draw.line([cx - mw, cy + S // 6, cx + mw, cy + S // 6], fill=MOUTH, width=max(1, S // 16))
        return img

    # ── Sizes ≥ 48px ─────────────────────────────────────────────────────────
    scale = S / 128.0  # design at 128, scale down

    def sc(v):   return int(v * scale)
    def scp(x, y): return (int(x * scale), int(y * scale))

    # Antenna
    ant_x = S // 2
    ant_top = sc(12)
    ant_mid = sc(28)
    draw.line([scp(64, 28), scp(64, 14)], fill=ANTENNA, width=max(1, sc(3)))
    # Antenna ball glow
    atr = max(2, sc(6))
    atc = (ant_x, sc(12))
    for glow_r in range(atr + sc(4), atr - 1, -1):
        alpha = int(180 * (1 - (glow_r - atr) / max(1, sc(4))))
        gfill = ANT_TIP[:3] + (alpha,)
        draw.ellipse([atc[0] - glow_r, atc[1] - glow_r,
                      atc[0] + glow_r, atc[1] + glow_r], fill=gfill)

    # Head body
    hx0, hy0 = sc(22), sc(30)
    hx1, hy1 = sc(106), sc(98)
    hr = sc(16)
    round_rect(draw, [hx0, hy0, hx1, hy1], hr,
               fill=HEAD_FILL, outline=HEAD_STROKE, width=max(1, sc(2.5)))

    # Eyes — left purple, right teal
    eye_y  = sc(56)
    eye_r  = sc(10)
    eye_lx = sc(44)
    eye_rx = sc(84)

    # eye glow
    for glow, col in [(sc(6), EYE_L), (sc(6), EYE_R)]:
        for rad, col2, alpha in [
            (eye_r + glow, col, 60),
            (eye_r + glow // 2, col, 120),
        ]:
            gcol = col2[:3] + (alpha,)
            draw.ellipse([eye_lx - rad, eye_y - rad, eye_lx + rad, eye_y + rad], fill=gcol)
            draw.ellipse([eye_rx - rad, eye_y - rad, eye_rx + rad, eye_y + rad], fill=gcol)

    draw.ellipse([eye_lx - eye_r, eye_y - eye_r, eye_lx + eye_r, eye_y + eye_r], fill=EYE_L)
    draw.ellipse([eye_rx - eye_r, eye_y - eye_r, eye_rx + eye_r, eye_y + eye_r], fill=EYE_R)

    # Pupil shine
    shine_r = max(1, sc(3))
    shine_off = sc(3)
    draw.ellipse([eye_lx - shine_off - shine_r, eye_y - shine_off - shine_r,
                  eye_lx - shine_off + shine_r, eye_y - shine_off + shine_r],
                 fill=(255, 255, 255, 200))
    draw.ellipse([eye_rx - shine_off - shine_r, eye_y - shine_off - shine_r,
                  eye_rx - shine_off + shine_r, eye_y - shine_off + shine_r],
                 fill=(255, 255, 255, 200))

    # Mouth — three dots in an arc
    mouth_y = sc(82)
    mouth_dots = [sc(48), sc(64), sc(80)]
    dot_r = max(1, sc(3))
    for i, mx in enumerate(mouth_dots):
        offset = sc(2) if i == 1 else 0
        draw.ellipse([mx - dot_r, mouth_y + offset - dot_r,
                      mx + dot_r, mouth_y + offset + dot_r], fill=MOUTH)

    # Ear / side nubs
    nub_w, nub_h = sc(6), sc(16)
    nub_y = sc(52)
    nub_r = max(1, sc(3))
    draw.rounded_rectangle([hx0 - nub_w, nub_y, hx0 - 1, nub_y + nub_h],
                            radius=nub_r, fill=HEAD_STROKE)
    draw.rounded_rectangle([hx1 + 1, nub_y, hx1 + nub_w, nub_y + nub_h],
                            radius=nub_r, fill=HEAD_STROKE)

    # Lightning bolt accent (bottom right area of head)
    if S >= 48:
        bx, by = sc(88), sc(68)
        bolt_pts = [
            (bx,      by),
            (bx - sc(5), by + sc(7)),
            (bx - sc(1), by + sc(7)),
            (bx - sc(6), by + sc(14)),
            (bx + sc(3), by + sc(5)),
            (bx - sc(1), by + sc(5)),
        ]
        draw.polygon(bolt_pts, fill=BOLT)

    # Small "C" cola label on forehead band
    if S >= 128:
        band_y0, band_y1 = sc(30), sc(44)
        round_rect(draw, [hx0, band_y0, hx1, band_y1], sc(12),
                   fill=(*HEAD_STROKE[:3], 60))
        # "CB" text hint — just decorative circles on the band
        for bx in range(sc(30), sc(100), sc(8)):
            draw.ellipse([bx - sc(1), sc(36) - sc(1), bx + sc(1), sc(36) + sc(1)],
                         fill=(*ANT_TIP[:3], 100))

    # Gaussian glow pass on eyes only (applied to the full image for simplicity)
    # We skip blur to keep crisp look at all sizes.

    return img


for size in [16, 48, 128]:
    icon = make_icon(size)
    path = os.path.join(OUT, f"icon{size}.png")
    icon.save(path, "PNG")
    print(f"✓ icons/icon{size}.png ({size}x{size})")

print("Done — reload the extension in chrome://extensions")
