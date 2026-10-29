# Per-stone statistics of a top-down photograph of a square-stone floor, in the same
# bands as measure_render.py, so a render can be checked against a real floor.
#   python measure_photo.py photo.jpg 96,247,407,559,713 83,243,401,553,712
# The two lists are the pixel positions of the vertical and horizontal joints
# (find them by eye, or from the column/row minima of the luminance).
# Stones darker than L=130 count as dark. Rescale the photo first if its stones
# are not about 155 px across: the bands below are in pixels.
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

path, xs, ys = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], [int(v) for v in sys.argv[3].split(',')]
a = np.asarray(Image.open(path).convert('RGB')).astype(float)
L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
H, W = L.shape
bx = [0] + xs + [W]
by = [0] + ys + [H]
rows = []
for j in range(len(by) - 1):
    for i in range(len(bx) - 1):
        x0, x1, y0, y1 = bx[i], bx[i + 1], by[j], by[j + 1]
        if x1 - x0 < 120 or y1 - y0 < 120:
            continue          # stones cut by the frame edge
        m = 12
        t = a[y0 + m:y1 - m, x0 + m:x1 - m]
        tl = L[y0 + m:y1 - m, x0 + m:x1 - m]
        coarse = gaussian_filter(tl, 12)
        rows.append(dict(cls='D' if tl.mean() < 130 else 'L', L=tl.mean(), rgb=t.reshape(-1, 3).mean(0),
                         c=coarse.std(), mid=(gaussian_filter(tl, 2) - coarse).std(),
                         fine=(tl - gaussian_filter(tl, 2)).std()))
for cl in 'DL':
    rs = [r for r in rows if r['cls'] == cl]
    if not rs:
        continue
    Ls = np.array([r['L'] for r in rs])
    print('%s n %2d  L mean %5.1f  tile-to-tile sd %4.1f  rgb %s  within sd coarse/mid/fine %.1f %.1f %.1f' % (
        cl, len(rs), Ls.mean(), Ls.std(), np.round(np.mean([r['rgb'] for r in rs], 0)).astype(int),
        np.mean([r['c'] for r in rs]), np.mean([r['mid'] for r in rs]), np.mean([r['fine'] for r in rs])))

# joint profile across the vertical joints, aligned on each row's darkest pixel
prof = []
for xj in xs:
    for y in range(H):
        if any(abs(y - yy) < 15 for yy in ys) or xj - 26 < 0 or xj + 27 > W:
            continue
        c = xj - 6 + int(np.argmin(L[y, xj - 6:xj + 7]))
        prof.append(L[y, c - 20:c + 21])
m = np.median(np.array(prof), 0)
print('joint profile (median, 41 px):', ' '.join('%d' % v for v in m))
half = (m.min() + min(np.median(m[:6]), np.median(m[-6:]))) / 2
print('joint min %.0f, width below half depth %d px' % (m.min(), (m < half).sum()))
