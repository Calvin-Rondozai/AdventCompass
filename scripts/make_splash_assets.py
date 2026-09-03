"""
Regenerates the native splash image (assets/splash-mark-square.png) — the ONLY splash in
this app; there is no JS-rendered overlay (removed 2026-09, twice — see
project_splash_screen_state memory before re-adding one).

Composites the full wordmark artwork (assets/splash-mark.png — the globe/angels/book mark
plus the "AdventCompass" wordmark below it, already on the app's navy background) onto a
square canvas at a moderate scale with margin on every side ("not too big, not too small",
and safer against Android's adaptive-icon-style masking of `windowSplashScreenAnimatedIcon`
— see android/app/src/main/res/values/styles.xml — which can crop content sitting outside
a centered safe zone; the previous icon-only asset learned this the hard way). Both the
canvas fill and the source art's own baked-in background are the same navy
(assets/favicon.png's color), so the seam between them is invisible.

Run with `python scripts/make_splash_assets.py` from the repo root, then re-copy
assets/splash-mark-square.png over the 5
android/app/src/main/res/drawable-*dpi/splashscreen_logo.png files.
"""
from PIL import Image

SRC = "assets/splash-mark.png"
OUT = "assets/splash-mark-square.png"
CANVAS = 1024
BACKGROUND = (26, 52, 73, 255)  # sampled from assets/favicon.png — matches splash-mark.png's own bg
# Scaled by height (the source is taller than it is wide) — 0.68 leaves comfortable margin
# on every side without looking too small. Raise/lower if a real device shows it too small
# or too large.
CONTENT_HEIGHT_FRACTION = 0.68

src = Image.open(SRC).convert("RGBA")
content_h = round(CANVAS * CONTENT_HEIGHT_FRACTION)
content_w = round(content_h * src.width / src.height)
resized = src.resize((content_w, content_h), Image.LANCZOS)

canvas = Image.new("RGBA", (CANVAS, CANVAS), BACKGROUND)
x = (CANVAS - content_w) // 2
y = (CANVAS - content_h) // 2
canvas.paste(resized, (x, y), resized)
canvas.save(OUT)
print(f"wrote {OUT} ({CANVAS}x{CANVAS}, content {content_w}x{content_h} at ({x},{y}))")
