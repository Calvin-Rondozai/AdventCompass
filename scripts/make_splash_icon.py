"""
Regenerates the native splash icon (assets/splash-mark-square.png) from the app's glyph
(assets/icon-adaptive-fg.png — the transparent-background globe/angels/book mark, same
art as assets/favicon.png). There is no JS-rendered splash anymore (removed 2026-09) —
only the native OS splash (android/app/src/main/res/values/styles.xml
windowSplashScreenAnimatedIcon) shows this image, so it's the only asset this produces.

Run with `python scripts/make_splash_icon.py` from the repo root, then re-copy the output
over the 5 `android/app/src/main/res/drawable-*dpi/splashscreen_logo.png` files.
"""
from PIL import Image

GLYPH_SRC = "assets/icon-adaptive-fg.png"
SQUARE_OUT = "assets/splash-mark-square.png"

CANVAS = 1024
# Bumped from 0.72 to 0.85 on request for a bigger native icon — Android's own
# adaptive-icon safe-zone guideline is ~66%, so this is deliberately outside it in favor
# of visibility; dial back down if cropping shows up on a real device.
CONTENT_WIDTH_FRACTION = 0.85

glyph = Image.open(GLYPH_SRC).convert("RGBA")
glyph = glyph.crop(glyph.getbbox())

content_w = round(CANVAS * CONTENT_WIDTH_FRACTION)
content_h = round(content_w * glyph.height / glyph.width)
glyph_resized = glyph.resize((content_w, content_h), Image.LANCZOS)

square = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
x = (CANVAS - content_w) // 2
y = (CANVAS - content_h) // 2
square.paste(glyph_resized, (x, y), glyph_resized)
square.save(SQUARE_OUT)
print(f"wrote {SQUARE_OUT} ({CANVAS}x{CANVAS}, glyph {content_w}x{content_h} at ({x},{y}))")
