"""
Android's native SplashScreen API (windowSplashScreenAnimatedIcon) renders a plain PNG in
a roughly square icon-shaped slot and may crop/mask content that isn't safely centered
within that shape — our source splash-mark.png is a wide rectangle (globe icon + the
"AdventCompass" wordmark laid out side-by-side/below), so parts of it (usually the
wordmark) were getting clipped when shown natively. This script re-composites that same
artwork onto a square transparent canvas, scaled down so it sits well inside the inner
safe zone (Android's own adaptive-icon guideline is ~66% of the canvas; this uses ~55% of
the canvas width for extra margin), so the whole logo survives regardless of exactly how
Android crops/masks the icon container.
"""
from PIL import Image

SRC = "assets/splash-mark.png"
OUT = "assets/splash-mark-square.png"
CANVAS = 1024
CONTENT_WIDTH_FRACTION = 0.55

src = Image.open(SRC).convert("RGBA")
aspect = src.height / src.width  # source is wider than tall

content_w = round(CANVAS * CONTENT_WIDTH_FRACTION)
content_h = round(content_w * aspect)
resized = src.resize((content_w, content_h), Image.LANCZOS)

canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
x = (CANVAS - content_w) // 2
y = (CANVAS - content_h) // 2
canvas.paste(resized, (x, y), resized)
canvas.save(OUT)
print(f"wrote {OUT} ({CANVAS}x{CANVAS}, content {content_w}x{content_h} at ({x},{y}))")
