"""Export the home pet pictures from the original artwork.

Each original is a square transparent PNG with the pet sitting on a drawn budget gauge. The app
draws that gauge itself (src/components/budget-gauge.tsx) so it can show the real remaining
budget, so this script cuts the drawn gauge off and keeps only the pet:

1. Find the gauge: the bottom rounded bar, widest at its vertical center.
2. Scale so the gauge is GAUGE_WIDTH pt wide, keeping only what is above the gauge.
3. Place the pet bottom-aligned on a CANVAS_WIDTH x CANVAS_HEIGHT pt canvas, centered on the
   gauge, so the paws touch the bottom edge and sit on the app's gauge.
4. Save 1x/2x/3x files named like the originals.

Usage (needs Pillow): python3 scripts/export-pet-images.py <originals dir> assets/images/pets
"""

import os
import sys

from PIL import Image

# Keep in sync with src/components/pet-image.tsx and src/components/budget-gauge.tsx.
GAUGE_WIDTH = 120
CANVAS_WIDTH = 124
CANVAS_HEIGHT = 96


def find_gauge(alpha):
    """Return (left, top, right, bottom) of the drawn gauge in pixels."""
    width, height = alpha.size
    px = alpha.load()
    rows = []
    for y in range(height):
        xs = [x for x in range(width) if px[x, y] > 128]
        rows.append((xs[0], xs[-1]) if xs else None)
    bottom = max(y for y, row in enumerate(rows) if row)
    zone = range(bottom - int(height * 0.18), bottom + 1)
    widths = {y: rows[y][1] - rows[y][0] for y in zone if rows[y]}
    widest = max(widths.values())
    center_rows = [y for y, w in widths.items() if w >= widest - 2]
    center = (min(center_rows) + max(center_rows)) // 2
    top = center - (bottom - center)
    left = min(rows[y][0] for y in center_rows)
    right = max(rows[y][1] for y in center_rows)
    return left, top, right, bottom


def export(src_path, dst_dir):
    image = Image.open(src_path).convert('RGBA')
    left, top, right, _ = find_gauge(image.getchannel('A'))
    name = os.path.splitext(os.path.basename(src_path))[0]
    for scale, suffix in [(1, ''), (2, '@2x'), (3, '@3x')]:
        ratio = GAUGE_WIDTH * scale / (right - left)
        canvas_w, canvas_h = CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale
        # Source window: canvas-sized, centered on the gauge, ending at the gauge's top edge.
        win_w, win_h = canvas_w / ratio, canvas_h / ratio
        center_x = (left + right) / 2
        box = (round(center_x - win_w / 2), round(top - win_h), round(center_x + win_w / 2), top)
        pet = image.crop(box).resize((canvas_w, canvas_h), Image.LANCZOS)
        pet.save(os.path.join(dst_dir, f'{name}{suffix}.png'), optimize=True)


if __name__ == '__main__':
    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    for file in sorted(os.listdir(src_dir)):
        if file.endswith('.png'):
            export(os.path.join(src_dir, file), dst_dir)
