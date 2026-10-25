"""Measure the ink of the 1904 plates from good scans, using the frame rings as a ruler.

    python tools/plate_ink.py [png ...]

Inputs (default): witnesses/plate_examples/, the user's two examples: Asmoday
from fromoldbooks.org (about 600 px across) and a scan of four plates
(Haagenti, Sitri, Buer, Beleth; about 600 px each). Each plate sits in a
double ring with the name lettered between the outer pair and an inner circle;
the circles were meant to be perfect, so their departures measure the hand and
the printing.

Per plate: centre from the bounding box of the largest ink component (the
outer ring), then 1440 rays outward, grey sampled every 0.25 px, ink below 128
with crossings interpolated. Ring radii are the peaks of the histogram of run
centres. For each ring and angle: centre radius and width of the run (runs that
merge with letters or the figure are dropped). Per ring:
  shape     first and second harmonics of radius removed (centre offset,
            ellipse); residual RMS and its correlation length along the arc
  width     mean, coefficient of variation, correlation length
  edges     each edge's deviation from the run's own smoothed edge (Gaussian
            over 1% of the circumference): fine raggedness
Also: ring radii as fractions of the outer radius, letter height and position
(components in the band between the rings), the figure's stroke width (median
2 x distance transform on its skeleton), extent and reach (99.5th percentile
of the distance of its ink from the centre) inside the inner circle,
and specks (ink components under 0.05% of R^2 not touching anything).
Lengths are given as fractions of the outer ring radius R.

Writes data/plate_ink.json.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy.ndimage import map_coordinates, gaussian_filter1d
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parents[1]
NRAY = 1440


def corr_len(v):
    v = v - v.mean()
    if v.std() == 0:
        return None
    ac = np.correlate(v, v, 'full')[len(v) - 1:]; ac /= ac[0]
    below = np.nonzero(ac < 1 / math.e)[0]
    return int(below[0]) if len(below) else None


def plates(path):
    g = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if 'haagenti' in path.name:      # 2 x 2 sheet: split at the white gutters
        H, W = g.shape
        ink = g < 128
        rows = ink.sum(1); cols = ink.sum(0)
        my = H // 4 + int(np.argmin(rows[H // 4: 3 * H // 4])); mx = W // 4 + int(np.argmin(cols[W // 4: 3 * W // 4]))
        names = ['haagenti', 'sitri', 'buer', 'beleth']
        boxes = [(0, my, 0, mx), (0, my, mx, W), (my, H, 0, mx), (my, H, mx, W)]
        return [(n, g[a:b, c:d]) for n, (a, b, c, d) in zip(names, boxes)]
    return [(path.stem.split('_')[0], g)]


def outer_circle(gf, ink):
    """Centre and radius of the outer ring: a robust circle fit to the outermost
    ink on rays from the centre of mass, refined twice."""
    H, W = gf.shape
    cx, cy = (W - 1) / 2, (H - 1) / 2
    for it in range(3):
        rmax = 0.5 * math.hypot(W, H)          # past the edges: outside counts as paper
        rr = np.arange(rmax, 0, -0.5)
        pts = []
        for k in range(720):
            th = 2 * math.pi * k / 720
            v = map_coordinates(gf, [cy + rr * math.sin(th), cx + rr * math.cos(th)], order=1, mode='constant', cval=255)
            hit = np.nonzero(v < 128)[0]
            if len(hit):
                r = rr[hit[0]]; pts.append((cx + r * math.cos(th), cy + r * math.sin(th)))
        pts = np.array(pts)
        keep = np.ones(len(pts), bool)
        for _ in range(4):        # Kasa fit, dropping points off the circle (numbers, watermark)
            x, y = pts[keep, 0], pts[keep, 1]
            A = np.stack([x, y, np.ones_like(x)], 1); bb = x * x + y * y
            c, *_ = np.linalg.lstsq(A, bb, rcond=None)
            cx, cy = c[0] / 2, c[1] / 2; R = math.sqrt(c[2] + cx * cx + cy * cy)
            d = np.abs(np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) - R)
            keep = d < max(2.0, 3 * np.median(d[keep]))
    return cx, cy, R


def measure(name, g):
    ink = (g < 128).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    big = -1
    gf = g.astype(np.float32)
    cx, cy, rfit = outer_circle(gf, ink)
    rmax = rfit + 6
    rr = np.arange(0, rmax, 0.25)
    runs = []          # (angle index, r_start, r_end)
    for k in range(NRAY):
        th = 2 * math.pi * k / NRAY
        v = map_coordinates(gf, [cy + rr * math.sin(th), cx + rr * math.cos(th)], order=1, mode='constant', cval=255)
        d = v < 128
        edges = np.nonzero(np.diff(d.astype(np.int8)))[0]
        st = None
        for e in edges:
            # interpolate the crossing of 128 between samples e and e+1
            t = (128 - v[e]) / (v[e + 1] - v[e]) if v[e + 1] != v[e] else 0.5
            re = rr[e] + t * 0.25
            if not d[e]:
                st = re
            elif st is not None:
                runs.append((k, st, re)); st = None
    runs = np.array(runs)
    centres = (runs[:, 1] + runs[:, 2]) / 2
    # ring radii: peaks of the run-centre histogram (summed over 5 px) found at most angles
    hist, be = np.histogram(centres, bins=np.arange(0, rmax, 1.0))
    hist = np.convolve(hist, np.ones(5), 'same')
    peaks = []
    for i in np.argsort(hist)[::-1]:
        if hist[i] < 0.5 * NRAY:
            break
        r = be[i] + 0.5
        if r > 0.6 * rfit and all(abs(r - p) > 4 for p in peaks):     # frame rings only
            peaks.append(r)
    peaks = sorted(peaks)
    R = peaks[-1]
    rings = []
    for pr in peaks:
        sel = runs[np.abs(centres - pr) < 3.5]
        rc = np.full(NRAY, np.nan); wd = np.full(NRAY, np.nan); ei = np.full(NRAY, np.nan); eo = np.full(NRAY, np.nan)
        for k, a, b in sel:
            k = int(k)
            if np.isnan(rc[k]) or abs((a + b) / 2 - pr) < abs(rc[k] - pr):
                rc[k] = (a + b) / 2; wd[k] = b - a; ei[k] = a; eo[k] = b
        med = np.nanmedian(wd)
        bad = np.isnan(wd) | (wd > 2.0 * med) | (wd < 0.3 * med)
        ok = ~bad
        th = 2 * np.pi * np.arange(NRAY) / NRAY
        A = np.stack([np.ones(NRAY), np.cos(th), np.sin(th), np.cos(2 * th), np.sin(2 * th)], 1)
        coef, *_ = np.linalg.lstsq(A[ok], rc[ok], rcond=None)
        resid = rc - A @ coef
        # fill short gaps for the correlation lengths
        idx = np.arange(NRAY)
        f = lambda v: np.interp(idx, idx[ok], v[ok], period=NRAY)
        res_f = f(resid); wd_f = f(wd)
        step = 2 * math.pi * pr / NRAY        # arc length per ray, px
        sm = max(1.0, 0.01 * 2 * math.pi * pr / step)
        rag = []
        for e in (ei, eo):
            ef = f(e - A @ coef)
            rag.append((ef - gaussian_filter1d(ef, sm, mode='wrap'))[ok])
        rag = np.concatenate(rag)
        rings.append(dict(
            radius=round(pr / R, 4), coverage=round(float(ok.mean()), 3),
            ellipticity=round(float(math.hypot(coef[3], coef[4]) / coef[0]), 4),
            wobble_rms=round(float(resid[ok].std() / R), 5), wobble_corr=round(corr_len(res_f) * step / R, 4) if corr_len(res_f) else None,
            width=round(float(np.mean(wd[ok]) / R), 5), width_cv=round(float(wd[ok].std() / wd[ok].mean()), 4),
            width_corr=round(corr_len(wd_f) * step / R, 4) if corr_len(wd_f) else None,
            edge_rag_rms=round(float(rag.std() / R), 5), edge_rag_px=round(float(rag.std()), 3),
            width_px=round(float(np.mean(wd[ok])), 2)))
    # figure inside the inner ring, letters between inner ring and outer pair
    inner = rings[0]['radius'] * R - rings[0]['width'] * R
    yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
    rad = np.hypot(xx - cx, yy - cy)
    fig = ink.astype(bool) & (rad < inner - 1)
    sk = skeletonize(fig)
    from scipy import ndimage as ndi
    dt = ndi.distance_transform_edt(fig)
    fys, fxs = np.nonzero(fig)
    band_lo = rings[0]['radius'] * R + rings[0]['width'] * R; band_hi = rings[-2]['radius'] * R - rings[-2]['width'] * R if len(rings) > 2 else rings[-1]['radius'] * R * 0.95
    letters = []
    for i in range(1, n):
        a = stats[i, cv2.CC_STAT_AREA]
        if a < 20 or i == big:
            continue
        m = lab == i
        rr_ = rad[m]
        if rr_.min() > band_lo and rr_.max() < band_hi:
            letters.append((rr_.max() - rr_.min(), rr_.mean()))
    specks = sum(1 for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] < 0.0005 * R * R and stats[i, cv2.CC_STAT_AREA] >= 2)
    fh = (fys.max() - fys.min() + 1) / R; fw = (fxs.max() - fxs.min() + 1) / R
    return dict(name=name, R_px=round(float(R), 1), rings=rings,
                figure=dict(stroke=round(float(np.median(2 * dt[sk])) / R, 5), stroke_px=round(float(np.median(2 * dt[sk])), 2),
                            height=round(float(fh), 4), width=round(float(fw), 4),
                            half_diagonal=round(float(math.hypot(fh, fw) / 2), 4), inner_radius=round(float(inner / R), 4),
                            max_radius=round(float(np.percentile(rad[fig], 99.5) / R), 4)),
                letters=dict(n=len(letters), height=round(float(np.median([l[0] for l in letters]) / R), 4) if letters else None,
                             radius=round(float(np.median([l[1] for l in letters]) / R), 4) if letters else None),
                specks=specks)


def main():
    files = [Path(f) for f in sys.argv[1:]] or sorted((ROOT / 'witnesses' / 'plate_examples').glob('*.*'))
    out = []
    for f in files:
        for name, g in plates(f):
            out.append(measure(name, g))
    for p in out:
        r = p['rings']
        print(p['name'], 'R', p['R_px'], 'rings', [x['radius'] for x in r], '| figure stroke', p['figure']['stroke'], 'half-diag', p['figure']['half_diagonal'],
              '| letters', p['letters'], 'specks', p['specks'])
        for x in r:
            print('   ring %.3f  wobble %.5f R (corr %s R)  width %.4f R cv %.3f (corr %s R)  edge rag %.5f R (%.2f px)  ellipt %.4f  cover %.2f' % (
                x['radius'], x['wobble_rms'], x['wobble_corr'], x['width'], x['width_cv'], x['width_corr'], x['edge_rag_rms'], x['edge_rag_px'], x['ellipticity'], x['coverage']))
    if not sys.argv[1:]:
        (ROOT / 'data' / 'plate_ink.json').write_text(json.dumps(dict(source='witnesses/plate_examples/ (user-supplied, 25 Oct 2026)', plates=out), indent=1), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
