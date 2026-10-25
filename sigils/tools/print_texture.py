"""Measure what printing and scanning did to a printed page, for the scan look.

    python tools/print_texture.py

Source: two leaves of the 1916 De Laurence reprint of the Goetia (BYU scan on
archive.org, item lesserkeyofsolom00dela, 500 ppi, leaves n34 and n45), in
witnesses/delaurence1916/. These are letterpress text pages on the paper of a
printed copy, scanned without cleaning; the 1904 plates survive only as
cleaned 100 ppi scans, which keep neither paper tone nor ink density.

Measured, at 500 ppi:
  paper      median RGB of pixels at least 12 px from ink; grain as the standard
             deviation of grey in three bands (fine: pixel - blur 2 px; mid:
             blur 2 - blur 8; coarse: blur 8 - blur 32), in the page margins
  ink        median RGB in stroke interiors (ink mask eroded by 2 px); mottle
             as the grey standard deviation there, fine (pixel - blur 1 px)
             and mid (blur 1 - blur 3 px). Near the edge this includes the
             edge blur, so mottle is also taken at least 4 px deep (mottle_deep)
  edge blur  sigma of a Gaussian-blurred step: contrast / (max gradient * sqrt(2 pi)),
             90th percentile of the gradient on Canny edges
  raggedness sub-pixel contours of the half-contrast level against the same
             contours smoothed along their length, for smoothing widths of 2
             to 10 px; the deviation grows with the width and never levels
             off, so beyond about 2 px it measures letter shape, not ink
  specks     dark components of 2 to 60 px in the margins, per square cm
  skew       rotation of the text block (row-projection variance, 0.05 deg steps)
  light      paper level on 120 px blocks away from ink, 5th to 95th percentile

Also measured, from the sheet crops against the hand encodings, how far drawn
straight lines are from straight and how much their width varies: for every
encoded line longer than 0.3 of the drawing height, grey-weighted centre and
width of the ink across it every half pixel (crossings skipped), a straight
trend removed; bending is the part on scales above 0.03 of the height.

Writes data/print_texture.json.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy.ndimage import map_coordinates, gaussian_filter1d
from skimage.measure import find_contours

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['leaf_n34.jpg', 'leaf_n45.jpg']
PPI = 500


def band_std(g, mask):
    g = g.astype(np.float32)
    b2 = cv2.GaussianBlur(g, (0, 0), 2); b8 = cv2.GaussianBlur(g, (0, 0), 8); b32 = cv2.GaussianBlur(g, (0, 0), 32)
    m = mask.astype(bool)
    return dict(fine=round(float((g - b2)[m].std()), 3), mid=round(float((b2 - b8)[m].std()), 3), coarse=round(float((b8 - b32)[m].std()), 3))


def raggedness(gf, level):
    """Deviation of sub-pixel contours from themselves smoothed, per smoothing width."""
    cs = [c for c in find_contours(gf, level) if len(c) > 120]
    out = {}
    for k in (2, 3, 4, 6, 10):
        devs = []
        for c in cs:
            d = np.r_[0, np.cumsum(np.hypot(*np.diff(c, axis=0).T))]
            if d[-1] < 60:
                continue
            t = np.arange(0, d[-1], 0.5); yy = np.interp(t, d, c[:, 0]); xx = np.interp(t, d, c[:, 1])
            r = int(6 * k); w = np.exp(-0.5 * (np.arange(-r, r + 1) / (2 * k)) ** 2); w /= w.sum()   # sigma k px at 0.5 px steps
            closed = np.hypot(*(c[0] - c[-1])) < 1.5
            if closed:
                pad = lambda a: np.r_[a[-r:], a, a[:r]]
            else:
                pad = lambda a: np.r_[np.full(r, a[0]), a, np.full(r, a[-1])]
            xs_ = np.convolve(pad(xx), w, 'valid'); ys_ = np.convolve(pad(yy), w, 'valid')
            tx = np.gradient(xs_); ty = np.gradient(ys_); n = np.hypot(tx, ty) + 1e-9
            dev = ((xx - xs_) * (-ty) + (yy - ys_) * tx) / n
            devs.append(dev if closed else dev[r:-r])
        a = np.concatenate(devs)
        out[f'smooth_{k}px'] = dict(mad=round(float(np.median(np.abs(a))), 3), rms=round(float(a.std()), 3))
    return out


def measure_page(path):
    bgr = cv2.imread(str(path))
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gfl = g.astype(np.float32)
    H, W = g.shape
    paper_level = float(np.percentile(g, 50))
    ink = g < (paper_level * 0.5)
    ink_u8 = ink.astype(np.uint8)
    far = cv2.dilate(ink_u8, np.ones((25, 25), np.uint8)) == 0           # >= 12 px from ink
    ys, xs = np.nonzero(ink)
    y0, y1 = np.percentile(ys, [0.5, 99.5]).astype(int); x0, x1 = np.percentile(xs, [0.5, 99.5]).astype(int)
    margin = np.zeros_like(far)                                           # outside the text block
    margin[60:H - 60, 60:W - 60] = True
    margin[y0 - 40:y1 + 40, x0 - 40:x1 + 40] = False
    margin &= far
    interior = cv2.erode(ink_u8, np.ones((5, 5), np.uint8)).astype(bool)
    paper_rgb = np.median(bgr[far][:, ::-1], axis=0)
    ink_rgb = np.median(bgr[interior][:, ::-1], axis=0)
    contrast = float(np.median(g[far]) - np.median(g[interior]))
    # edge blur from the steepest gradient across edges
    gf = cv2.GaussianBlur(gfl, (0, 0), 0.7)
    gx = cv2.Sobel(gf, cv2.CV_32F, 1, 0, ksize=3) / 8; gy = cv2.Sobel(gf, cv2.CV_32F, 0, 1, ksize=3) / 8
    gmax = np.percentile(np.hypot(gx, gy)[cv2.Canny(g, 40, 120) > 0], 90)
    sigma_edge = contrast / (gmax * math.sqrt(2 * math.pi))
    rag = raggedness(gf[y0:y1, x0:x1], np.median(g[interior]) + contrast / 2)
    # specks in the margins
    dark = ((g < paper_level - 40) & margin).astype(np.uint8)
    _, _, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
    areas = stats[1:, cv2.CC_STAT_AREA]
    small = areas[(areas >= 2) & (areas <= 60)]
    cm2 = margin.sum() / (PPI / 2.54) ** 2
    # skew of the text block
    best = None
    for a in np.arange(-2, 2.001, 0.05):
        M = cv2.getRotationMatrix2D((W / 2, H / 2), a, 1)
        v = cv2.warpAffine(ink_u8, M, (W, H), flags=cv2.INTER_NEAREST).sum(1).astype(float).var()
        if best is None or v > best[1]:
            best = (round(float(a), 2), v)
    # illumination across the page
    blocks = []
    for by in range(100, H - 220, 120):
        for bx in range(100, W - 220, 120):
            mm = far[by:by + 120, bx:bx + 120]
            if mm.mean() > 0.5:
                blocks.append(np.median(g[by:by + 120, bx:bx + 120][mm]))
    light = np.percentile(blocks, [5, 95])
    b1 = cv2.GaussianBlur(gfl, (0, 0), 1); b3 = cv2.GaussianBlur(gfl, (0, 0), 3)
    deep = cv2.distanceTransform(ink_u8, cv2.DIST_L2, 5) >= 4.5
    return dict(
        page=path.name, size=[W, H],
        paper_rgb=[round(float(v), 1) for v in paper_rgb], ink_rgb=[round(float(v), 1) for v in ink_rgb],
        paper_grain_grey=band_std(g, margin), ink_mottle_grey=round(float(g[interior].std()), 2),
        ink_mottle_fine=round(float((gfl - b1)[interior].std()), 2), ink_mottle_mid=round(float((b1 - b3)[interior].std()), 2),
        mottle_deep=round(float(g[deep].std()), 2), mottle_deep_fine=round(float((gfl - b1)[deep].std()), 2), deep_px=int(deep.sum()),
        contrast_grey=round(contrast, 1), edge_sigma_px=round(float(sigma_edge), 3),
        raggedness_px=rag, skew_deg=best[0], light_range_grey=round(float(light[1] - light[0]), 1),
        specks_per_cm2=round(len(small) / cm2, 3), speck_area_px_median=float(np.median(small)) if len(small) else None,
        margin_cm2=round(float(cm2), 1))


def drawn_lines():
    """Course and width of drawn straight lines on the sheet, against the encodings."""
    bend = []; resid = []; wcv = []; wcv_s = []; wmean = []
    for p in sorted((ROOT / 'encodings').glob('*.json')):
        enc = sigil.load(p)
        crop = cv2.imread(str(ROOT / 'crops' / f"{enc['id']}.png"), cv2.IMREAD_GRAYSCALE)
        if crop is None:
            continue
        dark = (255 - crop.astype(np.float32)) / 255
        ys, xs = np.nonzero(crop < 128); y0, x0 = ys.min(), xs.min(); H = ys.max() + 1 - y0
        for m in sigil.expand(enc['members']):
            if m['t'] != 'line':
                continue
            x1, y1, x2, y2 = [v * H for v in m['p']]; x1 += x0; x2 += x0; y1 += y0; y2 += y0
            Lp = math.hypot(x2 - x1, y2 - y1)
            if Lp < 0.3 * H:
                continue
            ux, uy = (x2 - x1) / Lp, (y2 - y1) / Lp; nx, ny = -uy, ux
            reach = max(4.0, enc['stroke'] * H * 1.6); tt = np.arange(-reach, reach + 1e-6, 0.25)
            cen = []; wid = []
            for s in np.arange(0.12 * Lp, 0.88 * Lp, 0.5):
                cx, cy = x1 + ux * s, y1 + uy * s
                v = map_coordinates(dark, [cy + ny * tt, cx + nx * tt], order=1, mode='constant')
                if v.sum() < 1 or v[0] > 0.3 or v[-1] > 0.3:     # another stroke crosses here
                    cen.append(np.nan); wid.append(np.nan)
                    continue
                cen.append((tt * v).sum() / v.sum()); wid.append(v.sum() * 0.25)
            cen = np.array(cen); wid = np.array(wid); ok = ~np.isnan(cen)
            if ok.mean() < 0.85 or ok.sum() < 30:
                continue
            t = np.arange(len(cen))[ok] * 0.5; c = cen[ok]; w = wid[ok]
            c = c - np.polyval(np.polyfit(t, c, 1), t)
            sm = gaussian_filter1d(c, 0.03 * H / 0.5)
            bend.append(sm / H); resid.append((c - sm) / H)
            wcv.append(w.std() / w.mean()); wcv_s.append(gaussian_filter1d(w, 0.03 * H / 0.5).std() / w.mean()); wmean.append(w.mean() / H)
    return dict(lines=len(bend), bending_rms_units=round(float(np.concatenate(bend).std()), 5),
                residual_rms_units=round(float(np.concatenate(resid).std()), 5),
                width_mean_units=round(float(np.median(wmean)), 4), width_cv=round(float(np.median(wcv)), 3),
                width_cv_above_003=round(float(np.median(wcv_s)), 3),
                note='units of drawing height; one sheet pixel is 0.0075')


def main():
    pages = [measure_page(ROOT / 'witnesses' / 'delaurence1916' / f) for f in PAGES]
    mean = lambda f: round(float(np.mean([f(p) for p in pages])), 3)
    out = dict(
        source='witnesses/delaurence1916/leaf_n34.jpg, leaf_n45.jpg (archive.org lesserkeyofsolom00dela, BYU scan, 500 ppi, fetched 2026-10-25)',
        ppi=PPI, pages=pages,
        mean={k: mean(lambda p: p[k]) for k in ('edge_sigma_px', 'specks_per_cm2', 'speck_area_px_median', 'ink_mottle_grey',
                                                 'ink_mottle_fine', 'ink_mottle_mid', 'mottle_deep', 'mottle_deep_fine',
                                                 'contrast_grey', 'skew_deg', 'light_range_grey')},
        paper_grain_grey={b: mean(lambda p: p['paper_grain_grey'][b]) for b in ('fine', 'mid', 'coarse')},
        raggedness_px={k: mean(lambda p: p['raggedness_px'][k]['mad']) for k in pages[0]['raggedness_px']},
        drawn_lines=drawn_lines())
    (ROOT / 'data' / 'print_texture.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in out.items() if k != 'pages'}, indent=1))
    for p in pages:
        print(p['page'], 'paper', p['paper_rgb'], 'ink', p['ink_rgb'])


if __name__ == '__main__':
    main()
