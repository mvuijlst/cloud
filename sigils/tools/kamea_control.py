"""Positive control for kamea tracing: Agrippa's own printed characters.

For each intelligence/spirit name printed in De occulta philosophia II.22
(1533), trace the Hebrew name on the planet's square under each reduction rule
and compare the route with the woodcut character, which is the ground truth.

Writes kamea/woodcuts/<key>.png (binarised crop), kamea/control/<key>.png
(side by side: woodcut | drop_zeros | mod | none), kamea/control_results.json.

Similarity: symmetric chamfer distance between the woodcut skeleton and the
densely sampled route, after fitting the route's bounding box to the woodcut's
under each of the 8 symmetries of the square; normalised by the woodcut's
bounding-box diagonal; lower is better. The null is the same statistic for
200 random permutations of the name's letters under the same rule.
"""
import json
import random
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kamea  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'kamea' / 'sources'

# crop rectangles in original page pixels [x0, y0, x1, y1], read from gridded thumbnails
CROPS = {
 'saturn_seal':      ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [700, 2540, 1420, 3080]),
 'agiel':            ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [1780, 2620, 2280, 3080]),
 'zazel':            ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [2720, 2580, 3320, 3080]),
 'jupiter_seal':     ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [880, 3900, 1620, 4640]),
 'iophiel':          ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [1820, 4080, 2470, 4540]),
 'hismael':          ('saturn_jupiter_p149_CXLIX_leaf171.jpg', [2620, 4040, 3280, 4640]),
 'mars_seal':        ('mars_sol_p150_CL_leaf172.jpg', [1590, 1780, 2560, 2660]),
 'graphiel':         ('mars_sol_p150_CL_leaf172.jpg', [2860, 1960, 3700, 2560]),
 'barzabel':         ('mars_sol_p150_CL_leaf172.jpg', [3700, 1780, 4360, 2660]),
 'sol_seal':         ('mars_sol_p150_CL_leaf172.jpg', [1630, 3700, 2470, 4640]),
 'nachiel':          ('mars_sol_p150_CL_leaf172.jpg', [2810, 3750, 3460, 4500]),
 'sorath':           ('mars_sol_p150_CL_leaf172.jpg', [3470, 3800, 4260, 4540]),
 'venus_seal':       ('venus_p151_CLI_leaf173.jpg', [1960, 1070, 2850, 2000]),
 'hagiel':           ('venus_p151_CLI_leaf173.jpg', [1960, 2100, 2800, 2850]),
 'kedemel':          ('venus_p151_CLI_leaf173.jpg', [2000, 3000, 2760, 3790]),
 'bne_seraphim':     ('venus_p151_CLI_leaf173.jpg', [1960, 3940, 2710, 4690]),
 'mercury_seal':     ('mercury_p152_CLII_leaf174.jpg', [3560, 1020, 4410, 1910]),
 'tiriel':           ('mercury_p152_CLII_leaf174.jpg', [3610, 1960, 4360, 2660]),
 'taphthartharath':  ('mercury_p152_CLII_leaf174.jpg', [3700, 2950, 4270, 3650]),
 'luna_seal':        ('luna_p153_CLIII_leaf175.jpg', [2430, 920, 3560, 2100]),
 'hasmodai':         ('luna_p153_CLIII_leaf175.jpg', [2620, 2150, 3510, 3040]),
 'schedbarschemoth': ('luna_p153_CLIII_leaf175.jpg', [2520, 3280, 3420, 4080]),
 'malcha':           ('luna_p153_CLIII_leaf175.jpg', [2480, 4410, 3510, 5350]),
}
NAMES = [  # key, planet, printed Latin, role
 ('agiel', 'Saturn', 'Agiel', 'Intelligentia'), ('zazel', 'Saturn', 'Zazel', 'Daemonium'),
 ('iophiel', 'Jupiter', 'Iohphiel', 'Intelligentia'), ('hismael', 'Jupiter', 'Hismael', 'Daemonium'),
 ('graphiel', 'Mars', 'Graphiel', 'Intelligentia'), ('barzabel', 'Mars', 'Barzabel', 'Daemonium'),
 ('nachiel', 'Sol', 'Nachiel', 'Intelligentia'), ('sorath', 'Sol', 'Sorath', 'Daemonium'),
 ('hagiel', 'Venus', 'Hagiel', 'Intelligentia'), ('kedemel', 'Venus', 'Kedemel', 'Daemonium'),
 ('bne_seraphim', 'Venus', 'Bne Seraphim', 'Intelligentiae'),
 ('tiriel', 'Mercury', 'Tiriel', 'Intelligentia'), ('taphthartharath', 'Mercury', 'Taphthartharath', 'Daemonium'),
 ('hasmodai', 'Luna', 'Hasmodai', 'Daemonium'), ('schedbarschemoth', 'Luna', 'Schedbarschemoth Schartathan', 'Daemonium daemoniorum'),
 ('malcha', 'Luna', 'Malcha betharsisim hed beruah schehakim', 'Intelligentia intelligentiarum'),
]
RULES = ['drop_zeros', 'mod', 'none']


def load_tables():
    d = json.loads((SRC / 'agrippa_II22_tables.json').read_text(encoding='utf-8'))
    squares = {}; names = {}
    for p in d['planets']:
        squares[p['planet']] = p['square_arabic']
        for nm in p['names']:
            names[(p['planet'], nm['latin'])] = nm
    return squares, names


def crop_woodcut(key):
    f, (x0, y0, x1, y1) = CROPS[key]
    out = ROOT / 'kamea' / 'woodcuts' / f'{key}.png'
    if out.exists():
        return cv2.imread(str(out), cv2.IMREAD_GRAYSCALE)
    page = cv2.imread(str(SRC / 'woodcuts' / f), cv2.IMREAD_GRAYSCALE)
    g = page[y0:y1, x0:x1]
    g = cv2.GaussianBlur(g, (5, 5), 0)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # drop specks and show-through: keep components with area >= 150 px
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, connectivity=8)
    keep = np.zeros_like(b)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 150:
            keep[lab == i] = 255
    ys, xs = np.nonzero(keep)
    pad = 20
    keep = keep[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
    img = 255 - keep
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), img)
    return img


def skeleton_points(img):
    m = img < 128
    sk = skeletonize(m)
    ys, xs = np.nonzero(sk)
    return np.stack([xs, ys], 1).astype(float)


def dense_route(tr, step=0.05, hairpin=0.3):
    """Densely sampled route. A segment that immediately retraces the previous one is
    offset sideways by `hairpin` cells, as the 1533 woodcuts draw retraced strokes
    (parallel lines joined at the turn) rather than overprinting them."""
    P = kamea.route_points(tr)
    if len(P) == 0:
        return np.zeros((0, 2))
    if len(P) == 1:
        return P
    segs = []
    for i, (a, b) in enumerate(zip(P[:-1], P[1:])):
        a = a.copy(); b = b.copy()
        if i > 0 and np.allclose(P[i - 1], b):  # retrace of the previous segment
            d = b - a; L = np.linalg.norm(d) + 1e-9
            nrm = np.array([-d[1], d[0]]) / L * hairpin
            a = a + nrm; b = b + nrm
        segs.append((a, b))
    out = [segs[0][0]]
    for a, b in segs:
        L = np.linalg.norm(b - a); n = max(1, int(L / step))
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.array(out)


SYMS = [lambda p: p, lambda p: p[:, ::-1], lambda p: np.stack([-p[:, 0], p[:, 1]], 1), lambda p: np.stack([p[:, 0], -p[:, 1]], 1),
        lambda p: -p, lambda p: np.stack([-p[:, 1], p[:, 0]], 1), lambda p: np.stack([p[:, 1], -p[:, 0]], 1), lambda p: -p[:, ::-1]]


def chamfer(S, T):
    """S: woodcut skeleton points (px). T: route points (square units). Returns min over 8 symmetries."""
    if len(T) < 2 or len(S) < 2:
        return 9.9, 0
    smin, smax = S.min(0), S.max(0); sdiag = float(np.linalg.norm(smax - smin)) + 1e-9
    kS = cKDTree(S)
    best = 9.9; best_k = 0
    for k, f in enumerate(SYMS):
        Tk = f(T.copy())
        tmin, tmax = Tk.min(0), Tk.max(0); tsize = tmax - tmin
        ssize = smax - smin
        scale = np.where(tsize > 1e-9, ssize / np.maximum(tsize, 1e-9), 1.0)
        # isotropic when the route is not degenerate, else anisotropic fit
        if tsize.min() > 1e-6:
            sc = float(min(scale)); Tt = (Tk - (tmin + tmax) / 2) * sc + (smin + smax) / 2
        else:
            Tt = (Tk - (tmin + tmax) / 2) * scale + (smin + smax) / 2
        d1 = kS.query(Tt)[0].mean()
        d2 = cKDTree(Tt).query(S)[0].mean()
        d = float((d1 + d2) / sdiag)
        if d < best:
            best, best_k = d, k
    return best, best_k


def main():
    squares, names = load_tables()
    rng = random.Random(20261024)
    results = []
    (ROOT / 'kamea' / 'control').mkdir(parents=True, exist_ok=True)
    for key, planet, latin, role in NAMES:
        nm = names[(planet, latin)]
        heb = nm['hebrew']
        rows = squares[planet]
        wc = crop_woodcut(key)
        S = skeleton_points(wc)
        row = dict(key=key, planet=planet, latin=latin, hebrew=heb, role=role, value_printed=nm['value_printed'],
                   gematria=nm['gematria'], n=len(rows), rules={})
        panels = []
        h = 320
        wimg = cv2.resize(wc, (int(wc.shape[1] * h / wc.shape[0]), h), interpolation=cv2.INTER_AREA)
        panels.append(cv2.cvtColor(wimg, cv2.COLOR_GRAY2BGR))
        for rule in RULES:
            tr = kamea.trace(heb, rows, 'hebrew', rule)
            T = dense_route(tr)
            d, k = chamfer(S, T)
            # null: shuffled letters
            letters = [c for c in heb if c != ' ']
            null = []
            for _ in range(200):
                rng.shuffle(letters)
                trn = kamea.trace(''.join(letters), rows, 'hebrew', rule)
                null.append(chamfer(S, dense_route(trn))[0])
            pct = float(np.mean([x < d for x in null]))  # fraction of shuffles that score better
            row['rules'][rule] = dict(route=[list(c) for c in tr['route']], reduced=[s['reduced'] for s in tr['steps']],
                                      dropped=tr['dropped'], loops=len(tr['loops']), chamfer=round(d, 4), symmetry=k,
                                      null_median=round(float(np.median(null)), 4), null_p05=round(float(np.percentile(null, 5)), 4),
                                      frac_shuffles_better=round(pct, 3))
            img = kamea.render(tr, rows, cell_px=max(24, 300 // len(rows)), route_override=dense_route(tr, hairpin=0.3))
            img = cv2.resize(img, (int(img.shape[1] * h / img.shape[0]), h), interpolation=cv2.INTER_AREA)
            cv2.putText(img, f'{rule} d={d:.3f} p={pct:.2f}', (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 200), 1)
            panels.append(img)
        sep = np.full((h, 8, 3), 180, np.uint8)
        sheet = np.hstack([x for p in panels for x in (p, sep)][:-1])
        head = np.full((26, sheet.shape[1], 3), 255, np.uint8)
        cv2.putText(head, f'{latin} ({role} {planet}) {heb[::-1]}  printed {nm["value_printed"]} gematria {nm["gematria"]}', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        cv2.imwrite(str(ROOT / 'kamea' / 'control' / f'{key}.png'), np.vstack([head, sheet]))
        results.append(row)
        print(key, {r: (row['rules'][r]['chamfer'], row['rules'][r]['frac_shuffles_better']) for r in RULES})
    for key in ('saturn_seal', 'jupiter_seal', 'mars_seal', 'sol_seal', 'venus_seal', 'mercury_seal', 'luna_seal'):
        crop_woodcut(key)
    (ROOT / 'kamea' / 'control_results.json').write_text(json.dumps(dict(
        method=__doc__, rules=RULES, scheme='hebrew (finals as ordinary letters)', null_shuffles=200, seed=20261024,
        results=results), indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
