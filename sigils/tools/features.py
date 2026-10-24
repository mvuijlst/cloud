"""Per-drawing measurements for the 80 crops listed in data/crop_manifest.json.

Writes data/features.csv (one row per drawing) and data/features_summary.json.
Every number in FINDINGS.md that describes the corpus comes from these files.

Measured on each crop (grey PNG, ink dark):
  width_px, height_px, aspect           tight bbox of ink at threshold 128
  ink_fraction                          ink pixels / bbox area at 128
  components_t96/t128/t160              8-connected components, area >= 2 px
  holes                                 background regions enclosed by ink (4-connected), at 128
  rings                                 holes with area <= RING_AREA and circularity >= 0.6
  stroke_width_px                       median 2*distance-transform on skeleton
  endpoints, junctions                  on the skeleton (junction pixel clusters merged)
  cycle_rank                            independent cycles of the skeleton graph (= skeleton holes)
  skeleton_len_px                       skeleton pixel count
  orient_h/d1/v/d2                      fraction of skeleton length near 0/45/90/135 degrees
  branch_straightness                   length-weighted mean chord/path over skeleton branches
  sym_lr, sym_tb, sym_rot180            best IoU of dilated mask with its mirror over +-3 px shifts
"""
import csv
import json
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
from skimage.measure import label as sklabel, regionprops, euler_number

ROOT = Path(__file__).resolve().parents[1]
RING_AREA = 400  # px^2, holes larger than this are enclosures, not ring terminals
THRESHOLDS = (96, 128, 160)


def components(mask, min_area=2):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    return int((stats[1:, cv2.CC_STAT_AREA] >= min_area).sum())


def holes_and_rings(mask):
    bg = ~mask
    lab = sklabel(bg, connectivity=1)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    holes = 0; rings = 0; enclosures = 0
    for rp in regionprops(lab):
        if rp.label in border:
            continue
        holes += 1
        per = max(rp.perimeter, 1.0)
        circ = 4 * np.pi * rp.area / (per * per)
        if rp.area <= RING_AREA and circ >= 0.6:
            rings += 1
        elif rp.area > RING_AREA:
            enclosures += 1
    return holes, rings, enclosures


def skeleton_stats(mask):
    sk = skeletonize(mask)
    n_sk = int(sk.sum())
    if n_sk == 0:
        return dict(skeleton_len_px=0, endpoints=0, junctions=0, cycle_rank=0,
                    orient_h=0, orient_d1=0, orient_v=0, orient_d2=0, branch_straightness=0, stroke_width_px=0)
    k = np.ones((3, 3), int); k[1, 1] = 0
    nb = ndi.convolve(sk.astype(int), k, mode='constant') * sk
    endpoints = int((nb == 1).sum())
    jpix = nb >= 3
    jlab, nj = ndi.label(jpix, structure=np.ones((3, 3)))
    junctions = int(nj)
    _, comps = ndi.label(sk, structure=np.ones((3, 3)))
    eul = euler_number(sk, connectivity=2)
    cycle_rank = int(comps - eul)
    # stroke width
    dt = ndi.distance_transform_edt(mask)
    stroke_w = float(np.median(2 * dt[sk]))
    # local orientation by PCA in 7x7 window
    ys, xs = np.nonzero(sk)
    pts = np.stack([xs, ys], 1).astype(float)
    H, W = sk.shape
    angs = []
    for (x, y) in pts:
        x0, x1 = int(max(0, x - 3)), int(min(W, x + 4)); y0, y1 = int(max(0, y - 3)), int(min(H, y + 4))
        wy, wx = np.nonzero(sk[y0:y1, x0:x1])
        if len(wx) < 3:
            angs.append(np.nan); continue
        c = np.cov(np.stack([wx, wy]))
        evals, evecs = np.linalg.eigh(c)
        v = evecs[:, -1]
        angs.append(np.degrees(np.arctan2(v[1], v[0])) % 180.0)
    angs = np.array(angs); angs = angs[~np.isnan(angs)]
    def frac(center):
        d = np.abs(((angs - center) + 90) % 180 - 90)
        return float((d < 22.5).mean()) if len(angs) else 0.0
    # branches: skeleton minus junction pixels
    br = sk & ~ndi.binary_dilation(jpix, structure=np.ones((3, 3)))
    blab, nb_br = ndi.label(br, structure=np.ones((3, 3)))
    tot = 0.0; acc = 0.0
    for i in range(1, nb_br + 1):
        by, bx = np.nonzero(blab == i)
        L = len(bx)
        if L < 8:
            continue
        # chord: farthest pair approximated by extreme projections on principal axis
        p = np.stack([bx, by], 1).astype(float)
        c = p - p.mean(0)
        if len(p) > 2:
            _, _, vt = np.linalg.svd(c, full_matrices=False)
            proj = c @ vt[0]
            chord = float(proj.max() - proj.min())
        else:
            chord = float(L)
        acc += L * min(1.0, chord / L); tot += L
    straight = float(acc / tot) if tot else 0.0
    return dict(skeleton_len_px=n_sk, endpoints=endpoints, junctions=junctions, cycle_rank=cycle_rank,
                orient_h=round(frac(0), 4), orient_d1=round(frac(45), 4), orient_v=round(frac(90), 4), orient_d2=round(frac(135), 4),
                branch_straightness=round(straight, 4), stroke_width_px=round(stroke_w, 2))


def best_iou(a, b, shifts=3):
    best = 0.0
    for dy in range(-shifts, shifts + 1):
        for dx in range(-shifts, shifts + 1):
            bb = np.roll(np.roll(b, dy, 0), dx, 1)
            inter = np.logical_and(a, bb).sum(); uni = np.logical_or(a, bb).sum()
            if uni:
                best = max(best, inter / uni)
    return round(float(best), 4)


def symmetry(mask, stroke_w):
    r = max(1, int(round(stroke_w / 2)))
    d = ndi.binary_dilation(mask, structure=np.ones((2 * r + 1, 2 * r + 1)))
    return dict(sym_lr=best_iou(d, d[:, ::-1]), sym_tb=best_iou(d, d[::-1, :]), sym_rot180=best_iou(d, d[::-1, ::-1]))


def measure(path):
    g = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    m = g < 128
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    g = g[y0:y1, x0:x1]; m = g < 128
    h, w = m.shape
    out = dict(width_px=int(w), height_px=int(h), aspect=round(w / h, 4), ink_fraction=round(float(m.mean()), 4))
    for t in THRESHOLDS:
        out[f'components_t{t}'] = components(g < t)
    holes, rings, enclosures = holes_and_rings(m)
    out.update(holes=holes, rings=rings, enclosures=enclosures)
    out.update(skeleton_stats(m))
    out.update(symmetry(m, out['stroke_width_px']))
    return out


def main():
    man = json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))
    rows = []
    for c in man['cells']:
        f = measure(ROOT / c['crop_file'])
        rows.append(dict(id=c['id'], identity=c['identity'], variant=c['variant'], **f))
        print(c['id'], f['width_px'], f['height_px'], 'ink', f['ink_fraction'], 'comp', f['components_t128'],
              'rings', f['rings'], 'end', f['endpoints'], 'junc', f['junctions'], 'cyc', f['cycle_rank'], 'symlr', f['sym_lr'])
    keys = list(rows[0].keys())
    with open(ROOT / 'data' / 'features.csv', 'w', newline='\n', encoding='utf-8') as fh:
        wr = csv.DictWriter(fh, fieldnames=keys); wr.writeheader(); wr.writerows(rows)
    # summary: per drawing and identity-weighted (each variant weighs 1/n_variants)
    import collections
    nvar = collections.Counter(r['identity'] for r in rows)
    wts = np.array([1.0 / nvar[r['identity']] for r in rows])
    summ = {}
    for k in keys[3:]:
        v = np.array([r[k] for r in rows], float)
        order = np.argsort(v); cw = np.cumsum(wts[order]) / wts.sum()
        wmed = float(v[order][np.searchsorted(cw, 0.5)])
        summ[k] = dict(min=float(v.min()), q1=float(np.percentile(v, 25)), median=float(np.median(v)),
                       q3=float(np.percentile(v, 75)), max=float(v.max()), identity_weighted_median=wmed)
    meta = dict(n_drawings=len(rows), n_identities=len(nvar), thresholds=list(THRESHOLDS), ring_area_max_px2=RING_AREA,
                connectivity='8 for ink components and skeleton, 4 for holes', min_component_area_px=2,
                symmetry='IoU of mask dilated by half stroke width against its mirror, best over +-3 px shifts',
                orientation='local PCA in 7x7 window on skeleton, bins +-22.5 degrees around 0/45/90/135')
    (ROOT / 'data' / 'features_summary.json').write_text(json.dumps(dict(meta=meta, summary=summ), indent=1), encoding='utf-8', newline='\n')
    print('wrote', len(rows), 'rows')


if __name__ == '__main__':
    main()
