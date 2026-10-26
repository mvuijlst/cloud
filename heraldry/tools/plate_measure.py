"""Measure an engraved armorial plate (black ink on paper): shield grid, shield outline shape, outline width,
Petra Sancta hatching pitch and line thickness, dot (or) pitch.

usage: python plate_measure.py <leaf.jpg> <out_dir> [--ppi 400] [--thr 128]
"""
import sys, json
from pathlib import Path
import numpy as np, cv2
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.measure import label as sklabel, regionprops


def period(profile, lo=3, hi=40):
    pr = profile - profile.mean()
    if pr.std() < 1e-6 or len(pr) < hi + 2:
        return None, 0.0
    ac = np.correlate(pr, pr, 'full')[len(pr) - 1:]
    ac = ac / ac[0]
    seg = ac[lo:hi]
    i = int(np.argmax(seg)) + lo
    return int(i), round(float(ac[i]), 3)


def runs(arr):
    """lengths of runs of True along axis 1 (rows) of a 2D bool array"""
    out = []
    for row in arr:
        d = np.diff(np.concatenate([[0], row.astype(int), [0]]))
        s = np.nonzero(d == 1)[0]; e = np.nonzero(d == -1)[0]
        out.extend((e - s).tolist())
    return np.array(out)


def main():
    a = sys.argv[1:]; p, out = a[0], Path(a[1]); out.mkdir(parents=True, exist_ok=True)
    ppi = float(a[a.index('--ppi') + 1]) if '--ppi' in a else 400.0
    thr = int(a[a.index('--thr') + 1]) if '--thr' in a else 128
    pxmm = ppi / 25.4
    g = cv2.imread(p, cv2.IMREAD_GRAYSCALE); H, W = g.shape
    ink = g < thr
    # shields = closed outer contours of the ink mask with shield-like size and solidity (the plate frame is far larger,
    # hatching lines and lettering far smaller). Filling each accepted contour gives its mask.
    # erode by one pixel: the thin cell rules and hatching vanish, the thick shield outlines survive and stand alone
    inkc = cv2.erode(ink.astype(np.uint8), np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(inkc, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cand = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c); area = cv2.contourArea(c)
        if w < 0.03 * W or w > 0.25 * W or h < 0.03 * H or h > 0.25 * H: continue
        if area < 0.6 * w * h or not (0.7 <= h / w <= 1.8): continue
        cand.append((x, y, w, h, area, c))
    if not cand:
        print('no shields'); return
    med = np.median([c[4] for c in cand])
    cand = [c for c in cand if 0.5 * med <= c[4] <= 1.8 * med]
    lab = np.zeros((H, W), np.int32)
    for i, (x, y, w, h, area, c) in enumerate(cand, 1):
        cv2.drawContours(lab, [c], -1, i, thickness=-1)
    props = [rp for rp in regionprops(lab)]
    vis = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    res = []
    for rp in props:
        y0, x0, y1, x1 = rp.bbox; w, h = x1 - x0, y1 - y0
        m = lab[y0:y1, x0:x1] == rp.label
        sub = ink[y0:y1, x0:x1] & m
        widths = m.sum(1).astype(float); Wmax = widths.max()
        prof = {f'{f:.2f}': round(float(widths[int(f * (h - 1))] / Wmax), 3) for f in np.arange(0.05, 1.0, 0.05)}
        # outline: ink run from the left edge at mid rows
        rl = []
        for r in range(int(0.25 * h), int(0.7 * h), 3):
            xs = np.nonzero(m[r])[0]
            if not len(xs): continue
            k = xs[0]; n = 0
            while k < w and sub[r, k]: n += 1; k += 1
            if n: rl.append(n)
        outline = float(np.median(rl)) if rl else None
        er = int(3 * (outline or 4)) | 1
        inner_m = cv2.erode(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (er, er))).astype(bool)
        inner = sub & inner_m
        ph, sh = period(inner.sum(1).astype(float)); pv, sv = period(inner.sum(0).astype(float))
        vr = runs(inner.T); hr = runs(inner)
        # dots: small isolated blobs
        lab_i = sklabel(inner, connectivity=2)
        small = [rp2 for rp2 in regionprops(lab_i) if 2 <= rp2.area <= 40 and rp2.eccentricity < 0.9]
        dots = None
        if len(small) >= 12:
            c = np.array([rp2.centroid for rp2 in small]); d, _ = cKDTree(c).query(c, k=2)
            dots = dict(n=len(small), nn_px=round(float(np.median(d[:, 1])), 1), area_px=round(float(np.median([rp2.area for rp2 in small])), 1))
        res.append(dict(bbox=[int(x0), int(y0), int(x1), int(y1)], w_px=int(w), h_px=int(h), w_mm=round(w / pxmm, 1), h_mm=round(h / pxmm, 1), H_over_W=round(h / w, 3),
                        solidity=round(float(m.sum() / (w * h)), 3), outline_px=outline, outline_mm=round(outline / pxmm, 2) if outline else None,
                        hatch_period_h_px=ph, hatch_h_strength=sh, hatch_period_v_px=pv, hatch_v_strength=sv,
                        vrun_median=float(np.median(vr)) if len(vr) else None, hrun_median=float(np.median(hr)) if len(hr) else None,
                        inner_ink_frac=round(float(inner.sum() / max(1, inner_m.sum())), 3), dots=dots, profile=prof))
        cv2.rectangle(vis, (x0, y0), (x1, y1), (0, 0, 255), 2)
    res.sort(key=lambda r: (round(r['bbox'][1] / 150), r['bbox'][0]))
    # grid pitch
    cx = np.array([(r['bbox'][0] + r['bbox'][2]) / 2 for r in res]); cy = np.array([(r['bbox'][1] + r['bbox'][3]) / 2 for r in res])
    def pitch(v):
        v = np.sort(v); d = np.diff(v); d = d[d > 20]
        return round(float(np.median(d)), 1) if len(d) else None
    rows = np.round(cy / 150); cols = np.round(cx / 150)
    px = pitch(np.array([np.median(cx[cols == c]) for c in np.unique(cols)])); py = pitch(np.array([np.median(cy[rows == r]) for r in np.unique(rows)]))
    summary = dict(page=p, size=[W, H], px_per_mm=round(pxmm, 2), n_shields=len(res), grid=dict(n_cols=int(len(np.unique(cols))), n_rows=int(len(np.unique(rows))), pitch_x_px=px, pitch_y_px=py,
                   pitch_x_mm=round(px / pxmm, 1) if px else None, pitch_y_mm=round(py / pxmm, 1) if py else None))
    def q(key):
        v = np.array([r[key] for r in res if r.get(key) is not None], float)
        return dict(n=int(len(v)), median=round(float(np.median(v)), 3), q1=round(float(np.percentile(v, 25)), 3), q3=round(float(np.percentile(v, 75)), 3)) if len(v) else None
    summary.update(w_mm=q('w_mm'), h_mm=q('h_mm'), H_over_W=q('H_over_W'), solidity=q('solidity'), outline_px=q('outline_px'), outline_mm=q('outline_mm'),
                   hatch_period_h_px=q('hatch_period_h_px'), hatch_period_v_px=q('hatch_period_v_px'), vrun_median=q('vrun_median'), hrun_median=q('hrun_median'), inner_ink_frac=q('inner_ink_frac'))
    strong_h = [r['hatch_period_h_px'] for r in res if r['hatch_h_strength'] > 0.5]; strong_v = [r['hatch_period_v_px'] for r in res if r['hatch_v_strength'] > 0.5]
    summary['hatch_period_px_where_strong'] = dict(h=dict(n=len(strong_h), median=float(np.median(strong_h)) if strong_h else None), v=dict(n=len(strong_v), median=float(np.median(strong_v)) if strong_v else None))
    dots = [r['dots']['nn_px'] for r in res if r['dots']]
    summary['dot_pitch_px'] = dict(n=len(dots), median=float(np.median(dots)) if dots else None)
    prof_keys = list(res[0]['profile'].keys()); summary['median_profile'] = {k: round(float(np.median([r['profile'][k] for r in res])), 3) for k in prof_keys}
    (out / 'plate.json').write_text(json.dumps(dict(summary=summary, shields=res), indent=1), encoding='utf-8', newline='\n')
    cv2.imwrite(str(out / 'overlay.jpg'), cv2.resize(vis, None, fx=0.5, fy=0.5), [cv2.IMWRITE_JPEG_QUALITY, 75])
    # crops of the first 8 shields at 2x for the report
    tiles = []
    for r in res[:8]:
        x0, y0, x1, y1 = r['bbox']; t = g[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4]
        tiles.append(cv2.resize(t, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
    if tiles:
        hmax = max(t.shape[0] for t in tiles); sheet = np.full((hmax, sum(t.shape[1] + 10 for t in tiles)), 255, np.uint8); x = 0
        for t in tiles:
            sheet[:t.shape[0], x:x + t.shape[1]] = t; x += t.shape[1] + 10
        cv2.imwrite(str(out / 'crops2x.png'), sheet)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
