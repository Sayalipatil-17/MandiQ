"""
captcha_local.py — Agmarknet captcha ko locally solve karo, template matching se.

KYUN: 2Captcha (paid) sirf ~25% sahi deta tha — woh `regsense=1` ignore karke sab
lowercase bhej deta hai, jabki Agmarknet case-sensitive hai. Har galat jawab = ek
naya captcha kharidna + retry. Height-based case fix se 50% hua, par ab bhi aadhe
fail.

KAISE: Agmarknet ke captcha OCR ke hisaab se aasan hain — plain Verdana text,
uniform background, na noise, na lines, na rotation, fixed baseline. To har
character ka template render karke pixel-match kar lete hain.

Measured (36 labeled glyphs, 6 captcha): 36/36 glyph, 6/6 captcha — 100%.
Instant hai aur muft — fail hone par naya captcha lene mein koi cost nahi.

Font na mile (Linux server) ya glyph count 6 na aaye to None return karta hai,
aur caller 2Captcha pe fallback kar leta hai.
"""

import os
import base64
import string
import itertools

import numpy as np

CHARS = string.ascii_letters + string.digits

# Canvas jahan sample aur template dono ko baseline pe align karke rakhte hain
_H, _W = 70, 60
_BASE_ROW = 45
_X0 = 6

# Verdana hi match karta hai (36 glyph pe test kiya: verdana 100%, segoe 53%,
# tahoma 64%, arial 69%). Font size 38 pe cap-height 28px aata hai.
_FONT_SIZE = 38
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\verdana.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Verdana.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # last resort
]

_templates = None       # {char: canvas}
_templates_failed = False


def _font_path():
    for p in _FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def _canvas(patch, top, baseline, dy=0, dx=0):
    """Glyph ko baseline-anchored canvas pe rakho (size waisi ki waisi rehti hai —
    isi se 'o' aur 'O' alag pehchaane jaate hain)."""
    h, w = patch.shape
    y0 = _BASE_ROW - (baseline - top) + dy
    x0 = _X0 + dx
    if y0 < 0 or x0 < 0 or y0 + h > _H or x0 + w > _W:
        return None
    c = np.zeros((_H, _W), np.float32)
    c[y0:y0 + h, x0:x0 + w] = patch
    return c


def _build_templates():
    """Har character ka canvas ek baar bana ke cache karo."""
    global _templates, _templates_failed
    if _templates is not None or _templates_failed:
        return _templates

    try:
        from PIL import Image, ImageDraw, ImageFont

        fp = _font_path()
        if not fp:
            _templates_failed = True
            return None

        font = ImageFont.truetype(fp, _FONT_SIZE)
        raw = {}
        for ch in CHARS:
            im = Image.new("L", (180, 180), 0)
            ImageDraw.Draw(im).text((50, 40), ch, fill=255, font=font)
            a = np.array(im).astype(np.float32) / 255.0
            ys, xs = np.where(a > 0.18)
            if len(ys) == 0:
                continue
            raw[ch] = (a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], ys.min(), ys.max())

        if "A" not in raw:
            _templates_failed = True
            return None

        baseline = raw["A"][2]          # 'A' ka bottom = template baseline
        out = {}
        for ch, (g, top, _) in raw.items():
            c = _canvas(g, top, baseline)
            if c is not None:
                out[ch] = c
        _templates = out
        return _templates
    except Exception:
        _templates_failed = True
        return None


def _glyph_boxes(bw):
    """Column projection se glyphs alag karo — background bilkul saaf hota hai."""
    cols = bw.sum(axis=0)
    out, in_glyph, start = [], False, 0
    for x, v in enumerate(cols):
        if v > 0 and not in_glyph:
            in_glyph, start = True, x
        elif v == 0 and in_glyph:
            in_glyph = False
            rows = np.where(bw[:, start:x].sum(axis=1) > 0)[0]
            if len(rows):
                out.append((start, x, rows.min(), rows.max()))
    if in_glyph:
        rows = np.where(bw[:, start:].sum(axis=1) > 0)[0]
        if len(rows):
            out.append((start, len(cols), rows.min(), rows.max()))
    return out


def solve(image_b64: str, expect_len: int = 6):
    """
    Captcha image se text nikalo. Bharosa na ho to None (caller 2Captcha use kare).
    """
    tpl = _build_templates()
    if not tpl:
        return None

    try:
        import cv2

        raw = base64.b64decode(image_b64.split(",")[-1])
        g = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)
        if g is None:
            return None

        _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
        boxes = _glyph_boxes(bw)
        if len(boxes) != expect_len:
            return None       # glyph jude hue ya toote hue — risk mat lo

        # Anti-aliasing bachaye rakho: binary se match karne par S/5 gadbad karta tha
        bg = float(np.median(g))
        ink = np.percentile(g[bw > 0], 5) if (bw > 0).any() else 0.0
        span = max(bg - ink, 1.0)
        inv = ((bg - g.astype(np.float32)) / span).clip(0.0, 1.0)

        baseline = int(np.median([b[3] for b in boxes]))
        answer = []
        for x0, x1, y0, y1 in boxes:
            patch = inv[y0:y1 + 1, x0:x1]
            best, best_score = None, float("inf")
            for dy, dx in itertools.product((-1, 0, 1), (-1, 0, 1)):
                s = _canvas(patch, y0, baseline, dy, dx)
                if s is None:
                    continue
                for ch, t in tpl.items():
                    score = float(np.mean((s - t) ** 2))
                    if score < best_score:
                        best_score, best = score, ch
            if best is None:
                return None
            answer.append(best)
        return "".join(answer)
    except Exception:
        return None
