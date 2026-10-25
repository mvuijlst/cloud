"""Generate Goetic-style seals as encodings in vocabulary 1.0.

    python tools/generate.py <out folder> [--seed N] [--n 72]

Every seal is built by one of six construction grammars, one per family on the
sheet (axial, comb, bowl, compartment, radial, cursive), drawn in the sheet's
proportions (data/families_by_eye.json: 16, 10, 11, 22, 6, 7 of 72). The parts
and their frequencies come from the hand encodings (data/encoding_stats.json):
stroke width, aspect, ring radius, cross half-arm, triangle size, what sits at
a free line end, how often a seal is mirrored and how often it repeats a group.
A seal grows until its primitive count reaches a target drawn from the
encodings of its family. A raster of what is already drawn keeps new parts
from colliding with old ones except where they are meant to join.

Output members are only those of encodings/VOCABULARY.md 1.0; there are no
escapes. Coordinates are normalised to the encoding convention (tight ink box
of height 1).
"""
import json
import math
import random
import sys
from pathlib import Path
import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
STATS = json.loads((ROOT / 'data' / 'encoding_stats.json').read_text(encoding='utf-8'))
PER = STATS['per_encoding']
FAMILY_COUNTS = {'axial': 16, 'comb': 10, 'bowl': 11, 'compartment': 22, 'radial': 6, 'cursive': 7}
R = 160            # occupancy raster, pixels per unit height
MARGIN = 0.12      # occupancy canvas margin around the design box, units


# ---------- small geometry ----------

def unit(a):
    t = math.radians(a)
    return (math.cos(t), math.sin(t))


def ang(u):
    return math.degrees(math.atan2(u[1], u[0]))


def add(p, u, k=1.0):
    return (p[0] + u[0] * k, p[1] + u[1] * k)


def perp(u):
    return (-u[1], u[0])


def rnd(v, n=4):
    if isinstance(v, (list, tuple, np.ndarray)):
        return [rnd(x, n) for x in v]
    return round(float(v), n)


def L(p, q):
    return {'t': 'line', 'p': rnd([p[0], p[1], q[0], q[1]])}


def tri(pts, fill=True):
    """A triangle; unfilled ones are closed plines, because sigil.py renders an
    unfilled tri as an open two-stroke polyline."""
    if fill:
        return {'t': 'tri', 'p': rnd(pts)}
    return {'t': 'pline', 'p': rnd(pts), 'closed': True}


def reflect_pt(p, ax):
    return (2 * ax - p[0], p[1])


def empirical(rng, key, lo=None, hi=None, jitter=0.0):
    """A value drawn from the encodings' per-seal distribution of key."""
    v = float(rng.choice(PER)[key]) * (1 + rng.uniform(-jitter, jitter))
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def q_draw(rng, key):
    """Draw from a quantile summary in STATS by piecewise-linear inverse CDF."""
    q = STATS[key]
    xs = [0.0, 0.10, 0.25, 0.5, 0.75, 0.90, 1.0]
    lo = q['q10'] - (q['q25'] - q['q10']) * 0.6
    hi = q['q90'] + (q['q90'] - q['q75']) * 0.6
    ys = [lo, q['q10'], q['q25'], q['median'], q['q75'], q['q90'], hi]
    return float(np.interp(rng.random(), xs, ys))


# ---------- the canvas: members, symmetry, occupancy, sockets ----------

class Canvas:
    def __init__(self, rng, aspect, stroke, mirror):
        self.rng = rng; self.A = aspect; self.s = stroke
        self.ax = aspect / 2 if mirror else None
        self.mirror_at = self.ax          # kept when ax is cleared for one-sided extras
        self.pad = int(MARGIN * R)
        self.W = int(round(aspect * R)) + 2 * self.pad; self.H = R + 2 * self.pad
        self.occ = np.zeros((self.H, self.W), bool)
        self.center = []; self.side = []
        self.sockets = []          # dicts: p, u, group
        self.rails = []            # horizontal lines usable for pendants: (x0, x1, y, group)
        self.posts = []            # vertical lines usable for spurs: (x, y0, y1, group)
        self.count = 0; self.floating = 0; self.log = []
        # occupancy and clearance in pixels
        self.clear = max(2, int(round(0.7 * stroke * R)))
        self.kclear = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * self.clear + 1,) * 2)

    # raster of a member list (expanded), in canvas pixels
    def raster(self, members):
        enc = {'aspect': self.A, 'stroke': self.s, 'members': members}
        img = sigil._render(enc, R, self.pad, 255, 0, False, cv2.LINE_8)
        return img > 0

    def px(self, p):
        return (int(round(p[0] * R + self.pad)), int(round(p[1] * R + self.pad)))

    def full(self, members, group):
        if group == 'side' and self.ax is not None:
            return [{'t': 'mirror', 'axis': 'x', 'at': rnd(self.ax), 'm': members}]
        return members

    def fits(self, members, group, contacts=(), slack=0):
        m = self.raster(members)
        if not m.any():
            return False
        # inside the design box
        tol = int(0.01 * R)
        box = np.zeros_like(m); box[self.pad - tol:self.pad + R + tol, self.pad - tol:self.pad + int(round(self.A * R)) + tol] = True
        if (m & ~box).any():
            return False
        other = self.occ.copy()
        cts = list(contacts)
        if group == 'side' and self.ax is not None:
            r = self.raster([sigil._reflect(x, 'x', self.ax) for x in members])
            other |= r
            cts += [reflect_pt(c, self.ax) for c in contacts]
        hit = cv2.dilate(m.astype(np.uint8), self.kclear) > 0
        hit &= other
        rad = int(round(1.4 * self.s * R)) + self.clear
        for c in cts:
            cv2.circle(hit.view(np.uint8), self.px(c), rad, 0, -1)
        return int(hit.sum()) <= slack

    def add(self, members, group='center', contacts=(), force=False, note=None):
        if not force and not self.fits(members, group, contacts):
            return False
        self.occ |= self.raster(self.full(members, group))
        (self.side if group == 'side' and self.ax is not None else self.center).extend(members)
        n = len(sigil.expand(members))
        self.count += n * (2 if group == 'side' and self.ax is not None else 1)
        if note:
            self.log.append(note)
        return True

    def socket(self, p, u, group):
        self.sockets.append(dict(p=p, u=u, group=group))

    def members(self):
        out = list(self.center)
        if self.side:
            out.append({'t': 'mirror', 'axis': 'x', 'at': rnd(self.mirror_at), 'm': self.side})
        return out

    def free_x(self, group):
        """x range a side-group part may occupy."""
        if group == 'side' and self.ax is not None:
            return 0.0, self.ax
        return 0.0, self.A


# ---------- terminals: what sits at a free stroke end ----------

# Free line ends in the encodings land on a ring 29%, a triangle 9%, nothing 7%,
# a cross 6%, a spiral 5%, a dot 1% (the rest join other strokes). The T-bar
# with ring ends and the crescent are the sheet's other end shapes.
TERMINAL_W = {'ring': 0.46, 'tri': 0.11, 'none': 0.03, 'cross': 0.11, 'spiral': 0.09,
              'tbar': 0.09, 'dot': 0.01, 'crescent': 0.02, 'foot': 0.04, 'ring2': 0.04}


def pick(rng, weights, exclude=()):
    items = [(k, w) for k, w in weights.items() if k not in exclude]
    tot = sum(w for _, w in items); x = rng.random() * tot
    for k, w in items:
        x -= w
        if x <= 0:
            return k
    return items[-1][0]


def ring_r(rng):
    return max(0.028, min(0.075, q_draw(rng, 'ring_r')))


def cross_s(rng):
    return max(0.055, min(0.15, q_draw(rng, 'cross_s')))


def terminal(rng, p, u, kind, scale=1.0):
    """Members for a terminal of the given kind at stroke end p, outward direction u."""
    v = perp(u)
    if kind == 'ring':
        r = ring_r(rng) * scale
        return [{'t': 'ring', 'c': rnd(add(p, u, r)), 'r': rnd(r)}]
    if kind == 'ring2':  # ring, short neck, smaller ring
        r = ring_r(rng) * scale; r2 = r * 0.8
        c1 = add(p, u, r); q = add(c1, u, r); q2 = add(q, u, 0.04)
        return [{'t': 'ring', 'c': rnd(c1), 'r': rnd(r)}, L(q, q2), {'t': 'ring', 'c': rnd(add(q2, u, r2)), 'r': rnd(r2)}]
    if kind == 'dot':
        r = 0.022 * scale
        return [{'t': 'dot', 'c': rnd(add(p, u, r * 0.6)), 'r': rnd(r)}]
    if kind == 'cross':
        s = cross_s(rng) * scale
        return [{'t': 'cross', 'c': rnd(add(p, u, s * 0.95)), 's': rnd(s), 'flared': True, 'rot': rnd(ang(u) % 90, 1)}]
    if kind == 'tri':  # arrowhead
        sz = max(0.08, min(0.2, q_draw(rng, 'tri_size'))) * scale
        h = sz * rng.uniform(0.38, 0.5); base = add(p, u, -sz * 0.15)
        return [{'t': 'tri', 'p': rnd([add(base, v, h), add(base, v, -h), add(p, u, sz * 0.85)])}]
    if kind == 'foot':  # triangle standing on its tip at the stroke end
        sz = max(0.08, min(0.18, q_draw(rng, 'tri_size'))) * scale
        h = sz * 0.55; b = add(p, u, sz * 0.85)
        return [tri([p, add(b, v, h), add(b, v, -h)], rng.random() < 0.6)]
    if kind == 'spiral':
        r0 = max(0.04, min(0.085, q_draw(rng, 'spiral_r'))) * scale
        sweep = rng.choice([1, -1]) * rng.uniform(330, 470)
        a0 = ang(u) - 90 if sweep > 0 else ang(u) + 90
        c = add(p, unit(a0), -r0)
        return [{'t': 'spiral', 'c': rnd(c), 'r': rnd([r0, r0 * 0.18]), 'a': rnd([a0, sweep], 1)}]
    if kind == 'tbar':
        h = rng.uniform(0.05, 0.09) * scale; r = ring_r(rng) * 0.85 * scale
        a = add(p, v, h); b = add(p, v, -h)
        return [L(a, b), {'t': 'ring', 'c': rnd(add(a, v, r)), 'r': rnd(r)}, {'t': 'ring', 'c': rnd(add(b, v, -r)), 'r': rnd(r)}]
    if kind == 'crescent':
        r = rng.uniform(0.05, 0.075) * scale
        return [{'t': 'crescent', 'c': rnd(add(p, u, r * 0.9)), 'r': rnd(r), 'ri': rnd(r * 0.92), 'k': 0.45, 'rot': rnd(ang(u) % 360, 1)}]
    return []


def place_terminal(cv, sock, kinds=None, exclude=()):
    """Try terminal kinds at a socket until one fits; returns the kind placed."""
    rng = cv.rng
    for attempt in range(6):
        kind = kinds[attempt % len(kinds)] if kinds else pick(rng, TERMINAL_W, exclude)
        if kind == 'none':
            return 'none'
        for scale in (1.0, 0.8):
            ms = terminal(rng, sock['p'], sock['u'], kind, scale)
            if cv.add(ms, sock['group'], contacts=[sock['p']]):
                return kind
    return 'none'


def ends(cv, p, u, group, kinds=None):
    """A stroke end at p: either a terminal now or a socket for later."""
    if kinds:
        return place_terminal(cv, dict(p=p, u=u, group=group), kinds)
    cv.socket(p, u, group)
    return None


# ---------- ornaments used by the decoration loop ----------

def rail_spot(cv, margin=0.05):
    """A point on a rail and the group a part attached there belongs to."""
    rng = cv.rng
    x0, x1, y, g = rng.choice(cv.rails)
    if cv.ax is None:
        return (rng.uniform(x0 + margin, x1 - margin), y, 'center') if x1 - x0 > 2 * margin else None
    if x0 - 1e-6 <= cv.ax <= x1 + 1e-6 and rng.random() < 0.2:
        return cv.ax, y, 'center'
    b = min(x1 - margin, cv.ax - 0.06)
    if b <= x0 + margin:
        return None
    return rng.uniform(x0 + margin, b), y, 'side'


def pendant(cv):
    """A vertical stem hung from (or raised on) a rail, ending in a terminal."""
    rng = cv.rng
    if not cv.rails:
        return False
    spot = rail_spot(cv)
    if not spot:
        return False
    x, y, g = spot
    kind = pick(rng, TERMINAL_W, exclude=('none',))
    for length, scale in ((rng.uniform(0.08, 0.22), 1.0), (rng.uniform(0.05, 0.1), 0.8)):
        for d in rng.sample([1, -1], 2):
            p0 = (x, y); p1 = (x, y + d * length); u = (0, d)
            ms = [L(p0, p1)] + terminal(rng, p1, u, kind, scale)
            if cv.add(ms, g, contacts=[p0], note=f'{"pendant" if d > 0 else "stem"} with {kind}'):
                cv.posts.append((x, min(y, p1[1]), max(y, p1[1]), g))
                return True
    return False


def ringrow(cv):
    """A row of two to five rings hanging from (or sitting on) a rail, as on Eligos and Vepar."""
    rng = cv.rng
    if not cv.rails:
        return False
    x0, x1, y, g = rng.choice(cv.rails)
    r = ring_r(rng) * rng.uniform(0.75, 1.0); n = rng.choice([2, 3, 3, 4, 5])
    d = 2 * r + cv.s * rng.uniform(1.2, 2.2)
    side = rng.choice([1, -1]); yc = y + side * (r + cv.s * rng.uniform(0.6, 1.5))
    hang = rng.random() < 0.4          # rings on short necks
    if hang:
        yc = y + side * (r + rng.uniform(0.04, 0.07))
    span = d * (n - 1)
    if cv.ax is not None and (x0 <= cv.ax <= x1) and rng.random() < 0.6:
        xs = cv.ax - span / 2; g = 'center'
    else:
        b = x1 - r - span if cv.ax is None else min(x1 - r, cv.ax - r - 0.03) - span
        if b <= x0 + r:
            return False
        xs = rng.uniform(x0 + r, b); g = 'side' if cv.ax is not None else 'center'
    m = [{'t': 'ring', 'c': rnd((xs, yc)), 'r': rnd(r)}]
    if hang:
        m.insert(0, L((xs, y), (xs, yc - side * r)))
    ms = [{'t': 'repeat', 'n': n, 'd': [rnd(d), 0], 'm': m}]
    return cv.add(ms, g, contacts=[(xs + i * d, y) for i in range(n)] if hang else [(xs + i * d, y) for i in range(n)],
                  note=f'row of {n} rings')


def spur(cv):
    """A short stroke out of a post, level or at 45 degrees, ending in a terminal."""
    rng = cv.rng
    if not cv.posts:
        return False
    x, y0, y1, g = rng.choice(cv.posts)
    if y1 - y0 < 0.12:
        return False
    if cv.ax is not None:
        if x > cv.ax + 1e-6:
            return False
        g = 'side'; d = -1          # mirrored: build the left one, the right one is its reflection
    else:
        d = rng.choice([-1, 1])
    y = rng.uniform(y0 + 0.05, y1 - 0.05)
    tilt = pick(rng, {0: 0.55, 45: 0.25, -45: 0.2})
    u = unit(180 + tilt) if d < 0 else unit(-tilt)
    length = rng.uniform(0.07, 0.17) * (1.2 if tilt else 1)
    p1 = add((x, y), u, length)
    kind = pick(rng, TERMINAL_W, exclude=('none', 'foot'))
    ms = [L((x, y), p1)] + terminal(rng, p1, u, kind)
    return cv.add(ms, g, contacts=[(x, y)], note=f'{"diagonal " if tilt else ""}spur with {kind}')


def arch(cv):
    """A small arch standing on (or hanging from) a rail, sometimes crowned."""
    rng = cv.rng
    if not cv.rails:
        return False
    x0, x1, y, g = rng.choice(cv.rails)
    r = rng.uniform(0.05, 0.1)
    lo, hi = x0 + r + 0.02, x1 - r - 0.02
    if cv.ax is not None:
        hi = min(hi, cv.ax - r - 0.03)
    if hi <= lo:
        return False
    cx = rng.uniform(lo, hi); up = rng.random() < 0.6
    ms = [{'t': 'arc', 'c': rnd((cx, y)), 'r': rnd([r, r * rng.uniform(0.8, 1.3)]), 'a': [180, 360] if up else [0, 180]}]
    gg = 'side' if cv.ax is not None else 'center'
    return cv.add(ms, gg, contacts=[(cx - r, y), (cx + r, y)], note='arch on a rail')


def enclosed_room(cv):
    """Distance (px) to the nearest ink for background pixels enclosed by ink."""
    ff = (~cv.occ).astype(np.uint8)
    mask = np.zeros((cv.H + 2, cv.W + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    return cv2.distanceTransform((ff == 1).astype(np.uint8), cv2.DIST_L2, 3)


def filler(cv):
    """A free-standing part inside an enclosure: cross, ring, ring pair, diamond, triangle or dot.

    On the sheet loose parts sit in cells, bowls and frames, not in open space."""
    rng = cv.rng
    room = enclosed_room(cv)
    if cv.ax is not None:
        axis_col = int(round(cv.ax * R)) + cv.pad
        room[:, axis_col + 1:] = 0
    kind = pick(rng, {'cross': 0.5, 'ring': 0.2, 'ringrow': 0.1, 'diamond': 0.08, 'tri': 0.08, 'dot': 0.04})
    size = {'cross': cross_s(rng) * rng.uniform(0.55, 0.85), 'ring': ring_r(rng), 'ringrow': ring_r(rng) * 0.8,
            'diamond': rng.uniform(0.035, 0.06), 'tri': rng.uniform(0.04, 0.07), 'dot': 0.02}[kind]
    need = (size + cv.s) * R + cv.clear
    if kind == 'ringrow':
        need = (2 * size + cv.s * 2) * R + cv.clear
    ys, xs = np.nonzero(room >= need)
    if not len(xs):
        return False
    i = rng.randrange(len(xs))
    x = (xs[i] - cv.pad) / R; y = (ys[i] - cv.pad) / R
    g = 'center'
    if cv.ax is not None:
        if axis_col - xs[i] < need:   # close to the axis: sit on it
            x = cv.ax
        else:
            g = 'side'
    if kind == 'cross':
        ms = [{'t': 'cross', 'c': rnd((x, y)), 's': rnd(size), 'flared': True, 'rot': 0}]
    elif kind == 'ring':
        ms = [{'t': 'ring', 'c': rnd((x, y)), 'r': rnd(size)}]
    elif kind == 'ringrow':
        d = 2 * size + cv.s * 1.6
        ms = [{'t': 'repeat', 'n': 2, 'd': [0, rnd(d)], 'm': [{'t': 'ring', 'c': rnd((x, y - d / 2)), 'r': rnd(size)}]}]
    elif kind == 'diamond':
        h = size
        ms = [{'t': 'pline', 'p': rnd([(x, y - h), (x + h, y), (x, y + h), (x - h, y)]), 'closed': True, 'fill': rng.random() < 0.4}]
    elif kind == 'tri':
        h = size; up = rng.choice([1, -1])
        ms = [tri([(x, y - up * h), (x + h, y + up * h * 0.8), (x - h, y + up * h * 0.8)], rng.random() < 0.6)]
    else:
        ms = [{'t': 'dot', 'c': rnd((x, y)), 'r': 0.02}]
    if cv.add(ms, g, note=f'{kind} in an enclosure'):
        cv.floating += 1
        return True
    return False


def connector(cv):
    """A vertical stroke joining two rails, which makes a cell."""
    rng = cv.rng
    if len(cv.rails) < 2:
        return False
    a, b = rng.sample(cv.rails, 2)
    if abs(a[2] - b[2]) < 0.12:
        return False
    lo = max(a[0], b[0]) + 0.04; hi = min(a[1], b[1]) - 0.04
    g = 'center'
    if cv.ax is not None:
        hi = min(hi, cv.ax - 0.05); g = 'side'
    if hi <= lo:
        return False
    x = rng.uniform(lo, hi); y0, y1 = sorted((a[2], b[2]))
    if any(abs(px - x) < 0.07 and py0 < y1 and py1 > y0 for px, py0, py1, _ in cv.posts):
        return False
    if cv.add([L((x, y0), (x, y1))], g, contacts=[(x, y0), (x, y1)], note='wall between rails'):
        cv.posts.append((x, y0, y1, g))
        return True
    return False


def crossbar(cv):
    """A short horizontal bar across a post on the axis (or any post when unmirrored)."""
    rng = cv.rng
    if not cv.posts:
        return False
    x, y0, y1, g = rng.choice(cv.posts)
    if y1 - y0 < 0.15 or g != 'center' or (cv.ax is not None and abs(x - cv.ax) > 1e-6):
        return False
    y = rng.uniform(y0 + 0.06, y1 - 0.06); h = rng.uniform(0.06, 0.13)
    kind = pick(rng, {'ring': 0.55, 'tri': 0.2, 'cross': 0.15, 'none': 0.1})
    a = (x - h, y); b = (x + h, y)
    ms = [L(a, b)] + terminal(rng, a, (-1, 0), kind) + terminal(rng, b, (1, 0), kind)
    if cv.add(ms, 'center', contacts=[(x, y)], note=f'crossbar with {kind}'):
        cv.rails.append((a[0], b[0], y, 'center'))
        return True
    return False


def reach(cv):
    """Grow a level or upright stem from the nearest stroke into the largest empty
    region of the design box, ending in a terminal: the seals fill their space."""
    rng = cv.rng
    x_lo, y_lo = cv.pad, cv.pad
    x_hi, y_hi = cv.pad + int(round(cv.A * R)), cv.pad + R
    free = np.zeros_like(cv.occ, np.uint8)
    free[y_lo:y_hi, x_lo:x_hi] = 1
    free &= (~cv.occ).astype(np.uint8)
    if cv.ax is not None:
        free[:, int(round(cv.ax * R)) + cv.pad - 2 * cv.clear:] = 0
    dt = cv2.distanceTransform(free, cv2.DIST_L2, 3)
    if dt.max() < 0.06 * R:
        return False
    ys, xs = np.nonzero(dt >= 0.7 * dt.max())
    i = rng.randrange(len(xs)); tx, ty = int(xs[i]), int(ys[i])
    # nearest ink along the four axis directions
    best = None
    for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        x, y, n = tx, ty, 0
        while x_lo <= x < x_hi and y_lo <= y < y_hi and not cv.occ[y, x]:
            x += ux; y += uy; n += 1
        if x_lo <= x < x_hi and y_lo <= y < y_hi and (best is None or n < best[0]):
            best = (n, x, y, (-ux, -uy))
    if best is None:
        return False
    n, hx, hy, u = best
    p0 = ((hx - cv.pad) / R, (hy - cv.pad) / R)
    target = ((tx - cv.pad) / R, (ty - cv.pad) / R)
    dist = math.dist(p0, target)
    kind = pick(rng, TERMINAL_W, exclude=('none',))
    g = 'side' if cv.ax is not None else 'center'
    for f in (1.0, 0.7):
        length = max(0.05, dist * f - 0.05)
        p1 = add(p0, u, length)
        ms = [L(p0, p1)] + terminal(rng, p1, u, kind, 1.0 if f == 1.0 else 0.8)
        if cv.add(ms, g, contacts=[p0], note=f'arm with {kind}'):
            if u[1] == 0:
                cv.rails.append((min(p0[0], p1[0]), max(p0[0], p1[0]), p0[1], g))
            else:
                cv.posts.append((p0[0], min(p0[1], p1[1]), max(p0[1], p1[1]), g))
            return True
    return False


def decorate(cv, target):
    rng = cv.rng
    tries = 0
    # terminals first: free ends are where the sheet puts most of its ornament
    rng.shuffle(cv.sockets)
    while cv.sockets and tries < 60:
        tries += 1
        s = cv.sockets.pop()
        if cv.count >= target and rng.random() < 0.5:
            place_terminal(cv, s, kinds=['ring', 'none'])
        else:
            place_terminal(cv, s)
    # about half the mirrored seals on the sheet carry one-sided extras
    # (Leraje's rail end, Buer's arms): sheet sym_lr median 0.56, not 0.9
    extras = rng.choice([1, 2, 2, 3]) if cv.ax is not None and rng.random() < 0.5 else 0
    tries = 0
    while cv.count < target - 2.5 * extras and tries < 700:
        tries += 1
        act = pick(rng, {'pendant': 0.24, 'spur': 0.15, 'filler': 0.18 if cv.floating < 4 else 0.04,
                         'crossbar': 0.07, 'connector': 0.09, 'arch': 0.06, 'ringrow': 0.08, 'reach': 0.13})
        ORNAMENTS[act](cv)
    if extras:
        cv.ax = None; tries = 0; placed = 0
        while placed < extras and tries < 80:
            tries += 1
            placed += bool(ORNAMENTS[pick(rng, {'pendant': 0.4, 'spur': 0.35, 'ringrow': 0.1, 'arch': 0.15})](cv))
        if placed:
            cv.log.append(f'{placed} one-sided extra{"s" if placed > 1 else ""}')


ORNAMENTS = {'pendant': pendant, 'spur': spur, 'filler': filler, 'crossbar': crossbar,
             'connector': connector, 'arch': arch, 'ringrow': ringrow, 'reach': reach}


# ---------- the six construction grammars ----------

def side_group(cv):
    return 'side' if cv.ax is not None else 'center'


def g_axial(cv):
    rng = cv.rng; A = cv.A; ax = A / 2
    mirrored = cv.ax is not None
    top = rng.uniform(0.16, 0.26); bot = rng.uniform(0.78, 0.86)
    cv.add([L((ax, top), (ax, bot))], force=True, note='vertical axis')
    cv.posts.append((ax, top, bot, 'center'))
    place_terminal(cv, dict(p=(ax, top), u=(0, -1), group='center'),
                   kinds=[pick(rng, {'cross': 0.4, 'ring': 0.18, 'tri': 0.14, 'tbar': 0.12, 'crescent': 0.06, 'ring2': 0.1})])
    # crossbars: 1 to 3, the widest roughly in the upper middle
    nbars = rng.choice([1, 2, 2, 3, 3])
    ys = sorted(rng.uniform(top + 0.1, bot - 0.1) for _ in range(nbars))
    for y in ys:
        hw = rng.uniform(0.18, max(0.2, A / 2 - 0.1))
        a = (ax - hw, y); b = (ax + hw, y)
        cv.add([L(a, b)], 'center', contacts=[(ax, y)], force=True, note='crossbar')
        cv.rails.append((ax - hw, ax + hw, y, 'center'))
        for p, sgn in ((a, -1), (b, 1)):
            if sgn == 1 and mirrored:
                break
            g = side_group(cv)
            if rng.random() < 0.55:  # the bar's end turns down (or up) into a post
                d = 1 if y < 0.55 else -1
                q = (p[0], p[1] + d * rng.uniform(0.12, 0.26))
                if cv.add([L(p, q)], g, contacts=[p]):
                    cv.posts.append((p[0], min(p[1], q[1]), max(p[1], q[1]), g))
                    cv.socket(q, (0, d), g)
                    continue
            cv.socket(p, (sgn, 0), g)
    # diagonals from the axis
    if rng.random() < 0.55:
        y0 = rng.uniform(top + 0.15, bot - 0.05); dx = rng.uniform(0.2, A / 2 - 0.08); dy = rng.uniform(0.12, 0.3) * rng.choice([1, -1])
        for sgn in ((-1,) if mirrored else (-1, 1)):
            q = (ax + sgn * dx, y0 + dy)
            if 0.08 < q[1] < 0.92 and cv.add([L((ax, y0), q)], side_group(cv), contacts=[(ax, y0)], note='diagonal arm'):
                n = math.hypot(dx, dy); cv.socket(q, (sgn * dx / n, dy / n), side_group(cv))
    # foot
    foot = pick(rng, {'term': 0.55, 'bowl': 0.25, 'legs': 0.2})
    if foot == 'bowl':
        hw = rng.uniform(0.15, min(0.32, A / 2 - 0.08)); hb = rng.uniform(0.08, 0.15); yb = bot - hb
        if cv.add([{'t': 'arc', 'c': rnd((ax, yb)), 'r': rnd([hw, hb]), 'a': [0, 180]}], 'center', contacts=[(ax, bot)], note='bowl foot'):
            cv.socket((ax - hw, yb), (0, -1), side_group(cv))
            if not mirrored:
                cv.socket((ax + hw, yb), (0, -1), 'center')
            return
    if foot == 'legs':
        y0 = bot - rng.uniform(0.15, 0.25); dx = rng.uniform(0.12, 0.25)
        q = (ax - dx, bot)
        if cv.add([L((ax, y0), q)], side_group(cv), contacts=[(ax, y0)], note='legs'):
            n = math.hypot(dx, bot - y0); cv.socket(q, (-dx / n, (bot - y0) / n), side_group(cv))
            if not mirrored:
                q2 = (ax + dx, bot); cv.add([L((ax, y0), q2)], 'center', contacts=[(ax, y0)])
                cv.socket(q2, (dx / n, (bot - y0) / n), 'center')
    place_terminal(cv, dict(p=(ax, bot), u=(0, 1), group='center'),
                   kinds=[pick(rng, {'ring': 0.45, 'foot': 0.15, 'tbar': 0.15, 'cross': 0.15, 'tri': 0.1})])


def g_comb(cv):
    rng = cv.rng; A = cv.A; ax = A / 2
    mirrored = cv.ax is not None
    yr = rng.uniform(0.25, 0.45)
    x0 = rng.uniform(0.07, 0.14); x1 = A - x0
    cv.add([L((x0, yr), (x1, yr))], force=True, note='rail')
    cv.socket((x0, yr), (-1, 0), side_group(cv))
    if not mirrored:
        cv.socket((x1, yr), (1, 0), 'center')
    n = rng.choice([3, 3, 4, 4, 5, 6])
    inset = rng.uniform(0.12, 0.2)
    d = (x1 - x0 - 2 * inset) / (n - 1)
    length = rng.uniform(0.25, 0.92 - yr - 0.12)
    kind = pick(rng, {'ring': 0.35, 'spiral': 0.25, 'cross': 0.1, 'foot': 0.1, 'tbar': 0.1, 'tri': 0.1})
    xs = x0 + inset
    stem = [L((xs, yr), (xs, yr + length))] + terminal(rng, (xs, yr + length), (0, 1), kind)
    if not cv.add([{'t': 'repeat', 'n': n, 'd': [rnd(d), 0], 'm': stem}], force=True, note=f'{n} teeth with {kind}'):
        pass
    for i in range(n):
        cv.posts.append((xs + i * d, yr, yr + length, 'center'))
    # above the rail: arches, raised crosses, or I-bar heads
    top = pick(rng, {'arches': 0.3, 'crosses': 0.3, 'ibars': 0.2, 'none': 0.2})
    if top == 'arches':
        r = d / 2
        cv.add([{'t': 'repeat', 'n': n - 1, 'd': [rnd(d), 0], 'm': [{'t': 'arc', 'c': rnd((xs + r, yr)), 'r': rnd([r, min(r * rng.uniform(0.8, 1.4), yr - 0.08)]), 'a': [180, 360]}]}],
               contacts=[(xs + i * d, yr) for i in range(n)], note='arches over the rail')
    elif top in ('crosses', 'ibars'):
        h = rng.uniform(0.06, min(0.14, yr - 0.16))
        if top == 'crosses':
            s = min(cross_s(rng) * 0.8, d * 0.42, (yr - h - 0.02) / 1.0)
            head = [{'t': 'cross', 'c': rnd((xs, yr - h - s * 0.95)), 's': rnd(s), 'flared': True, 'rot': 0}]
        else:
            w = min(d * 0.35, 0.07)
            head = [L((xs - w, yr - h), (xs + w, yr - h))]
        sel = rng.choice(['all', 'odd']) if n >= 3 else 'all'
        nn, dd, x_start = (n, d, xs) if sel == 'all' else ((n + 1) // 2, 2 * d, xs)
        m = [L((x_start, yr), (x_start, yr - h))] + [sigil._translate(x, x_start - xs, 0) for x in head]
        cv.add([{'t': 'repeat', 'n': nn, 'd': [rnd(dd), 0], 'm': m}], contacts=[(x_start + i * dd, yr) for i in range(nn)], note=f'{top} above the rail')
    cv.rails.append((x0, x1, yr, 'center'))
    # optional lower rail closing the teeth into cells
    if rng.random() < 0.3:
        yb = yr + length * rng.uniform(0.45, 0.7)
        cv.add([L((xs, yb), (xs + (n - 1) * d, yb))], contacts=[(xs + i * d, yb) for i in range(n)], note='lower rail')


def g_bowl(cv):
    rng = cv.rng; A = cv.A; ax = A / 2
    mirrored = cv.ax is not None
    yr = rng.uniform(0.3, 0.45)
    x0 = rng.uniform(0.07, 0.15); x1 = A - x0
    cv.add([L((x0, yr), (x1, yr))], force=True, note='rail')
    cv.socket((x0, yr), (-1, 0), side_group(cv))
    if not mirrored:
        cv.socket((x1, yr), (1, 0), 'center')
    hw = rng.uniform(0.25, ax - x0 - 0.06); hb = rng.uniform(0.28, 0.88 - yr)
    straight = rng.random() < 0.35
    if straight:  # U with straight walls
        hs = hb * rng.uniform(0.3, 0.55); hb2 = hb - hs
        cv.add([{'t': 'mirror', 'axis': 'x', 'at': rnd(ax), 'm': [L((ax - hw, yr), (ax - hw, yr + hs))]},
                {'t': 'arc', 'c': rnd((ax, yr + hs)), 'r': rnd([hw, hb2]), 'a': [0, 180]}], force=True, note='U bowl')
        cv.posts.append((ax - hw, yr, yr + hs, side_group(cv)))
    else:
        cv.add([{'t': 'arc', 'c': rnd((ax, yr)), 'r': rnd([hw, hb]), 'a': [0, 180]}], force=True, note='bowl')
    ybot = yr + hb
    cv.rails.append((x0, x1, yr, 'center'))
    # above the rail
    above = pick(rng, {'crosses': 0.4, 'center': 0.35, 'rings': 0.25})
    if above == 'crosses':
        n = rng.choice([1, 2, 3]); h = rng.uniform(0.06, 0.12)
        s = min(cross_s(rng), (yr - h - 0.02) / 1.0)
        span = (hw * 2) * rng.uniform(0.5, 0.9); dd = span / max(1, n - 1) if n > 1 else 0
        xs = ax - dd * (n - 1) / 2
        m = [L((xs, yr), (xs, yr - h)), {'t': 'cross', 'c': rnd((xs, yr - h - s * 0.95)), 's': rnd(s), 'flared': True, 'rot': 0}]
        cv.add([{'t': 'repeat', 'n': n, 'd': [rnd(dd), 0], 'm': m}] if n > 1 else m,
               contacts=[(xs + i * dd, yr) for i in range(n)], note=f'{n} crosses on the rail')
    elif above == 'rings':
        ringrow(cv)
    elif above == 'center':
        h = rng.uniform(0.05, 0.12)
        cv.add([L((ax, yr), (ax, yr - h))], contacts=[(ax, yr)])
        place_terminal(cv, dict(p=(ax, yr - h), u=(0, -1), group='center'), kinds=['cross', 'tri', 'tbar', 'ring'])
    # inside the bowl
    if not straight and rng.random() < 0.25:   # a second bowl inside the first (Agares)
        f = rng.uniform(0.55, 0.75)
        cv.add([{'t': 'arc', 'c': rnd((ax, yr)), 'r': rnd([hw * f, hb * f]), 'a': [0, 180]}],
               contacts=[(ax - hw * f, yr), (ax + hw * f, yr)], note='inner bowl')
    inside = pick(rng, {'stem': 0.45, 'rings': 0.25, 'box': 0.15, 'none': 0.15})
    if inside == 'stem':
        q = (ax, yr + hb * rng.uniform(0.4, 0.65))
        if cv.add([L((ax, yr), q)], contacts=[(ax, yr)], note='stem in the bowl'):
            cv.posts.append((ax, yr, q[1], 'center'))
            place_terminal(cv, dict(p=q, u=(0, 1), group='center'), kinds=[pick(rng, {'tri': 0.3, 'ring': 0.3, 'cross': 0.25, 'foot': 0.15})])
    elif inside == 'rings':
        r = ring_r(rng) * 0.9; n = rng.choice([2, 3, 4]); dd = 2 * r + cv.s * 2
        y = yr + r + cv.s * 2.5 if rng.random() < 0.6 else yr + hb * 0.5
        cv.add([{'t': 'repeat', 'n': n, 'd': [rnd(dd), 0], 'm': [{'t': 'ring', 'c': rnd((ax - dd * (n - 1) / 2, y)), 'r': rnd(r)}]}], note='ring row in the bowl')
    elif inside == 'box':
        w = hw * rng.uniform(0.3, 0.5); h = hb * rng.uniform(0.25, 0.4)
        y0 = yr + hb * 0.2
        cv.add([{'t': 'pline', 'p': rnd([(ax - w, y0), (ax + w, y0), (ax + w, y0 + h), (ax - w, y0 + h)]), 'closed': True}], note='cell in the bowl')
    # foot under the bowl
    if rng.random() < 0.7:
        place_terminal(cv, dict(p=(ax, ybot), u=(0, 1), group='center'), kinds=[pick(rng, {'ring': 0.5, 'foot': 0.2, 'cross': 0.15, 'tri': 0.15})])


def skyline(rng, x0, x1, ytop, ybot, cols, mirrored):
    """Closed rectilinear outline with a stepped top (and sometimes a stepped bottom)."""
    xs = np.linspace(x0, x1, cols + 1)
    tops = [ytop + rng.choice([0, 0, 0.08, 0.14, -0.06]) for _ in range(cols)]
    bots = [ybot - rng.choice([0, 0, 0, 0.1]) for _ in range(cols)]
    if mirrored:
        for i in range(cols // 2):
            tops[cols - 1 - i] = tops[i]; bots[cols - 1 - i] = bots[i]
    tops = [min(max(t, 0.06), ybot - 0.2) for t in tops]
    pts = []
    for i in range(cols):
        pts += [(xs[i], tops[i]), (xs[i + 1], tops[i])]
    for i in reversed(range(cols)):
        pts += [(xs[i + 1], bots[i]), (xs[i], bots[i])]
    # drop collinear duplicates
    out = []
    for p in pts:
        if out and abs(out[-1][0] - p[0]) < 1e-9 and abs(out[-1][1] - p[1]) < 1e-9:
            continue
        out.append(p)
    return out, xs, tops, bots


def g_compartment(cv):
    rng = cv.rng; A = cv.A; ax = A / 2
    mirrored = cv.ax is not None
    x0 = rng.uniform(0.1, 0.22); x1 = A - x0
    ytop = rng.uniform(0.2, 0.32); ybot = rng.uniform(0.68, 0.82)
    style = pick(rng, {'stepped': 0.45, 'cells': 0.35, 'arched': 0.2})
    cols = rng.choice([3, 3, 4, 5])
    if style == 'stepped':
        pts, xs, tops, bots = skyline(rng, x0, x1, ytop, ybot, cols, mirrored)
        cv.add([{'t': 'pline', 'p': rnd(pts), 'closed': True}], force=True, note=f'stepped outline, {cols} bays')
        cells = [((xs[i] + xs[i + 1]) / 2, (tops[i] + bots[i]) / 2) for i in range(cols)]
        for i in range(cols):
            cv.rails.append((xs[i], xs[i + 1], tops[i], 'center')); cv.rails.append((xs[i], xs[i + 1], bots[i], 'center'))
        if rng.random() < 0.5:  # internal walls
            for i in range(1, cols):
                y_a = max(tops[i - 1], tops[i]); y_b = min(bots[i - 1], bots[i])
                if y_b - y_a > 0.15:
                    cv.add([L((xs[i], y_a), (xs[i], y_b))], contacts=[(xs[i], y_a), (xs[i], y_b)])
    else:
        rect = [(x0, ytop), (x1, ytop), (x1, ybot), (x0, ybot)]
        if style == 'arched':
            r = (x1 - x0) / (2 * cols)
            ms = [L((x0, ytop), (x0, ybot)), L((x1, ytop), (x1, ybot)), L((x0, ybot), (x1, ybot)),
                  {'t': 'repeat', 'n': cols, 'd': [rnd(2 * r), 0], 'm': [{'t': 'arc', 'c': rnd((x0 + r, ytop)), 'r': rnd([r, min(r, ytop - 0.06)]), 'a': [180, 360]}]}]
            if rng.random() < 0.5:
                ms.append(L((x0, ytop), (x1, ytop)))
            cv.add(ms, force=True, note=f'arched frame, {cols} arches')
        else:
            cv.add([{'t': 'pline', 'p': rnd(rect), 'closed': True}], force=True, note=f'frame of {cols} cells')
        xs = np.linspace(x0, x1, cols + 1)
        if style == 'cells':
            walls = [L((x, ytop), (x, ybot)) for x in xs[1:-1]]
            cv.add([{'t': 'repeat', 'n': cols - 1, 'd': [rnd(xs[1] - xs[0]), 0], 'm': [walls[0]]}], force=True)
            if rng.random() < 0.35:
                ym = (ytop + ybot) / 2; cv.add([L((x0, ym), (x1, ym))], force=True, note='middle rail')
        cells = [((xs[i] + xs[i + 1]) / 2, (ytop + ybot) / 2) for i in range(cols)]
        cv.rails.append((x0, x1, ytop, 'center')); cv.rails.append((x0, x1, ybot, 'center'))
        tops = [ytop] * cols; bots = [ybot] * cols
    cv.posts.append((x0, tops[0], bots[0], side_group(cv)))
    if not mirrored:
        cv.posts.append((x1, tops[-1], bots[-1], 'center'))
    # stems out of the outline's corners (the end bays' corners, where the outline is)
    lt, lb, rt, rb = (x0, tops[0]), (x0, bots[0]), (x1, tops[-1]), (x1, bots[-1])
    corners = [(lt, (0, -1)), (lb, (0, 1)), (lt, (-1, 0)), (lb, (-1, 0))]
    if not mirrored:
        corners += [(rt, (0, -1)), (rb, (0, 1)), (rt, (1, 0)), (rb, (1, 0))]
    for p, u in rng.sample(corners, rng.choice([1, 2, 2, 3])):
        q = add(p, u, rng.uniform(0.05, 0.12))
        if cv.add([L(p, q)], side_group(cv), contacts=[p], note='stem at a corner'):
            cv.socket(q, u, side_group(cv))
    # fill cells: crosses mostly, mirrored where the frame is
    kinds = {'cross': 0.55, 'ring': 0.15, 'tri': 0.1, 'ringrow': 0.1, 'diamond': 0.1}
    for i, (cx, cy) in enumerate(cells):
        if mirrored and cx > ax + 1e-6:
            break
        if rng.random() < 0.25:
            continue
        on_axis = mirrored and abs(cx - ax) < 1e-6
        g = 'center' if (on_axis or not mirrored) else 'side'
        k = pick(rng, kinds)
        cw = (xs[1] - xs[0]) / 2
        if k == 'cross':
            s = min(cross_s(rng), cw * 0.75, 0.12)
            ms = [{'t': 'cross', 'c': rnd((cx, cy)), 's': rnd(s), 'flared': True, 'rot': 0}]
        elif k == 'ring':
            ms = [{'t': 'ring', 'c': rnd((cx, cy)), 'r': rnd(ring_r(rng))}]
        elif k == 'ringrow':
            r = min(ring_r(rng), cw * 0.35); dd = 2 * r + cv.s * 1.8
            ms = [{'t': 'repeat', 'n': 2, 'd': [0, rnd(dd)], 'm': [{'t': 'ring', 'c': rnd((cx, cy - dd / 2)), 'r': rnd(r)}]}]
        elif k == 'diamond':
            h = min(0.06, cw * 0.6)
            ms = [{'t': 'pline', 'p': rnd([(cx, cy - h), (cx + h, cy), (cx, cy + h), (cx - h, cy)]), 'closed': True, 'fill': rng.random() < 0.5}]
        else:
            h = min(0.07, cw * 0.6)
            ms = [{'t': 'tri', 'p': rnd([(cx, cy - h), (cx + h, cy + h * 0.8), (cx - h, cy + h * 0.8)])}]
        cv.add(ms, g, note=f'{k} in a cell')
    # a crowning element on the axis
    if mirrored and rng.random() < 0.6:
        yt = ytop - 0.0
        h = rng.uniform(0.04, 0.1)
        if cv.add([L((ax, yt), (ax, yt - h))], contacts=[(ax, yt)]):
            place_terminal(cv, dict(p=(ax, yt - h), u=(0, -1), group='center'), kinds=['cross', 'ring', 'tri'])


def g_radial(cv):
    """Spokes from a hub: an X (Decarabia, Haures), an X on an upright axis (Murmur),
    eight rays (Volac), or a pentagram (Astaroth); sometimes inside a frame (Oso)."""
    rng = cv.rng; A = cv.A; ax = A / 2; cy = 0.5
    form = pick(rng, {'x': 0.35, 'x_axis': 0.25, 'star8': 0.2, 'star5': 0.2})
    rr = rng.uniform(0.3, 0.4)
    k1 = pick(rng, {'ring': 0.35, 'cross': 0.3, 'crescent': 0.2, 'tbar': 0.1, 'tri': 0.05})
    if form == 'star5':
        R5 = rng.uniform(0.36, 0.44); cy5 = 0.52
        pts = [(ax + R5 * math.cos(math.radians(-90 + 144 * i)), cy5 + R5 * math.sin(math.radians(-90 + 144 * i))) for i in range(5)]
        cv.add([{'t': 'pline', 'p': rnd(pts), 'closed': True}], force=True, note='pentagram')
        kt = pick(rng, {'ring': 0.6, 'cross': 0.25, 'dot': 0.15})
        for i, p in enumerate(pts[:3]):          # the top point and the left two; the rest mirror
            if p[0] > ax + 1e-6:
                continue
            u = ((p[0] - ax) / R5, (p[1] - cy5) / R5)
            g = 'center' if abs(p[0] - ax) < 1e-6 else side_group(cv)
            if not cv.add(terminal(rng, p, u, kt, 0.8), g, contacts=[p]) and g != 'center':
                pass
        if cv.ax is None:
            for p in pts:
                if p[0] > ax + 1e-6:
                    u = ((p[0] - ax) / R5, (p[1] - cy5) / R5); cv.add(terminal(rng, p, u, kt, 0.8), contacts=[p])
        cv.add([{'t': 'ring', 'c': rnd((ax, cy5)), 'r': rnd(rng.uniform(0.04, 0.07))}], note='ring at the centre')
        return
    if form in ('x', 'x_axis', 'star8'):
        a = rng.uniform(35, 55)
        u = unit(180 + a)  # up-left
        p = (ax + u[0] * rr, cy + u[1] * rr)
        spoke = [L((ax, cy), p)] + terminal(rng, p, u, k1, 0.9)
        if rng.random() < 0.5:              # a bar across each spoke, with rings or small crosses
            t = rng.uniform(0.45, 0.65); q = add((ax, cy), u, rr * t); v = perp(u); h = rng.uniform(0.05, 0.08)
            kb = pick(rng, {'ring': 0.6, 'none': 0.25, 'tri': 0.15})
            a1 = add(q, v, h); a2 = add(q, v, -h)
            spoke += [L(a1, a2)] + terminal(rng, a1, v, kb, 0.7) + terminal(rng, a2, (-v[0], -v[1]), kb, 0.7)
        m = [{'t': 'mirror', 'axis': 'y', 'at': cy, 'm': [{'t': 'mirror', 'axis': 'x', 'at': rnd(ax), 'm': spoke}]}]
        cv.add(m, force=True, note=f'X of four spokes with {k1}')
    if form in ('x_axis', 'star8'):
        k2 = pick(rng, {'ring': 0.3, 'cross': 0.35, 'tri': 0.15, 'tbar': 0.1, 'crescent': 0.1})
        r2 = rr * rng.uniform(0.95, 1.2) if form == 'x_axis' else rr * rng.uniform(0.85, 1.0)
        m = []
        for uu in ((0, -1), (0, 1)):
            p = (ax, cy + uu[1] * r2)
            m += [L((ax, cy), p)] + terminal(rng, p, uu, k2 if uu[1] < 0 or rng.random() < 0.6 else 'ring', 0.9)
        cv.add(m, force=True, note=f'upright axis with {k2}')
        cv.posts.append((ax, cy - r2, cy + r2, 'center'))
        if form == 'star8':
            pl = (ax - r2 * 0.95, cy)
            cv.add([{'t': 'mirror', 'axis': 'x', 'at': rnd(ax), 'm': [L((ax, cy), pl)] + terminal(rng, pl, (-1, 0), k2, 0.9)}],
                   force=True, note='level spokes')
            cv.rails.append((pl[0], 2 * ax - pl[0], cy, 'center'))
    hub = pick(rng, {'ring': 0.35, 'cross': 0.2, 'square': 0.2, 'rings2': 0.1, 'none': 0.15})
    if hub == 'ring':
        cv.add([{'t': 'ring', 'c': rnd((ax, cy)), 'r': rnd(rng.uniform(0.05, 0.09))}], force=True, note='hub ring')
    elif hub == 'rings2':
        r = rng.uniform(0.07, 0.1)
        cv.add([{'t': 'ring', 'c': rnd((ax, cy)), 'r': rnd(r)}, {'t': 'ring', 'c': rnd((ax, cy)), 'r': rnd(r * 0.55)}], force=True, note='double hub ring')
    elif hub == 'cross':
        cv.add([{'t': 'cross', 'c': rnd((ax, cy)), 's': rnd(rng.uniform(0.07, 0.11)), 'flared': True, 'rot': 0}], force=True, note='hub cross')
    elif hub == 'square':
        h = rng.uniform(0.06, 0.1)
        cv.add([{'t': 'pline', 'p': rnd([(ax - h, cy - h), (ax + h, cy - h), (ax + h, cy + h), (ax - h, cy + h)]), 'closed': True}], force=True, note='hub square')
    if form == 'x' and rng.random() < 0.35:   # frame around the X, the spokes' tips on its corners
        h = rr * 0.72
        fr = [(ax - h, cy - h), (ax + h, cy - h), (ax + h, cy + h), (ax - h, cy + h)]
        if cv.add([{'t': 'pline', 'p': rnd(fr), 'closed': True}], contacts=fr, note='frame around the X'):
            cv.rails += [(ax - h, ax + h, cy - h, 'center'), (ax - h, ax + h, cy + h, 'center')]
            cv.posts.append((ax - h, cy - h, cy + h, side_group(cv)))


def s_hook(cv, p, up):
    """An S-shaped stroke rising (or falling) from p, ending in a curl or a ring."""
    rng = cv.rng
    h = rng.uniform(0.18, 0.3) * (-1 if up else 1); w = rng.uniform(0.08, 0.16) * rng.choice([1, -1])
    q = (p[0] + w, p[1] + h)
    pts = [p, (p[0], p[1] + h * 0.45), (q[0], p[1] + h * 0.55), q]
    ms = [{'t': 'bez', 'p': rnd(pts)}]
    u = (0, -1 if up else 1)
    ms += terminal(rng, q, u, rng.choice(['spiral', 'spiral', 'ring', 'cross']))
    return cv.add(ms, contacts=[p], note='S-hook')


def g_cursive(cv):
    rng = cv.rng; A = cv.A
    main = pick(rng, {'zbend': 0.3, 'loop': 0.35, 'wave': 0.2, 'crook': 0.15})
    y = rng.uniform(0.42, 0.58); x0 = rng.uniform(0.1, 0.18); x1 = A - rng.uniform(0.1, 0.18)
    if main == 'zbend':
        ya = rng.uniform(0.2, 0.32); yb = rng.uniform(0.68, 0.8)
        xa = x0 + rng.uniform(0.0, 0.15); xb = x1 - rng.uniform(0.15, 0.35)
        xc = x0 + rng.uniform(0.15, 0.35); xd = x1 - rng.uniform(0.0, 0.15)
        cv.add([{'t': 'pline', 'p': rnd([(xa, ya), (xb, ya), (xc, yb), (xd, yb)])}], force=True, note='Z-bend')
        cv.socket((xa, ya), (-1, 0), 'center'); cv.socket((xd, yb), (1, 0), 'center')
        cv.rails.append((xa, xb, ya, 'center')); cv.rails.append((xc, xd, yb, 'center'))
    elif main == 'wave':
        amp = rng.uniform(0.1, 0.18) * rng.choice([1, -1]); w = x1 - x0
        p = [(x0, y), (x0 + w * 0.25, y - amp * 1.6), (x0 + w * 0.42, y - amp * 1.6), (x0 + w * 0.5, y),
             (x0 + w * 0.58, y + amp * 1.6), (x0 + w * 0.75, y + amp * 1.6), (x1, y)]
        cv.add([{'t': 'bez', 'p': rnd(p)}], force=True, note='S-wave')
        cv.socket((x0, y), (-1, 0), 'center'); cv.socket((x1, y), (1, 0), 'center')
        r = rng.uniform(0.12, 0.2); cx = x0 + w * rng.choice([0.25, 0.75])
        cv.add([{'t': 'arc', 'c': rnd((cx, y - amp * 1.2 * (1 if cx < x0 + w / 2 else -1))), 'r': rnd([r * 1.3, r]), 'a': [0, 360]}],
               note='loop on the wave')
    elif main == 'crook':
        xs = x0 + rng.uniform(0.15, 0.3)
        cv.add([L((x0, y), (x1, y)), L((xs, 0.85), (xs, 0.3))], force=True, note='rail and crook')
        r0 = rng.uniform(0.09, 0.14)
        cv.add([{'t': 'spiral', 'c': rnd((xs + r0, 0.3)), 'r': rnd([r0, r0 * 0.25]), 'a': [180, 420]}], force=True)
        cv.socket((x0, y), (-1, 0), 'center'); cv.socket((x1, y), (1, 0), 'center'); cv.socket((xs, 0.85), (0, 1), 'center')
        cv.rails.append((x0, x1, y, 'center')); cv.posts.append((xs, 0.3, 0.85, 'center'))
    else:
        cv.add([L((x0, y), (x1, y))], force=True, note='rail')
        rx = rng.uniform(0.2, 0.32); ry = rng.uniform(0.12, 0.2); cxl = rng.uniform(x0 + rx, x1 - rx)
        cv.add([{'t': 'arc', 'c': rnd((cxl, y)), 'r': rnd([rx, ry]), 'a': [0, 360]}], force=True, note='elliptical loop on the rail')
        cv.socket((x0, y), (-1, 0), 'center'); cv.socket((x1, y), (1, 0), 'center')
        cv.rails.append((x0, x1, y, 'center'))
    # curls at the ends are the cursive family's commonest terminal
    for s in list(cv.sockets):
        if rng.random() < 0.7:
            cv.sockets.remove(s); place_terminal(cv, s, kinds=['spiral', 'ring'])
    for _ in range(rng.choice([1, 2, 2, 3])):
        if cv.rails:
            a, b, yy, _g = rng.choice(cv.rails)
            s_hook(cv, (rng.uniform(a + 0.05, b - 0.05), yy), up=rng.random() < 0.6)


GRAMMARS = {'axial': g_axial, 'comb': g_comb, 'bowl': g_bowl, 'compartment': g_compartment, 'radial': g_radial, 'cursive': g_cursive}
# Share of the family's drawings on the sheet with sym_lr > 0.8 (axial 0.62,
# comb 0.18, bowl 0.46, compartment 0.22, radial 0.5, cursive 0), raised a
# little because half of the mirrored seals get one-sided extras.
MIRROR_P = {'axial': 0.72, 'comb': 0.3, 'bowl': 0.6, 'compartment': 0.32, 'radial': 0.7, 'cursive': 0.0}


def family_aspects(family):
    """Aspects of the family's drawings on the sheet (data/features.csv)."""
    import csv
    fam = json.loads((ROOT / 'data' / 'families_by_eye.json').read_text(encoding='utf-8'))['by_identity']
    return [float(r['aspect']) for r in csv.DictReader(open(ROOT / 'data' / 'features.csv', encoding='utf-8'))
            if fam[str(int(r['identity']))] == family]


ASPECTS = {f: family_aspects(f) for f in FAMILY_COUNTS}


# ---------- normalisation to the encoding convention ----------

def transform(m, k, dx, dy):
    m = json.loads(json.dumps(m)); t = m['t']
    P = lambda p: [rnd((p[0] + dx) * k), rnd((p[1] + dy) * k)]
    if t == 'line':
        a = P(m['p'][:2]); b = P(m['p'][2:]); m['p'] = a + b
    elif t in ('pline', 'bez', 'tri', 'path'):
        m['p'] = [P(p) for p in m['p']]
    elif t in ('arc', 'ring', 'dot', 'cross', 'spiral', 'crescent'):
        m['c'] = P(m['c'])
        if 'r' in m:
            m['r'] = rnd(np.array(m['r']) * k) if isinstance(m['r'], list) else rnd(m['r'] * k)
        if 'ri' in m:
            m['ri'] = rnd(m['ri'] * k)
        if 's' in m:
            m['s'] = rnd(m['s'] * k)
    elif t == 'repeat':
        m['d'] = [rnd(m['d'][0] * k), rnd(m['d'][1] * k)]
        m['m'] = [transform(x, k, dx, dy) for x in m['m']]
    elif t == 'mirror':
        m['at'] = rnd((m['at'] + (dx if m['axis'] == 'x' else dy)) * k)
        m['m'] = [transform(x, k, dx, dy) for x in m['m']]
    if 'w' in m:
        m['w'] = rnd(m['w'] * k)
    return m


def normalise(enc):
    big = 400; pad = 40
    img = sigil.render(enc, big, pad=pad, exact=True) < 128
    ys, xs = np.nonzero(img)
    x0 = (xs.min() - pad) / big; x1 = (xs.max() + 1 - pad) / big
    y0 = (ys.min() - pad) / big; y1 = (ys.max() + 1 - pad) / big
    k = 1.0 / (y1 - y0)
    enc['members'] = [transform(m, k, -x0, -y0) for m in enc['members']]
    enc['aspect'] = rnd((x1 - x0) * k, 3)
    enc['stroke'] = rnd(min(0.046, max(0.026, enc['stroke'] * k)), 4)   # encodings' q10..max
    return enc


# ---------- one seal ----------

def generate_one(rng, family, ident):
    for attempt in range(20):
        A = min(1.9, max(0.85, rng.choice(ASPECTS[family]) * rng.uniform(0.88, 1.0)))
        stroke = max(0.025, min(0.045, empirical(rng, 'stroke')))
        mirror = rng.random() < MIRROR_P[family]
        cv = Canvas(rng, A, stroke, mirror)
        GRAMMARS[family](cv)
        fam_totals = [r['total'] for r in PER if r['family'] == family] or [r['total'] for r in PER]
        target = rng.choice(fam_totals) * rng.uniform(0.95, 1.25)
        decorate(cv, target)
        if cv.count < 12:
            continue
        enc = {'id': ident, 'identity': None, 'variant': None, 'name': None, 'vocab': '1.0',
               'aspect': A, 'stroke': stroke, 'family': family, 'generated': True,
               'members': cv.members(), 'escapes': [],
               'notes': f'{family}{" (mirrored)" if mirror else ""}: ' + '; '.join(dict.fromkeys(cv.log)) + '.',
               'target_primitives': int(round(target))}
        return normalise(enc)
    raise RuntimeError('no seal after 20 attempts')


def family_plan(rng, n):
    fams = [f for f, k in FAMILY_COUNTS.items() for _ in range(k)]
    if n != 72:
        fams = [rng.choice(fams) for _ in range(n)]
    rng.shuffle(fams)
    return fams


def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    seed = int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 1
    n = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 72
    rng = random.Random(seed)
    for p in out.glob('g*.json'):
        p.unlink()
    for i, fam in enumerate(family_plan(rng, n), 1):
        ident = f'g{i:02d}'
        enc = generate_one(random.Random(rng.random()), fam, ident)
        enc['seed'] = seed
        (out / f'{ident}.json').write_text(json.dumps(enc, indent=1), encoding='utf-8', newline='\n')
        print(ident, fam, 'primitives', len(sigil.expand(enc['members'])), 'aspect', enc['aspect'])


if __name__ == '__main__':
    main()
