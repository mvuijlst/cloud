"""Coordinate worksheet for hand-encoding a crop.

Usage: worksheet.py ID [ID ...]   -> data/worksheets/ID.png

Shows the crop enlarged with a 0.1-unit grid in encoding units (bbox height =
1, y down), detected ring-like holes (red, R1..) with centre and centreline
radius, and detected straight segments (blue, L1..) with endpoints, listed in a
side panel so coordinates can be read off rather than guessed.
"""
import json
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.measure import label as sklabel, regionprops
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parents[1]
SCALE = 4


def tight(g):
    m = g < 128
    ys, xs = np.nonzero(m)
    return g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def detect(g):
    m = g < 128
    h, w = m.shape
    sk = skeletonize(m)
    dt = ndi.distance_transform_edt(m)
    stroke = float(np.median(2 * dt[sk])) if sk.any() else 4.0
    # rings: enclosed background regions, small and round
    lab = sklabel(~m, connectivity=1)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    rings = []
    for rp in regionprops(lab):
        if rp.label in border or rp.area > 900:
            continue
        per = max(rp.perimeter, 1.0); circ = 4 * np.pi * rp.area / (per * per)
        if circ < 0.55:
            continue
        cy, cx = rp.centroid
        r_hole = np.sqrt(rp.area / np.pi)
        rings.append((cx / h, cy / h, (r_hole + stroke / 2) / h))
    # straight segments: LSD on the grey crop, merged lightly, long ones only
    segs = []
    try:
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        lines = lsd.detect(g)[0]
        if lines is not None:
            for l in lines.reshape(-1, 4):
                x1, y1, x2, y2 = l
                L = np.hypot(x2 - x1, y2 - y1)
                if L >= 0.12 * h:
                    segs.append((x1 / h, y1 / h, x2 / h, y2 / h, L / h))
    except Exception as e:  # pragma: no cover
        print('LSD unavailable:', e)
    # LSD finds both edges of a stroke; merge near-parallel pairs closer than one stroke width
    merged = []
    used = [False] * len(segs)
    for i, a in enumerate(segs):
        if used[i]:
            continue
        ax, ay = a[2] - a[0], a[3] - a[1]; La = np.hypot(ax, ay)
        group = [a]; used[i] = True
        for j in range(i + 1, len(segs)):
            if used[j]:
                continue
            b = segs[j]; bx, by = b[2] - b[0], b[3] - b[1]; Lb = np.hypot(bx, by)
            cosang = abs(ax * bx + ay * by) / (La * Lb + 1e-9)
            # distance from b's midpoint to a's line
            mx, my = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            dist = abs((mx - a[0]) * ay - (my - a[1]) * ax) / (La + 1e-9)
            if cosang > 0.985 and dist < 1.3 * stroke / h:
                group.append(b); used[j] = True
        # average the group into one centreline segment
        pts = np.array([[s[0], s[1]] for s in group] + [[s[2], s[3]] for s in group])
        c = pts.mean(0); d = np.array([ax, ay]) / La
        proj = (pts - c) @ d
        p0 = c + d * proj.min(); p1 = c + d * proj.max()
        merged.append((p0[0], p0[1], p1[0], p1[1], float(np.hypot(*(p1 - p0)))))
    merged.sort(key=lambda s: -s[4])
    return stroke / h, rings, merged[:40]


def worksheet(cid, man):
    g = cv2.imread(str(ROOT / man[cid]['crop_file']), cv2.IMREAD_GRAYSCALE)
    g = tight(g)
    h, w = g.shape; aspect = w / h
    stroke, rings, segs = detect(g)
    S = SCALE; pad = 30
    big = cv2.resize(g, (w * S, h * S), interpolation=cv2.INTER_CUBIC)
    canvas = np.full((h * S + 2 * pad, w * S + 2 * pad, 3), 255, np.uint8)
    # grid
    for k in range(0, 11):
        v = k / 10.0
        yy = int(pad + v * h * S)
        if yy <= pad + h * S:
            cv2.line(canvas, (pad, yy), (pad + w * S, yy), (210, 210, 210), 1)
            cv2.putText(canvas, f'{v:.1f}', (2, yy + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (90, 90, 90), 1)
    k = 0
    while k / 10.0 <= aspect + 1e-6:
        v = k / 10.0; xx = int(pad + v * h * S)
        cv2.line(canvas, (xx, pad), (xx, pad + h * S), (210, 210, 210), 1)
        cv2.putText(canvas, f'{v:.1f}', (xx - 8, pad - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (90, 90, 90), 1)
        k += 1
    # ink
    ink = big < 160
    region = canvas[pad:pad + h * S, pad:pad + w * S]
    region[ink] = (0, 0, 0)
    # detections
    def P(x, y):
        return (int(pad + x * h * S), int(pad + y * h * S))
    lines_txt = [f'{cid}  aspect={aspect:.3f}  stroke={stroke:.3f}  (units: bbox height=1, y down)']
    for i, (cx, cy, r) in enumerate(rings, 1):
        cv2.circle(canvas, P(cx, cy), int(r * h * S), (0, 0, 255), 1)
        cv2.putText(canvas, f'R{i}', (P(cx, cy)[0] - 8, P(cx, cy)[1] + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
        lines_txt.append(f'R{i:<2d} c=[{cx:.2f},{cy:.2f}] r={r:.3f}')
    for i, (x1, y1, x2, y2, L) in enumerate(segs, 1):
        cv2.line(canvas, P(x1, y1), P(x2, y2), (255, 0, 0), 1)
        mx, my = P((x1 + x2) / 2, (y1 + y2) / 2)
        cv2.putText(canvas, f'L{i}', (mx + 3, my - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 0, 0), 1)
        lines_txt.append(f'L{i:<2d} [{x1:.2f},{y1:.2f} -> {x2:.2f},{y2:.2f}] len={L:.2f}')
    # side panel
    panel_w = 300
    rows = max(len(lines_txt), 1)
    panel = np.full((max(canvas.shape[0], 14 * rows + 20), panel_w, 3), 255, np.uint8)
    for i, t in enumerate(lines_txt):
        col = (0, 0, 255) if t.startswith('R') else (255, 0, 0) if t.startswith('L') else (0, 0, 0)
        cv2.putText(panel, t, (4, 14 + 14 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.38, col, 1)
    if panel.shape[0] > canvas.shape[0]:
        canvas = np.vstack([canvas, np.full((panel.shape[0] - canvas.shape[0], canvas.shape[1], 3), 255, np.uint8)])
    out = np.hstack([canvas, panel])
    (ROOT / 'data' / 'worksheets').mkdir(exist_ok=True, parents=True)
    cv2.imwrite(str(ROOT / 'data' / 'worksheets' / f'{cid}.png'), out)
    return dict(id=cid, aspect=round(aspect, 4), stroke=round(stroke, 4), height_px=h)


if __name__ == '__main__':
    man = {c['id']: c for c in json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))['cells']}
    for cid in sys.argv[1:]:
        print(worksheet(cid, man))
