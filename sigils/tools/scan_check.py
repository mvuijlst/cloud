"""Does a rendered scan measure like the real printed pages?

    python tools/scan_check.py <rendered png> ...

Applies one procedure to the two 1916 leaves and to each rendered scan (500 ppi,
from scan.js) and prints them side by side: paper RGB and grain (pixels at
least 12 px from ink), ink RGB and mottle 2 px inside strokes and 4 px deep,
and the blur of inked edges (method of tools/print_texture.py). Writes
data/scan_check.json.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]


def stats(bgr):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY); gf = g.astype(np.float32)
    ink = (g < np.percentile(g, 50) * 0.5).astype(np.uint8)
    far = cv2.dilate(ink, np.ones((25, 25), np.uint8)) == 0
    far[:20] = far[-20:] = False; far[:, :20] = far[:, -20:] = False
    interior = cv2.erode(ink, np.ones((5, 5), np.uint8)).astype(bool)
    deep = cv2.distanceTransform(ink, cv2.DIST_L2, 5) >= 4.5
    b2 = cv2.GaussianBlur(gf, (0, 0), 2); b8 = cv2.GaussianBlur(gf, (0, 0), 8); b32 = cv2.GaussianBlur(gf, (0, 0), 32)
    contrast = float(np.median(g[far]) - np.median(g[interior]))
    gs = cv2.GaussianBlur(gf, (0, 0), 0.7)
    gx = cv2.Sobel(gs, cv2.CV_32F, 1, 0, ksize=3) / 8; gy = cv2.Sobel(gs, cv2.CV_32F, 0, 1, ksize=3) / 8
    gmax = np.percentile(np.hypot(gx, gy)[cv2.Canny(g, 40, 120) > 0], 90)
    r = lambda v, n=1: round(float(v), n)
    return dict(paper_rgb=[r(v) for v in np.median(bgr[far][:, ::-1], axis=0)],
                ink_rgb=[r(v) for v in np.median(bgr[interior][:, ::-1], axis=0)],
                grain_fine=r((gf - b2)[far].std(), 2), grain_mid=r((b2 - b8)[far].std(), 2), grain_coarse=r((b8 - b32)[far].std(), 2),
                mottle_2px=r(g[interior].std(), 2), mottle_deep=r(g[deep].std(), 2) if deep.sum() > 50 else None,
                deep_px=int(deep.sum()), edge_sigma=r(contrast / (gmax * math.sqrt(2 * math.pi)), 3))


def main():
    rows = {}
    for f in ('leaf_n34.jpg', 'leaf_n45.jpg'):
        rows['real ' + f] = stats(cv2.imread(str(ROOT / 'witnesses' / 'delaurence1916' / f)))
    for f in sys.argv[1:]:
        rows['scan ' + Path(f).name] = stats(cv2.imread(f))
    keys = list(next(iter(rows.values())).keys())
    print(f"{'':24s}" + ''.join(f'{k:>16s}' for k in keys))
    for name, v in rows.items():
        print(f'{name:24s}' + ''.join(f'{str(v[k]):>16s}' for k in keys))
    (ROOT / 'data' / 'scan_check.json').write_text(json.dumps(rows, indent=1), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
