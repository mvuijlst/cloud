// Girih tilings: the five tiles of Persian and Timurid strapwork, all with edges of one length
// and corners in steps of 36°: a regular decagon and pentagon, a rhomb of 72°, a hexagon of
// 72° and 144° corners, and a bowtie of 72° corners with two reflex ones of 216°. Each carries
// straps that cross every edge at its middle at 54°, so any edge-to-edge assembly of them
// joins its strapwork across all edges. A floor is grown outwards from the centre, one tile at
// a time, always where the gap is tightest, backing off where it cannot go on. Nothing
// repeats.
//
// Points are kept exactly, as integer combinations of 1, ζ, ζ², ζ³ with ζ = e^(iπ/5) (since
// ζ⁴ = ζ³ − ζ² + ζ − 1), so that corners meet exactly and a vertex is a string key.

const ZETA = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [-1, 1, -1, 1]];
// the unit step in direction k·36°
const STEP = Array.from({ length: 10 }, (_, k) => k < 5 ? ZETA[k] : ZETA[k - 5].map(x => -x));
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2], p[3] + q[3]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2], p[3] - q[3]];
const key = p => p.join(',');
const COS = [0, 1, 2, 3].map(i => Math.cos(i * Math.PI / 5)), SIN = [0, 1, 2, 3].map(i => Math.sin(i * Math.PI / 5));
const toXY = p => [p[0] * COS[0] + p[1] * COS[1] + p[2] * COS[2] + p[3] * COS[3], p[0] * SIN[0] + p[1] * SIN[1] + p[2] * SIN[2] + p[3] * SIN[3]];

// corners in steps of 36°, counter-clockwise
export const GIRIH = {
  decagon: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  pentagon: [3, 3, 3, 3, 3],
  rhombus: [2, 3, 2, 3],
  hexagon: [2, 4, 4, 2, 4, 4],
  bowtie: [2, 2, 6, 2, 2, 6],
};

// a tile's corners walked from the origin, its first edge in direction d
function walk(ang, d) {
  const pts = [[0, 0, 0, 0]], dirs = [];
  for (let i = 0; i < ang.length - 1; i++) {
    dirs.push(d);
    pts.push(add(pts[pts.length - 1], STEP[d]));
    d = (d + 5 - ang[i + 1] + 10) % 10;
  }
  dirs.push(d);
  return { pts, dirs };
}

// The tile's shape in its own frame (edge 1, centred on its centre of area) and, for the
// bowtie, the two points where the straps from its reflex corners cross: Hankin's rays there
// diverge, and each meets the ray from the matching edge at the other reflex corner.
export function girihShape(type) {
  const ang = GIRIH[type];
  const { pts } = walk(ang, 0);
  const v = pts.map(toXY);
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length], w = a[0] * b[1] - b[0] * a[1];
    A += w; cx += (a[0] + b[0]) * w; cy += (a[1] + b[1]) * w;
  }
  const c = [cx / (3 * A), cy / (3 * A)];
  const poly = v.map(p => [p[0] - c[0], p[1] - c[1]]);
  let cross = null;
  const reflex = ang.map((a, i) => a > 5 ? i : -1).filter(i => i >= 0);
  if (reflex.length === 2) {
    const n = poly.length, mid = i => [(poly[i][0] + poly[(i + 1) % n][0]) / 2, (poly[i][1] + poly[(i + 1) % n][1]) / 2];
    // the ray from the middle of edge e (from corner e to e+1) leaning towards corner `to`
    const ray = (e, to) => {
      const a = poly[e], b = poly[(e + 1) % n], t = [b[0] - a[0], b[1] - a[1]], nn = [-t[1], t[0]];
      const s = to === e ? -1 : 1, cs = Math.cos(54 * Math.PI / 180), sn = Math.sin(54 * Math.PI / 180);
      return { o: mid(e), d: [s * cs * t[0] + sn * nn[0], s * cs * t[1] + sn * nn[1]] };
    };
    const meet = (A, B) => {
      const den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
      const t = ((B.o[0] - A.o[0]) * B.d[1] - (B.o[1] - A.o[1]) * B.d[0]) / den;
      return [A.o[0] + A.d[0] * t, A.o[1] + A.d[1] * t];
    };
    const [r1, r2] = reflex;
    // into r1 pairs with out of r2; out of r1 with into r2
    cross = [meet(ray((r1 + n - 1) % n, r1), ray(r2, r2)), meet(ray(r1, r1), ray((r2 + n - 1) % n, r2))];
  }
  return { poly, cross, centre: c };
}

// Grow a girih tiling over a rectangle [x0, y0, x1, y1] (in edges). weights: per tile type;
// rosettes: how often a step first tries to set a decagon at a wide corner (0 to 1).
// Returns tiles as { type, rot, xy, at }: corners and centre in edges, the shape turned by rot·36°.
export function growGirih(rng, rect, weights, rosettes = 0, maxSteps = 200000) {
  const types = Object.keys(weights).filter(t => weights[t] > 0);
  const shapes = {};
  for (const t of types) shapes[t] = girihShape(t);
  // per tile type and rotation: corners relative to the first, and their float form
  const forms = {};
  for (const t of types) forms[t] = Array.from({ length: 10 }, (_, d) => walk(GIRIH[t], d));
  const tiles = new Set();          // { type, rot, pts (exact), xy (float), c (float centre), r }
  const filled = new Map();         // vertex key -> 36° steps filled
  const edges = new Map();          // directed edge "a|b" -> count (tile edges, counter-clockwise)
  const boundary = new Map();       // the patch's open edges "a|b" -> [a, b]
  const vxy = new Map();            // vertex key -> exact point
  const grid = new Map();           // spatial hash of tiles by centre
  const G = 3;
  const cellOf = (x, y) => Math.floor(x / G) + ',' + Math.floor(y / G);
  const near = (x, y, reach = 2) => {
    const out = [], cx = Math.floor(x / G), cy = Math.floor(y / G);
    for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) for (const T of grid.get((cx + i) + ',' + (cy + j)) || []) out.push(T);
    return out;
  };

  // does a candidate overlap a placed tile? (shared edges and corners are fine)
  const inPoly = (P, x, y) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    }
    return c;
  };
  const probes = (P, c) => {
    // points just inside the tile: near each corner and each edge's middle, and the centre
    const out = [c];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const q of [a, m]) {
        // a little way from q towards the inside along the inward normal of the edge
        const t = [b[0] - a[0], b[1] - a[1]];
        out.push([q[0] - t[1] * 0.02 + t[0] * (q === a ? 0.03 : 0), q[1] + t[0] * 0.02 + t[1] * (q === a ? 0.03 : 0)]);
      }
    }
    return out;
  };
  const segX = (a, b, c, d) => {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    const e = 1e-7;
    return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
  };
  // a corner strictly inside another tile's edge: tiles that touch but not edge to edge
  const onEdge = (p, a, b) => {
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    if (t < 1e-6 || t > 1 - 1e-6) return false;
    return Math.hypot(a[0] + (b[0] - a[0]) * t - p[0], a[1] + (b[1] - a[1]) * t - p[1]) < 1e-6;
  };
  const overlaps = (xy, c) => {
    const pr = probes(xy, c);
    for (const T of near(c[0], c[1])) {
      if (Math.hypot(T.c[0] - c[0], T.c[1] - c[1]) > T.r + 1.7) continue;
      for (const p of pr) if (inPoly(T.xy, p[0], p[1])) return true;
      for (const p of T.probes) if (inPoly(xy, p[0], p[1])) return true;
      for (let i = 0; i < xy.length; i++) for (let j = 0; j < T.xy.length; j++) {
        const a = xy[i], b = xy[(i + 1) % xy.length], p = T.xy[j], q = T.xy[(j + 1) % T.xy.length];
        if (segX(a, b, p, q) || onEdge(a, p, q) || onEdge(p, a, b)) return true;
      }
    }
    return false;
  };

  const place = (type, rot, at) => {
    const f = forms[type][rot];
    const pts = f.pts.map(p => add(p, at));
    const xy = pts.map(toXY);
    const c = xy.reduce((s, p) => [s[0] + p[0] / xy.length, s[1] + p[1] / xy.length], [0, 0]);
    const r = Math.max(...xy.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])));
    return { type, rot, pts, xy, c, r, keys: pts.map(key) };
  };
  const commit = T => {
    T.probes = probes(T.xy, T.c);
    const ang = GIRIH[T.type], n = T.pts.length;
    T.keys.forEach((k, i) => { filled.set(k, (filled.get(k) || 0) + ang[i]); vxy.set(k, T.pts[i]); });
    for (let i = 0; i < n; i++) {
      const a = T.keys[i], b = T.keys[(i + 1) % n], e = a + '|' + b, r = b + '|' + a;
      edges.set(e, (edges.get(e) || 0) + 1);
      if (edges.has(r)) boundary.delete(r); else boundary.set(e, [a, b]);
    }
    tiles.add(T);
    const ck = cellOf(T.c[0], T.c[1]);
    if (grid.has(ck)) grid.get(ck).push(T); else grid.set(ck, [T]);
  };
  const remove = T => {
    const ang = GIRIH[T.type], n = T.pts.length;
    tiles.delete(T);
    T.keys.forEach((k, i) => { const f = filled.get(k) - ang[i]; if (f) filled.set(k, f); else { filled.delete(k); vxy.delete(k); } });
    for (let i = 0; i < n; i++) {
      const a = T.keys[i], b = T.keys[(i + 1) % n], e = a + '|' + b, r = b + '|' + a;
      const m = edges.get(e) - 1;
      if (m) edges.set(e, m); else edges.delete(e);
      if (edges.has(r)) boundary.set(r, [b, a]); else boundary.delete(e);
    }
    const ck = cellOf(T.c[0], T.c[1]), list = grid.get(ck);
    list.splice(list.indexOf(T), 1);
  };
  // a corner can be closed only with what is left: 36° fits no girih corner
  const fine = T => T.keys.every((k, i) => { const f = (filled.get(k) || 0) + GIRIH[T.type][i]; return f <= 10 && f !== 9; });
  const fits = T => fine(T) && !overlaps(T.xy, T.c);

  // the open corners: vertices of the patch's boundary, with the boundary edge leaving each
  const openCorners = () => {
    const out = [];
    for (const [a, b] of boundary.values()) {
      // a boundary edge a->b of a tile; outside, a new tile would hold b->a, with its corner at a
      const xy = toXY(vxy.get(a));
      if (xy[0] < rect[0] || xy[0] > rect[2] || xy[1] < rect[1] || xy[1] > rect[3]) continue;
      out.push({ a, b, gap: 10 - filled.get(a), d: Math.hypot(xy[0], xy[1]) });
    }
    return out;
  };

  // the tiles that could go at an open corner: corner i at a and corner i-1 at b, the tile's
  // angle at a within the gap, in a random order weighted by type
  const candidates = o => {
    const A = vxy.get(o.a), B = vxy.get(o.b);
    const ba = sub(A, B);
    const dir = STEP.findIndex(s => s.every((x, i) => x === ba[i]));
    const out = [];
    for (const t of types) {
      const ang = GIRIH[t];
      for (let i = 0; i < ang.length; i++) {
        if (ang[i] > o.gap || o.gap - ang[i] === 1) continue;
        const j = (i + ang.length - 1) % ang.length;
        for (let rot = 0; rot < 10; rot++) {
          if (forms[t][rot].dirs[j] !== dir) continue;
          out.push({ t, rot, at: sub(B, forms[t][rot].pts[j]), w: weights[t] * rng() });
        }
      }
    }
    return out.sort((p, q) => q.w - p.w);
  };
  const cornerAt = (a, b) => ({ a, b, gap: 10 - filled.get(a) });
  // after placing T: every tight open corner it touches must still take some tile
  const stillOpen = T => {
    for (const [a, b] of boundary.values()) {
      if (!T.keys.includes(a)) continue;
      const o = cornerAt(a, b);
      if (o.gap > 3) continue;
      const xy = toXY(vxy.get(a));
      if (xy[0] < rect[0] || xy[0] > rect[2] || xy[1] < rect[1] || xy[1] > rect[3]) continue;
      if (!candidates(o).some(c => fits(place(c.t, c.rot, c.at)))) return false;
    }
    return true;
  };

  const seedType = types.includes('decagon') ? 'decagon' : 'hexagon';
  commit(place(seedType, Math.floor(rng() * 10), [0, 0, 0, 0]));
  let steps = 0, repair = 1.5, lastStuck = null;
  for (;;) {
    if (++steps > maxSteps) break;
    const open = openCorners();
    if (!open.length) break;
    // tight corners (108° or less) first, the tightest first; then outwards from the centre,
    // which leaves wide corners where a decagon can go
    open.sort((p, q) => (Math.min(p.gap, 4) - Math.min(q.gap, 4)) || p.d - q.d);
    let done = false;
    // now and then a decagon first, at the wide corner nearest the centre; tight corners are
    // filled as they come, so a decagon rarely finds room otherwise
    if (types.includes('decagon') && rng() < rosettes) {
      const w = open.filter(c => c.gap >= 4).sort((p, q) => p.d - q.d)[0];
      if (w) for (const c of candidates(w)) {
        if (c.t !== 'decagon') continue;
        const T = place(c.t, c.rot, c.at);
        if (!fits(T)) continue;
        commit(T);
        if (stillOpen(T)) { done = true; break; }
        remove(T);
      }
      if (done) continue;
    }
    const o = open[0];
    for (const c of candidates(o)) {
      const T = place(c.t, c.rot, c.at);
      if (!fits(T)) continue;
      commit(T);
      if (stillOpen(T)) { done = true; break; }
      remove(T);
    }
    if (done) { repair = Math.max(1.5, repair * 0.95); continue; }
    // stuck: lift the tiles round the corner, further each time it happens near the same place
    const p = toXY(vxy.get(o.a));
    if (lastStuck && Math.hypot(p[0] - lastStuck[0], p[1] - lastStuck[1]) < repair) repair = Math.min(repair * 1.5, 8);
    lastStuck = p;
    for (const T of near(p[0], p[1], Math.ceil(repair / G) + 1)) {
      if (Math.hypot(T.c[0] - p[0], T.c[1] - p[1]) < repair + T.r) remove(T);
    }
    if (!tiles.size) commit(place(seedType, Math.floor(rng() * 10), [0, 0, 0, 0]));
  }
  const complete = openCorners().length === 0;
  return { complete, steps, tiles: [...tiles].map(T => ({ type: T.type, rot: T.rot, xy: T.xy, at: T.c })) };
}
