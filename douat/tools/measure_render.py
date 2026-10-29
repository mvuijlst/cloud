# Per-stone statistics of a top-down render, at the reference scale (155 px per stone),
# in the same bands as tiles2.py measured on the user's photo.
# python measure_render.py render.png cellPx NX NY states
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

src, cp, NX, NY, states = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
im = Image.open(src).convert('RGB')
k = 155.0 / cp
im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
a = np.asarray(im).astype(float)
L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
H, W = L.shape
c = 155.0
cx, cy = W / 2, H / 2
# corners: 0 bottom-left, 1 top-left, 2 top-right, 3 bottom-right (y down)
CORN = [(0, 1), (0, 0), (1, 0), (1, 1)]


def blur_masked(img, m, s):
    return gaussian_filter(img * m, s) / np.maximum(gaussian_filter(m, s), 1e-6)


rows = []
for j in range(NY):
    for i in range(NX):
        x0, y0 = cx + (i - NX / 2) * c, cy + (j - NY / 2) * c
        if x0 < 0 or y0 < 0 or x0 + c > W or y0 + c > H:
            continue
        st = int(states[j * NX + i])
        for kk, cc in ((0, st), (1, (st + 2) % 4)):
            C = CORN[cc]; A = CORN[(cc + 1) % 4]; B = CORN[(cc + 3) % 4]
            pts = [C, A, B]
            # inset the triangle 12 px towards its incentre
            P = np.array([[x0 + px * c, y0 + py * c] for px, py in pts])
            ctr = P.mean(0)
            r_in = c * (1 - 0.70710678)
            inc = np.array([x0 + C[0] * c, y0 + C[1] * c]) + r_in * (
                (P[1] - P[0]) / np.linalg.norm(P[1] - P[0]) + (P[2] - P[0]) / np.linalg.norm(P[2] - P[0]))
            f = (r_in - 12) / r_in
            Q = inc + (P - inc) * f
            bx0, by0 = int(Q[:, 0].min()) - 2, int(Q[:, 1].min()) - 2
            bx1, by1 = int(Q[:, 0].max()) + 3, int(Q[:, 1].max()) + 3
            mimg = Image.new('L', (bx1 - bx0, by1 - by0), 0)
            ImageDraw.Draw(mimg).polygon([(x - bx0, y - by0) for x, y in Q], fill=255)
            m = np.asarray(mimg) > 0
            tl = L[by0:by1, bx0:bx1]
            t = a[by0:by1, bx0:bx1]
            mf = m.astype(float)
            coarse = blur_masked(tl, mf, 12)
            mid = blur_masked(tl, mf, 2) - coarse
            fine = tl - blur_masked(tl, mf, 2)
            v = tl[m]
            rows.append(dict(cls='D' if kk == 0 else 'L', L=v.mean(), rgb=t[m].mean(0),
                             sd=v.std(), sd_coarse=coarse[m].std(), sd_mid=mid[m].std(), sd_fine=fine[m].std()))

for cl in 'DL':
    rs = [r for r in rows if r['cls'] == cl]
    Ls = np.array([r['L'] for r in rs])
    rgb = np.array([r['rgb'] for r in rs]).mean(0)
    print('%s n %2d  L mean %5.1f  tile-to-tile sd %4.1f  range %3.0f-%3.0f  rgb %s  within sd coarse/mid/fine %.1f %.1f %.1f' % (
        cl, len(rs), Ls.mean(), Ls.std(), Ls.min(), Ls.max(), np.round(rgb).astype(int),
        np.mean([r['sd_coarse'] for r in rs]), np.mean([r['sd_mid'] for r in rs]), np.mean([r['sd_fine'] for r in rs])))

# joint profile across vertical cell edges, as in joints2.py
prof = []
for i in range(1, NX):
    x = cx + (i - NX / 2) * c
    if x < 30 or x > W - 30:
        continue
    for y in range(0, H):
        yy = (y - cy) / c + NY / 2
        if abs(yy - round(yy)) * c < 15:
            continue
        xi = int(round(x))
        seg = L[y, xi - 6:xi + 7]
        if len(seg) < 13:
            continue
        cc = xi - 6 + int(np.argmin(seg))
        if cc - 20 < 0 or cc + 21 > W:
            continue
        prof.append(L[y, cc - 20:cc + 21])
m = np.median(np.array(prof), 0)
print('joint profile (median, 41 px):', ' '.join('%d' % v for v in m))
mn = m.min(); half = (mn + min(np.median(m[:6]), np.median(m[-6:]))) / 2
print('joint min %.0f, width below half depth %d px' % (mn, (m < half).sum()))
