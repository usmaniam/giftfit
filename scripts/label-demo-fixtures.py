#!/usr/bin/env python3
"""Stamps a visible label onto demo previews so they can never be mistaken for real YouCam renders.

Reads the clean images in fixtures/demo-src/ and writes fixtures/demo/ (what the app serves in DEMO_MODE).
sample-person.jpg is the demo recipient's selfie, so it is copied unchanged.
Run after replacing images in fixtures/demo-src/:  python3 scripts/label-demo-fixtures.py   (needs Pillow)
"""
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'fixtures/demo-src', ROOT / 'fixtures/demo'
LABEL = 'DEMO PREVIEW · AI-generated, not a real render'

def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', 'DejaVuSans-Bold.ttf', 'arial.ttf'):
        try: return ImageFont.truetype(p, size)
        except OSError: continue
    return ImageFont.load_default()

OUT.mkdir(exist_ok=True)
for src in sorted(SRC.glob('*.jpg')):
    if src.stem == 'sample-person':
        shutil.copyfile(src, OUT / src.name); continue
    im = Image.open(src).convert('RGB')
    w, h = im.size
    d = ImageDraw.Draw(im, 'RGBA')
    size = max(8, w // 20)
    while size > 8 and d.textlength(LABEL, font=font(size)) > w - 16: size -= 1   # fit one line to the width
    strip = size + 14
    d.rectangle((0, h - strip, w, h), fill=(31, 22, 51, 225))                     # thin full-width strip: keeps faces and products clear
    d.text((w / 2, h - strip / 2), LABEL, font=font(size), fill='white', anchor='mm')
    im.save(OUT / src.name, quality=92)
print(f'Wrote {len(list(OUT.glob("*.jpg")))} files to {OUT}')
