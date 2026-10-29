// Floors as lists of stones in laying order. Every stone is one of a few shape classes
// (a triangle, a square, a hexagon, a rhomb), placed by a 2×2 map from the class's own
// frame (centred, millimetres, y down) into the floor. Stones of a class share a pool of
// baked appearances; the map turns or mirrors them into place.
//
// Each tiling makes its choices (design, rule, shape) through choose(slot, [[name, weight]…]),
// which main.js steers away from what recent floors used, and which always draws one random
// number so that a floor can be replayed from its seed and its choices.
import { samplePattern, layingOrder, LETTERS } from './pattern.js';
import { growGirih, girihShape } from './girih.js';

// families: the materials a tiling can be laid in (stone, cement tiles, fired clay)
export const TILINGS = {
  douat: { name: 'half squares', families: ['stone', 'clay'], weight: 4 },
  smith: { name: 'quarter circles', families: ['cement'], weight: 2 },
  loops: { name: 'Truchet arcs', families: ['cement'], weight: 2 },
  hex: { name: 'hexagons', families: ['cement'], weight: 2 },
  cubes: { name: 'cubes', families: ['stone', 'clay'], weight: 3 },
  penrose: { name: 'Penrose rhombs', families: ['stone', 'clay'], weight: 2 },
  arcs: { name: 'Penrose arcs', families: ['cement'], weight: 2 },
  ammann: { name: 'Ammann–Beenker', families: ['stone', 'clay'], weight: 3 },
  pinwheel: { name: 'pinwheel triangles', families: ['stone', 'clay'], weight: 3 },
  opus: { name: 'stones of several sizes', families: ['stone', 'clay'], weight: 3 },
  girih: { name: 'girih', families: ['glaze', 'cement'], weight: 3 },
};

const rot = t => [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t)];   // column-major 2×2
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3]];
const I2 = [1, 0, 0, 1];
const FLIP_Y = [1, 0, 0, -1];
const inRect = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
// how far a point lies outside a rectangle (0 inside), the measure of the rings around it
const outside = (p, r) => Math.max(r[0] - p[0], p[0] - r[2], r[1] - p[1], p[1] - r[3], 0);
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const mod = (a, n) => ((a % n) + n) % n;
// a fair coin per grid position (a full 32-bit mix, so neighbours are independent)
function coin(i, j, seed) {
  let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 31) & 1;
}
const name = (choose, slot, options) => options[choose(slot, options)][0];

// Without a record to consult: a plain weighted draw.
export function plainChooser(rng) {
  return (slot, options) => {
    let x = rng() * options.reduce((a, o) => a + o[1], 0), i = 0;
    while (i < options.length - 1 && (x -= options[i][1]) > 0) i++;
    return i;
  };
}

// Lay the pattern area first in the given order, then everything else by distance from it.
function finish(stones, inner, innerOrder) {
  const a = stones.filter(s => !s.outer), b = stones.filter(s => s.outer);
  a.sort(innerOrder);
  b.sort((p, q) => p.ring - q.ring || p.turn - q.turn);
  return a.concat(b);
}
const turnOf = (c) => (Math.atan2(c[1], c[0]) + Math.PI * 2.75) % (Math.PI * 2);
const byDistance = (p, q) => p.d - q.d;
// a stone at a point: outer or not, its ring, and the side the mason brings it from
function placed(center, view, step, extra) {
  const inner = view.rect;
  return {
    center, outer: !inRect(center, inner), ring: Math.ceil(outside(center, inner) / step), turn: turnOf(center),
    from: unit(center[0], center[1]), d: Math.hypot(center[0], center[1]), ...extra,
  };
}

// ---------------------------------------------------------------- Douat's half squares
function douat(rng, view) {
  const P = view.pitch, h = P / 2;
  const tri = [[-h, h], [-h, -h], [h, h]];              // right angle bottom-left: state A
  // reflection in the triangle's own axis, through the right angle
  const S = [0, -1, -1, 0];
  const pat = samplePattern(rng, view.NX, view.NY);
  const inner = layingOrder(rng, view.NX, view.NY, pat.centred);
  const { NX, NY, M, RX, RY } = view;
  const cells = inner.cells.map(([i, j]) => [i + M, j + M]);
  for (let r = 1; r <= M; r++) {
    const x0 = M - r, y0 = M - r, x1 = M + NX - 1 + r, y1 = M + NY - 1 + r;
    for (let x = x0; x < x1; x++) cells.push([x, y0]);
    for (let y = y0; y < y1; y++) cells.push([x1, y]);
    for (let x = x1; x > x0; x--) cells.push([x, y1]);
    for (let y = y1; y > y0; y--) cells.push([x0, y]);
  }
  const state = (i, j) => pat.at(i - M, j - M);
  const laid = new Set();
  const has = (i, j) => laid.has(i + ',' + j);
  const stones = [];
  const cx = RX / 2, cy = RY / 2;
  cells.forEach(([i, j], n) => {
    const st = state(i, j);
    // in each square, first the half that meets laid work
    const nb = [has(i - 1, j), has(i, j - 1), has(i + 1, j), has(i, j + 1)];
    const darkEdges = [[0, 3], [0, 1], [1, 2], [2, 3]][st];
    const ds = darkEdges.reduce((a, e) => a + (nb[e] ? 1 : 0), 0);
    const ls = [0, 1, 2, 3].filter(e => !darkEdges.includes(e)).reduce((a, e) => a + (nb[e] ? 1 : 0), 0);
    const first = ds > ls ? 0 : ds < ls ? 1 : (rng() < 0.5 ? 0 : 1);
    const outer = n >= NX * NY;
    const center = [view.roomOrigin[0] + (i + 0.5) * P, view.roomOrigin[1] + (j + 0.5) * P];
    let from;
    if (outer || inner.mode === 'centre') from = unit(i + 0.5 - cx, j + 0.5 - cy);
    else if (inner.mode === 'rows') from = [0, 1];
    else from = unit(1, 1);
    for (const k of [first, 1 - first]) {
      const corner = k === 0 ? st : (st + 2) & 3;
      const L = mul(rot(corner * Math.PI / 2), rng() < 0.5 ? I2 : S);
      stones.push({ cls: k === 0 ? 'dark' : 'light', center, L, outer, from });
    }
    laid.add(i + ',' + j);
  });
  const how = inner.mode === 'centre' ? 'out from the centre' : inner.mode === 'rows' ? 'row by row' : 'along the diagonal';
  return {
    classes: { dark: { poly: tri, dark: true }, light: { poly: tri, dark: false } },
    stones,
    describe: pat.describe,
    how: `${NX}×${NY} squares laid ${how}, then ring by ring out to ${RX}×${RY}`,
  };
}

// ---------------------------------------------------------------- square cement tiles
// The square tiles of the room, with the pattern area's place in tile units.
function squareCells(view, P) {
  const room = view.roomRect, inner = view.rect;
  const i0 = Math.floor(room[0] / P), i1 = Math.ceil(room[2] / P), j0 = Math.floor(room[1] / P), j1 = Math.ceil(room[3] / P);
  const cells = [];
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const center = [(i + 0.5) * P, (j + 0.5) * P];
    if (inRect(center, room)) cells.push({ i, j, ...placed(center, view, P) });
  }
  return {
    cells, ni: Math.round((inner[2] - inner[0]) / P), nj: Math.round((inner[3] - inner[1]) / P),
    ii: Math.round(inner[0] / P), jj: Math.round(inner[1] / P),
  };
}
const rowByRow = (p, q) => p.center[1] - q.center[1] || p.center[0] - q.center[0];

// A turn per tile, 0-3: a fair coin (two of them), or one of Douat's compositions of the
// pattern area carried on beyond it.
function squareRule(rng, choose, grid, extra = []) {
  const rule = name(choose, 'rule', [['at random', 2], ["by Douat's rule", 3], ...extra.map(e => [e[0], e[1]])]);
  if (rule === 'at random') {
    const sd = Math.floor(rng() * 2 ** 31);
    return { at: (i, j) => coin(i, j, sd) + 2 * coin(i, j, sd ^ 0x5bd1e995), text: 'each tile turned at random' };
  }
  if (rule === "by Douat's rule") {
    const pat = samplePattern(rng, grid.ni, grid.nj);
    return { at: (i, j) => pat.at(i - grid.ii, j - grid.jj), text: `turned by Douat's rule: ${pat.describe}` };
  }
  const e = extra.find(x => x[0] === rule);
  return { at: e[2], text: e[3] };
}

// Smith's quarter circles: a disc quarter in two opposite corners, each tile printed light on
// dark or dark on light so that the colour fields meet across every edge. Two variations come
// from the Truchet tile grammar (Walter, Ligler and Gürsoy 2024): the arcs outlined in a third
// pigment, and a tile with one round and one straight corner, which has four orientations
// instead of two and so carries Douat's compositions in full.
function smith(rng, view, choose) {
  const P = 200, h = P / 2;
  const sq = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const S = [0, 1, 1, 0];                               // reflection in the disc diagonal
  const design = name(choose, 'design', [['discs', 3], ['outlined discs', 2], ['round and straight corners', 2]]);
  const grid = squareCells(view, P);
  const { at, text } = squareRule(rng, choose, grid);
  const mixed = design === 'round and straight corners';
  const stones = grid.cells.map(c => {
    const k = at(c.i, c.j);
    const o = k & 1;                                    // which diagonal carries the corners
    // each region takes the colour of the grid corners it touches: corner (i, j) parity
    const discParity = (c.i + c.j + o) & 1;
    const turn = mixed ? k * Math.PI / 2 : o * Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0);
    const L = mul(rot(turn), rng() < 0.5 ? I2 : S);
    return { ...c, cls: discParity === 0 ? 'discsDark' : 'discsLight', L };
  });
  const cls = v => ({ poly: sq, cement: true, design: mixed ? 5 : 1, dsize: h, variant: v, dp: [design === 'outlined discs' ? 9 : 0, 0] });
  const what = mixed ? 'quarter circles and straight corners' : design === 'outlined discs' ? 'quarter circles outlined in a third colour' : 'quarter circles';
  return {
    classes: { discsDark: cls(0), discsLight: cls(1) },
    stones: finish(stones, view.rect, rowByRow),
    describe: `${what}, ${text}`,
    how: `${grid.ni}×${grid.nj} tiles of 20 cm laid row by row, then ring by ring into the room`,
  };
}

// Truchet's arcs as bands: two quarter-circle bands round opposite corners, so every tile
// passes two lines on, and the lines close into loops and meanders.
function loops(rng, view, choose) {
  const P = 200, h = P / 2;
  const sq = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const S = [0, 1, 1, 0];
  const style = name(choose, 'design', [['bands', 3], ['bands with a centre line', 2]]);
  const ground = name(choose, 'printing', [['light ground', 3], ['dark ground', 1]]);
  const grid = squareCells(view, P);
  const { at, text } = squareRule(rng, choose, grid, [
    ['in circles', 1, (i, j) => (i + j) & 1, 'turned so that the arcs close into circles'],
    ['in waves', 1, (i, j) => (i & 1) ^ ((j >> 1) & 1), 'turned in waves'],
  ]);
  const stones = grid.cells.map(c => {
    const o = at(c.i, c.j) & 1;
    const L = mul(rot(o * Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0)), rng() < 0.5 ? I2 : S);
    return { ...c, cls: 'loop', L };
  });
  return {
    classes: { loop: { poly: sq, cement: true, design: 4, dsize: h, variant: ground === 'dark ground' ? 1 : 0, dp: [34, style === 'bands' ? 0 : 8] } },
    stones: finish(stones, view.rect, rowByRow),
    describe: `Truchet's arcs as ${style} on a ${ground}, ${text}`,
    how: `${grid.ni}×${grid.nj} tiles of 20 cm laid row by row, then ring by ring into the room`,
  };
}

// ---------------------------------------------------------------- hexagons
// Rules for a two-way choice on a hexagonal lattice, axial coordinates (q, r).
function hexRule(rng, choose, extra = []) {
  const rules = [
    ['at random', 3, () => { const sd = Math.floor(rng() * 2 ** 31); return (q, r) => coin(q, r, sd); }],
    ['in rings round the centre', 1, () => { const s = rng() < 0.5 ? 0 : 1; return (q, r) => (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) >> s) & 1; }],
    ['in columns', 1, () => { const w = 1 + Math.floor(rng() * 2); return (q) => Math.floor(mod(q, 2 * w) / w); }],
    ['one in three alike', 1, () => (q, r) => mod(q - r, 3) === 0 ? 1 : 0],
    ['in diagonal bands', 1, () => { const w = 1 + Math.floor(rng() * 3); return (q, r) => Math.floor(mod(q + 2 * r, 2 * w) / w); }],
    ...extra,
  ];
  const i = choose('rule', rules.map(r => [r[0], r[1]]));
  return { at: rules[i][2](), text: rules[i][0] };
}

// Hexagonal cement tiles: three arcs round alternate corners, either as a band, or as the
// edges of colour fields (the hexagonal form of Smith's tile, printed light on dark or dark
// on light so that the fields meet across edges).
function hexes(rng, view, choose) {
  const a = 115;                                        // edge; 20 cm across the flats
  const hexPoly = Array.from({ length: 6 }, (_, k) => [a * Math.cos(k * Math.PI / 3), a * Math.sin(k * Math.PI / 3)]);
  const S = FLIP_Y;                                     // reflection through corner 0 keeps the arcs
  const room = view.roomRect;
  const design = name(choose, 'design', [['bands', 3], ['bands with a centre line', 1], ['fields', 3], ['outlined fields', 1]]);
  const fields = design.endsWith('fields');
  const ground = fields ? '' : name(choose, 'printing', [['light ground', 3], ['dark ground', 1]]);
  const { at, text } = hexRule(rng, choose);
  const stones = [];
  const qmax = Math.ceil(Math.max(-room[0], room[2]) / (1.5 * a)) + 1;
  const rmax = Math.ceil(Math.max(-room[1], room[3]) / (Math.sqrt(3) * a)) + qmax;
  for (let q = -qmax; q <= qmax; q++) for (let r = -rmax; r <= rmax; r++) {
    const center = [1.5 * a * q, Math.sqrt(3) * a * (r + q / 2)];
    if (!inRect(center, room)) continue;
    const o = at(q, r);
    const L = mul(rot(o * Math.PI / 3 + Math.floor(rng() * 3) * 2 * Math.PI / 3), rng() < 0.5 ? I2 : S);
    // fields: tiles turned a sixth are printed the other way round, which keeps all corners of
    // one class of the honeycomb dark and the others light
    stones.push({ ...placed(center, view, 1.7 * a), cls: fields ? (o ? 'hexB' : 'hexA') : 'hex', L });
  }
  const outline = design === 'outlined fields' ? 8 : 0;
  const classes = fields
    ? { hexA: { poly: hexPoly, cement: true, design: 3, dsize: a, variant: 0, dp: [outline, 0] },
        hexB: { poly: hexPoly, cement: true, design: 3, dsize: a, variant: 1, dp: [outline, 0] } }
    : { hex: { poly: hexPoly, cement: true, design: 2, dsize: a, variant: ground === 'dark ground' ? 1 : 0, dp: [0, design === 'bands' ? 0 : 7] } };
  return {
    classes,
    stones: finish(stones, view.rect, byDistance),
    describe: fields ? `hexagons with ${design === 'fields' ? '' : 'outlined '}colour fields round alternate corners, turned ${text}`
      : `hexagons with three arcs each as ${design} on a ${ground}, turned ${text}`,
    how: 'hexagonal tiles of 20 cm laid out from the centre into the room',
  };
}

// ---------------------------------------------------------------- cubes
// Rhombs of 60° in three stones, light, middle and dark by which way they face: a lozenge
// tiling, seen as a surface of cubes. Three ways to make one:
//  blocks:   hexagons each split into three rhombs one of two ways, a cube or a hollow
//            (a Truchet tile on the hexagon), by a rule;
//  pile:     a stack of cubes in a corner drawn uniformly at random (a random plane partition,
//            by many single-cube moves), whose middle is disordered and whose corners freeze
//            into flat walls (the arctic circle of Cohn, Larsen and Propp);
//  terraces / stairs: stacks shaped by two random staircases.
function cubes(rng, view, choose) {
  const E = 160;                                        // rhomb edge, mm
  const s3 = Math.sqrt(3);
  // the three axes of the cubes, seen from above along their diagonal
  const X = [s3 / 2 * E, E / 2], Y = [-s3 / 2 * E, E / 2], Z = [0, -E];
  const P3 = (x, y, z) => [x * X[0] + y * Y[0] + z * Z[0], x * X[1] + y * Y[1] + z * Z[1]];
  const D = E * s3;
  const rhomb = [[D / 2, 0], [0, E / 2], [-D / 2, 0], [0, -E / 2]];
  // a face by its normal: tops (z) light and level, faces to the right (x) dark, to the left (y) middle
  const TURN = { z: 0, x: 2 * Math.PI / 3, y: Math.PI / 3 };
  const CLS = { z: 'top', x: 'right', y: 'left' };
  const room = view.roomRect;
  const shape = name(choose, 'shape', [['blocks', 3], ['a random pile', 3], ['terraces', 1], ['stairs', 1]]);
  const faces = [];
  let text;
  if (shape === 'blocks') {
    const { at, text: t } = hexRule(rng, choose, [['all cubes', 1, () => () => 1]]);
    text = t === 'all cubes' ? 'tumbling blocks: every hexagon a cube' : `tumbling blocks: each hexagon a cube or a hollow, ${t}`;
    const qmax = Math.ceil(Math.max(-room[0], room[2]) / (s3 * E)) + 2;
    const rmax = Math.ceil(Math.max(-room[1], room[3]) / (1.5 * E)) + 2;
    for (let r = -rmax; r <= rmax; r++) for (let q = -qmax - rmax; q <= qmax + rmax; q++) {
      const c = [E * s3 * (q + r / 2), E * 1.5 * r];
      if (c[0] < room[0] - 2 * E || c[0] > room[2] + 2 * E) continue;
      const add = (type, x, y, z) => { const p = P3(x, y, z); faces.push([type, [c[0] + p[0], c[1] + p[1]]]); };
      // a cube shows its faces x = 1, y = 1, z = 1; a hollow the faces x = 0, y = 0, z = 0
      const k = at(q, r) ? 1 : 0;
      add('z', 0.5, 0.5, k); add('x', k, 0.5, 0.5); add('y', 0.5, k, 0.5);
    }
  } else {
    // a box of n³ whose outline, a hexagon, covers the room
    const hw = Math.max(-room[0], room[2]), hh = Math.max(-room[1], room[3]);
    const n = Math.ceil((hh + hw / s3) / E) + 1;
    const h = new Int16Array(n * n);
    const H = (i, j) => h[i * n + j];
    if (shape === 'a random pile') {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[i * n + j] = Math.max(0, Math.min(n, Math.round(1.5 * n - i - j)));
      // add or take away one cube at a time where the stack allows it
      const steps = 12 * n * n * n * n;
      let x = (rng() * 2 ** 32) >>> 0;
      for (let t = 0; t < steps; t++) {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
        const k = x % (n * n), i = (k / n) | 0, j = k - i * n, v = h[k];
        if (x & 0x80000000) {
          if (v < n && (i === 0 || h[k - n] > v) && (j === 0 || h[k - 1] > v)) h[k] = v + 1;
        } else if (v > 0 && (i === n - 1 || h[k + n] < v) && (j === n - 1 || h[k + 1] < v)) h[k] = v - 1;
      }
      text = 'a random pile of cubes, drawn from all the ways to stack them in a corner';
    } else {
      const stairsOf = () => {
        const f = [];
        let v = n;
        for (let i = 0; i < n; i++) { f.push(v); if (rng() < 0.4) v = Math.max(0, v - 1 - Math.floor(rng() * 3)); }
        return f;
      };
      const F = stairsOf(), G = stairsOf();
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        h[i * n + j] = shape === 'terraces' ? Math.min(F[i], G[j]) : Math.max(0, Math.min(n, F[i] + G[j] - n));
      }
      text = shape === 'terraces' ? 'cubes stacked in terraces' : 'cubes stacked in stairs';
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) faces.push(['z', P3(i + 0.5, j + 0.5, H(i, j))]);
    for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) {
      const lo = i === n ? 0 : H(i, j), hi = i === 0 ? n : H(i - 1, j);
      for (let k = lo; k < hi; k++) faces.push(['x', P3(i, j + 0.5, k + 0.5)]);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j <= n; j++) {
      const lo = j === n ? 0 : H(i, j), hi = j === 0 ? n : H(i, j - 1);
      for (let k = lo; k < hi; k++) faces.push(['y', P3(i + 0.5, j, k + 0.5)]);
    }
  }
  const stones = [];
  const count = { z: 0, x: 0, y: 0 };
  for (const [type, center] of faces) {
    if (!inRect(center, room)) continue;
    count[type]++;
    stones.push({ ...placed(center, view, 1.5 * E), cls: CLS[type], L: mul(rot(TURN[type]), rng() < 0.5 ? I2 : FLIP_Y) });
  }
  return {
    classes: {
      top: { poly: rhomb, dark: false },
      left: { poly: rhomb, mid: true },
      right: { poly: rhomb, dark: true },
    },
    stones: finish(stones, view.rect, byDistance),
    describe: text,
    how: `${stones.length} rhombs of 16 cm in three stones, laid out from the centre`,
  };
}

// ---------------------------------------------------------------- Penrose rhombs
// Robinson triangles subdivided from a sun of ten (Preshing's formulation); each pair
// that shares its base edge BC is one rhomb, thick (72°) or thin (36°).
//
// With arcs: Penrose's own decoration, two families of arcs round the two ends of BC (the
// sharp corners of a thick rhomb, the blunt ones of a thin). What joins across every edge was
// found by testing candidates against all shared edges of a large patch (2,210 edges):
//  - the arcs round B are ρ on thick rhombs and 1 − ρ on thin ones, for any ρ: across an edge
//    between a thick and a thin rhomb, B sits at opposite ends;
//  - the arcs round C have one radius σ, any σ: every rhomb at such a corner has its C there,
//    so these close into rings, and may as well be filled discs;
//  - no colour field bounded by the B arcs joins everywhere, so that family stays lines.
// Line widths, double lines, inks and the size of the rhombs are free. The B lines wind into
// curves that never repeat; this is the aperiodic Truchet tile.

function penroseArcs(rng, view, choose, family) { return penrose(rng, view, choose, family, true); }

function penrose(rng, view, choose, family, arcs = false) {
  // rhomb edge, mm
  const E = arcs ? 10 * parseInt(name(choose, 'size', [['16 cm', 1], ['19 cm', 2], ['22 cm', 1]]), 10) : 190;
  const phi = (1 + Math.sqrt(5)) / 2;
  const room = view.roomRect;
  const R = Math.hypot(Math.max(-room[0], room[2]), Math.max(-room[1], room[3]));
  const n = Math.ceil(Math.log(R * 1.15 / E) / Math.log(phi)) + 1;
  const R0 = E * Math.pow(phi, n);
  const a0 = rng() * Math.PI * 2;
  let tris = [];
  for (let i = 0; i < 10; i++) {
    let B = [R0 * Math.cos(a0 + (2 * i - 1) * Math.PI / 10), R0 * Math.sin(a0 + (2 * i - 1) * Math.PI / 10)];
    let C = [R0 * Math.cos(a0 + (2 * i + 1) * Math.PI / 10), R0 * Math.sin(a0 + (2 * i + 1) * Math.PI / 10)];
    if (i % 2 === 0) [B, C] = [C, B];
    tris.push([0, [0, 0], B, C]);
  }
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const far = R * 1.25;
  for (let k = 0; k < n; k++) {
    const next = [];
    for (const [c, A, B, C] of tris) {
      // prune triangles wholly beyond the room before they multiply
      const m = Math.min(Math.hypot(...A), Math.hypot(...B), Math.hypot(...C));
      if (m > far + 2 * Math.hypot(B[0] - A[0], B[1] - A[1])) continue;
      if (c === 0) {
        const P = lerp(A, B, 1 / phi);
        next.push([0, C, P, B], [1, P, C, A]);
      } else {
        const Q = lerp(B, A, 1 / phi), Rr = lerp(B, C, 1 / phi);
        next.push([1, Rr, C, A], [1, Q, Rr, B], [0, Rr, Q, A]);
      }
    }
    tris = next;
  }
  const key = (p, q) => {
    const k1 = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`, k2 = `${Math.round(q[0] * 10)},${Math.round(q[1] * 10)}`;
    return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
  };
  const halves = new Map();
  for (const t of tris) {
    const k = key(t[2], t[3]);
    if (halves.has(k)) halves.get(k).push(t); else halves.set(k, [t]);
  }
  const thickDark = arcs ? false : name(choose, 'colours', [['thick rhombs dark', 7], ['thin rhombs dark', 3]]) === 'thick rhombs dark';
  const lines = arcs ? name(choose, 'design', [['single lines', 3], ['double lines', 2]]) : '';
  const corners = arcs ? name(choose, 'corners', [['rings', 3], ['double rings', 1], ['dots', 2], ['dots in rings', 1], ['nothing', 1]]) : '';
  const inks = arcs ? name(choose, 'inks', [['two colours', 3], ['two colours swapped', 2], ['one colour', 1], ['a dark ground', 1]]) : '';
  const stones = [];
  let nThick = 0, nThin = 0;
  for (const pair of halves.values()) {
    if (pair.length !== 2) continue;
    const [[, A1, B, C], [, A2]] = pair;
    const center = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    if (!inRect(center, room)) continue;
    // the long diagonal joins the two corners at the sharp angles
    const dBC = Math.hypot(B[0] - C[0], B[1] - C[1]), dAA = Math.hypot(A1[0] - A2[0], A1[1] - A2[1]);
    const [p, q] = dBC > dAA ? [B, C] : [A1, A2];
    const thick = Math.min(dBC, dAA) / Math.max(dBC, dAA) > 0.5;
    if (thick) nThick++; else nThin++;
    const theta = Math.atan2(q[1] - p[1], q[0] - p[0]);
    let L = mul(rot(theta), rng() < 0.5 ? I2 : FLIP_Y);
    if (arcs && !thick) {
      // a thin rhomb's arcs sit at the ends of its short diagonal: C goes to (0, +d/2)
      const r0 = rot(theta);
      L = r0[2] * (C[0] - center[0]) + r0[3] * (C[1] - center[1]) > 0 ? r0 : mul(r0, FLIP_Y);
    }
    // (a thick rhomb's long diagonal runs from B to C, so B is at (−D/2, 0) whichever mirror)
    stones.push({ ...placed(center, view, E), ring: 0, turn: 0, cls: thick ? 'thick' : 'thin', L });
  }
  const rhomb = (ang) => {
    const D = 2 * E * Math.cos(ang / 2), d = 2 * E * Math.sin(ang / 2);
    return [[D / 2, 0], [0, d / 2], [-D / 2, 0], [0, -d / 2]];
  };
  stones.sort(byDistance);
  if (arcs) {
    // widths and radii, drawn until everything fits: the B lines inside the rhomb's height and
    // clear of the C figure across the thin rhomb's short diagonal
    const hwB = 5 + 6 * rng(), hwC = 4 + 6 * rng();
    const extB = lines === 'double lines' ? 2 * hwB + 3 : hwB;
    const cOuter = { rings: hwC, 'double rings': 2 * hwC + 3, dots: 0, 'dots in rings': hwC, nothing: 0 }[corners];
    const cMin = { rings: hwC + 5, 'double rings': 2 * hwC + 8, dots: 18, 'dots in rings': hwC + 16, nothing: 0 }[corners];
    const deg = Math.PI / 180;
    const Dthin = 2 * E * Math.sin(18 * deg), Hthin = E * Math.sin(36 * deg), Hthick = E * Math.sin(72 * deg);
    let rho = 0, sigma = 0, fig = corners;
    for (let t = 0; t < 200 && !rho; t++) {
      const r = 0.52 + 0.36 * rng(), u = rng();
      const bThin = (1 - r) * E;
      if (bThin - extB < 5 || r * E + extB > Hthick - 4 || bThin + extB > Hthin - 4) continue;
      const cMax = Math.min(Dthin - 8 - (bThin + extB), Hthin - 4) - cOuter;
      if (corners !== 'nothing' && cMax <= cMin) continue;
      rho = r;
      sigma = corners === 'nothing' ? 0 : cMin + (cMax - cMin) * u;
    }
    // nothing fitted (rare, with wide double lines on small rhombs): lines alone, mid-sized
    if (!rho) { rho = 0.7; fig = 'nothing'; }
    const style = (lines === 'double lines' ? 2 : 1) + 4 * ['rings', 'double rings', 'dots', 'dots in rings', 'nothing'].indexOf(fig);
    const ink = ['two colours', 'two colours swapped', 'one colour', 'a dark ground'].indexOf(inks);
    const d2 = [hwB, hwC, style, ink];
    const what = `${lines}${fig === 'nothing' ? '' : ' and ' + fig}`;
    return {
      classes: {
        thick: { poly: rhomb(72 * deg), cement: true, design: 6, dsize: E * Math.cos(36 * deg), variant: 0, dp: [rho * E, sigma], d2 },
        thin: { poly: rhomb(36 * deg), cement: true, design: 6, dsize: E * Math.sin(18 * deg), variant: 1, dp: [(1 - rho) * E, sigma], d2 },
      },
      stones,
      describe: `Penrose's arcs as ${what}, ${inks === 'a dark ground' ? 'on' : 'in'} ${inks}: ${nThick} thick and ${nThin} thin rhombs, curves that never repeat`,
      how: `cement rhombs of ${E / 10} cm laid out from the centre`,
    };
  }
  return {
    classes: {
      thick: { poly: rhomb(72 * Math.PI / 180), dark: thickDark },
      thin: { poly: rhomb(36 * Math.PI / 180), dark: !thickDark },
    },
    stones,
    describe: `Penrose rhombs: ${nThick} thick and ${nThin} thin, never repeating`,
    how: `rhombs of 19 cm laid out from the centre; the ${thickDark ? 'thick' : 'thin'} ones in the dark stone`,
  };
}

// ---------------------------------------------------------------- shared by the layouts below
const rectPoly = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
// fewer baked stones for a class of big ones: a floor holds few of them, and they crowd the atlas
function poolSizes(classes) {
  const names = Object.keys(classes);
  for (const k of names) {
    classes[k].pool = Math.max(6, Math.min(56, Math.round(classes[k].n / 2), Math.floor(100 / names.length)));
    delete classes[k].n;
  }
  return classes;
}

// Rectangles {x, y, w, h} as stones, in classes by size and by tone ('dark', 'light' or 'mid',
// from toneOf).
function rectStones(rng, view, rects, toneOf) {
  const room = view.roomRect;
  const classes = {}, stones = [];
  for (const r of rects) {
    const c = [r.x + r.w / 2, r.y + r.h / 2];
    if (!inRect(c, room)) continue;
    const a = Math.max(r.w, r.h), b = Math.min(r.w, r.h);
    const tone = toneOf(r);
    const key = `${a}x${b}${tone[0]}`;
    if (!classes[key]) classes[key] = { poly: rectPoly(a, b), dark: tone === 'dark', mid: tone === 'mid', n: 0 };
    classes[key].n++;
    // a square takes any quarter turn, an oblong only its own two
    const q = a === b ? Math.floor(rng() * 4) * Math.PI / 2 : (r.w < r.h ? Math.PI / 2 : 0) + (rng() < 0.5 ? Math.PI : 0);
    stones.push({ ...placed(c, view, a), cls: key, L: mul(rot(q), rng() < 0.5 ? I2 : FLIP_Y) });
  }
  return { classes: poolSizes(classes), stones: finish(stones, view.rect, rowByRow) };
}

// ---------------------------------------------------------------- Ammann–Beenker
// Squares and rhombs of 45° that never repeat, with eightfold stars: the dual of four grids of
// parallel lines at 45° to one another, by de Bruijn's method (as for Penrose's tiling, with
// four grids instead of five). Each crossing of two grid lines is a stone, a square where the
// lines are square to each other, a rhomb where they meet at 45°; a stone's corners come from
// which strip of every grid the crossing lies in.
function ammann(rng, view, choose, family) {
  const E = 10 * parseInt(name(choose, 'size', [['15 cm', 1], ['18 cm', 2], ['21 cm', 1]]), 10);
  const colours = name(choose, 'colours', family === 'clay'
    ? [['red rhombs, yellow squares', 3], ['yellow rhombs, red squares', 2], ['three clays', 2]]
    : [['dark rhombs, light squares', 3], ['light rhombs, dark squares', 2], ['three stones', 2]]);
  const e = [0, 1, 2, 3].map(k => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
  const g = e.map(() => rng());
  const room = view.roomRect;
  // a crossing at p becomes a stone near 2E·p
  const R = Math.hypot(Math.max(-room[0], room[2]), Math.max(-room[1], room[3])) / (2 * E) + 2;
  const N = Math.ceil(R) + 2;
  const deg = Math.PI / 180;
  const D = 2 * E * Math.cos(22.5 * deg), d = 2 * E * Math.sin(22.5 * deg);
  const three = colours.startsWith('three');
  const rhombDark = colours.startsWith('dark') || colours.startsWith('red');
  const stones = [];
  let nSq = 0, nRh = 0;
  for (let r = 0; r < 4; r++) for (let s = r + 1; s < 4; s++) {
    const det = e[r][0] * e[s][1] - e[r][1] * e[s][0];
    for (let j = -N; j <= N; j++) for (let k = -N; k <= N; k++) {
      // the crossing of line j of grid r with line k of grid s
      const a = j + g[r], b = k + g[s];
      const p = [(a * e[s][1] - b * e[r][1]) / det, (b * e[r][0] - a * e[s][0]) / det];
      if (Math.hypot(p[0], p[1]) > R) continue;
      const K = e.map((ei, i) => i === r ? j : i === s ? k : Math.ceil(p[0] * ei[0] + p[1] * ei[1] - g[i]));
      const v0 = K.reduce((acc, Ki, i) => [acc[0] + E * Ki * e[i][0], acc[1] + E * Ki * e[i][1]], [0, 0]);
      const center = [v0[0] + E * (e[r][0] + e[s][0]) / 2, v0[1] + E * (e[r][1] + e[s][1]) / 2];
      if (!inRect(center, room)) continue;
      const mirror = rng() < 0.5 ? I2 : FLIP_Y;
      if (s - r === 2) {
        nSq++;
        stones.push({ ...placed(center, view, E), ring: 0, turn: 0, cls: 'square', L: mul(rot(Math.atan2(e[r][1], e[r][0]) + Math.floor(rng() * 4) * Math.PI / 2), mirror) });
      } else {
        nRh++;
        // the long diagonal: between the two directions where they meet at 45°, else across
        const dg = s - r === 1 ? [e[r][0] + e[s][0], e[r][1] + e[s][1]] : [e[r][0] - e[s][0], e[r][1] - e[s][1]];
        const th = Math.atan2(dg[1], dg[0]);
        // three stones: the rhombs in two tones by which way they lie
        const way = Math.round(mod(th, Math.PI) / (Math.PI / 4) - 0.5) & 1;
        stones.push({ ...placed(center, view, E), ring: 0, turn: 0, cls: three && way ? 'rhombB' : 'rhomb', L: mul(rot(th + (rng() < 0.5 ? 0 : Math.PI)), mirror) });
      }
    }
  }
  stones.sort(byDistance);
  const rh = [[D / 2, 0], [0, d / 2], [-D / 2, 0], [0, -d / 2]];
  const classes = three
    ? { square: { poly: rectPoly(E, E), dark: false }, rhomb: { poly: rh, dark: true }, rhombB: { poly: rh, mid: true } }
    : { square: { poly: rectPoly(E, E), dark: !rhombDark }, rhomb: { poly: rh, dark: rhombDark } };
  return {
    classes, stones,
    describe: `Ammann–Beenker squares and rhombs of ${E / 10} cm, never repeating: ${colours}`,
    how: `${nSq} squares and ${nRh} rhombs laid out from the centre`,
  };
}

// ---------------------------------------------------------------- the pinwheel
// Conway and Radin's pinwheel tiling: one right triangle with legs 1 and 2, in both mirror
// images and in infinitely many directions, never repeating. Each triangle splits into five of
// a fifth of its area, four of them meeting at the middle of its long leg. Searching every way
// to place five such copies with corners on a grid of fifths finds two dissections; this is
// the one with both hands (the other mirrors all five, and keeps a single hand throughout).
// Laid in sandstone, it covers Federation Square in Melbourne. The stones follow the last
// groups of five, or mark the middle triangle of each group, or the triangle's handedness.
// A triangle is [right angle, end of the long leg, end of the short]; the five below are in
// tenths of the long leg and fifths of the short.
const PINWHEEL = [[[1, 2], [5, 0], [0, 0]], [[1, 2], [5, 0], [2, 4]], [[6, 2], [10, 0], [5, 0]], [[2, 4], [0, 0], [0, 5]], [[6, 2], [2, 4], [5, 0]]];

function pinwheel(rng, view, choose) {
  const s = 10 * parseInt(name(choose, 'size', [['15 cm', 1], ['18 cm', 2], ['21 cm', 1]]), 10);
  const colours = name(choose, 'colours', [['in groups of five', 3], ['in groups of five, three stones', 2], ['one in five dark', 2], ['by handedness', 1]]);
  const room = view.roomRect;
  const split = ([R, L, S]) => PINWHEEL.map(k => k.map(([x, y]) => [
    R[0] + x / 10 * (L[0] - R[0]) + y / 5 * (S[0] - R[0]), R[1] + x / 10 * (L[1] - R[1]) + y / 5 * (S[1] - R[1])]));
  // two triangles making a 2A × A rectangle, turned at random about the centre, wide enough
  // to cover the room turned any way
  const reachR = Math.hypot(room[2] - room[0], room[3] - room[1]) / 2;
  const n = Math.ceil(Math.log(2.2 * reachR / s) / Math.log(Math.sqrt(5)));
  const A = s * Math.pow(5, n / 2);
  const th = rng() * Math.PI * 2, c0 = [(rng() - 0.5) * s * 4, (rng() - 0.5) * s * 4];
  const at = (x, y) => [c0[0] + x * Math.cos(th) - y * Math.sin(th), c0[1] + x * Math.sin(th) + y * Math.cos(th)];
  const P00 = at(-A, -A / 2), P10 = at(A, -A / 2), P11 = at(A, A / 2), P01 = at(-A, A / 2);
  let tris = [[P00, P10, P01], [P11, P01, P10]];
  const near = T => {
    const c = [(T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3];
    return outside(c, room) < Math.hypot(T[1][0] - T[2][0], T[1][1] - T[2][1]);
  };
  for (let k = 0; k < n - 1; k++) tris = tris.flatMap(split).filter(near);
  const stones = [];
  const count = { dark: 0, light: 0, mid: 0 };
  tris.forEach((P, g) => {
    // the group's stone, drawn once for all five
    const u0 = rng();
    const groupTone = colours === 'in groups of five' ? (u0 < 0.5 ? 'dark' : 'light') : (u0 < 0.36 ? 'dark' : u0 < 0.68 ? 'light' : 'mid');
    split(P).forEach((T, i) => {
      const [R, L, S] = T;
      const center = [(R[0] + L[0] + S[0]) / 3, (R[1] + L[1] + S[1]) / 3];
      if (!inRect(center, room)) return;
      const u = unit(L[0] - R[0], L[1] - R[1]), v = unit(S[0] - R[0], S[1] - R[1]);
      const right = u[0] * v[1] - u[1] * v[0] > 0;
      const tone = colours.startsWith('in groups') ? groupTone : colours === 'one in five dark' ? (i === 4 ? 'dark' : 'light') : (right ? 'dark' : 'light');
      count[tone]++;
      stones.push({ ...placed(center, view, s), ring: 0, turn: 0, cls: tone, L: [u[0], u[1], v[0], v[1]], g });
    });
  });
  stones.sort(byDistance);
  // in its own frame: the long leg along x, the short along y, about the centre
  const tri = [[-2 * s / 3, -s / 3], [4 * s / 3, -s / 3], [-2 * s / 3, 2 * s / 3]];
  const classes = {};
  for (const t of ['dark', 'light', 'mid']) if (count[t]) classes[t] = { poly: tri, dark: t === 'dark', mid: t === 'mid' };
  return {
    classes, stones,
    describe: `pinwheel triangles of ${s / 10} × ${2 * s / 10} cm, turned every which way and never repeating; ${colours}`,
    how: `${stones.length} triangles, ${n} times divided into five, laid out from the centre`,
  };
}

// ---------------------------------------------------------------- stones of several sizes
// Stones or clay tiles cut to a few sizes and laid without a repeat:
//  at random: squares and oblongs of one to three units, each set at the first gap, of a size
//    that fits, as the mason avoids four corners meeting at a point;
//  courses: rows of one or two widths, the stones of free lengths, joints kept 10 cm from
//    those of the row before.
function opus(rng, view, choose, family) {
  const clay = family === 'clay';
  const layout = name(choose, 'layout', clay ? [['at random', 1]] : [['at random', 3], ['courses', 2]]);
  const room = view.roomRect;
  const rects = [];
  let what, unit = 0;
  if (layout === 'at random') {
    const u = unit = 10 * parseInt(name(choose, 'size', clay ? [['10 cm units', 1], ['15 cm units', 2]] : [['15 cm units', 2], ['20 cm units', 3]]), 10);
    const SIZES = [[1, 1, 2], [2, 1, 3], [2, 2, 3], [3, 2, 2], [3, 3, 1]];
    const i0 = Math.floor(room[0] / u) - 1, j0 = Math.floor(room[1] / u) - 1;
    const ni = Math.ceil(room[2] / u) + 1 - i0, nj = Math.ceil(room[3] / u) + 1 - j0;
    const occ = new Uint8Array(ni * nj), corners = new Uint8Array((ni + 1) * (nj + 1));
    const free = (i, j, w, h) => {
      if (i + w > ni || j + h > nj) return false;
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (occ[y * ni + x]) return false;
      return true;
    };
    const cornersOf = (i, j, w, h) => [[i, j], [i + w, j], [i, j + h], [i + w, j + h]].map(([x, y]) => y * (ni + 1) + x);
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      if (occ[j * ni + i]) continue;
      const cands = [];
      for (const [w, h, wt] of SIZES) for (const [a, b] of w === h ? [[w, h]] : [[w, h], [h, w]]) {
        if (!free(i, j, a, b)) continue;
        const cross = cornersOf(i, j, a, b).some(c => corners[c] >= 3);
        cands.push([a, b, wt, cross]);
      }
      const good = cands.filter(c => !c[3]);
      const pool = good.length ? good : cands;
      let x = rng() * pool.reduce((s, c) => s + c[2], 0), pick = pool[0];
      for (const c of pool) { if ((x -= c[2]) <= 0) { pick = c; break; } }
      const [a, b] = pick;
      for (let y = j; y < j + b; y++) for (let xx = i; xx < i + a; xx++) occ[y * ni + xx] = 1;
      for (const c of cornersOf(i, j, a, b)) corners[c]++;
      rects.push({ x: (i0 + i) * u, y: (j0 + j) * u, w: a * u, h: b * u });
    }
    what = `squares and oblongs of ${u / 10} to ${3 * u / 10} cm, laid at random`;
  } else {
    const widths = name(choose, 'size', [['20 cm courses', 2], ['25 cm courses', 1], ['30 cm courses', 1], ['courses of 20 and 30 cm', 2]]).match(/\d+/g).map(x => 10 * x);
    const R0 = Math.max(-room[0], room[2], -room[1], room[3]) + 400;
    let y = -R0, prev = [];
    while (y < R0) {
      const H = widths.length > 1 ? widths[rng() < 0.5 ? 0 : 1] : widths[0];
      // lengths in 10 cm steps from a little over the width to 70 or 80 cm
      const lens = [0, 1, 2, 3, 4].map(i => Math.max(300, H) + 100 * i + (H > 250 ? 100 : 0));
      let x = -R0 - rng() * 800;
      const joints = [];
      while (x < R0) {
        let L = lens[0];
        for (let t = 0; t < 12; t++) {
          L = lens[Math.floor(rng() * lens.length)];
          if (!prev.some(p => Math.abs(p - (x + L)) < 100)) break;
        }
        rects.push({ x, y, w: L, h: H });
        x += L;
        joints.push(x);
      }
      prev = joints;
      y += H;
    }
    what = `courses of ${widths.map(w => w / 10).join(' and ')} cm, stones of free lengths`;
  }
  const tones = clay ? [['all red', 3], ['red and yellow mixed', 2], ['three clays mixed', 1]]
    : [['one dark stone', 3], ['one light stone', 3], ...(unit ? [['the smallest dark', 2]] : []), ['dark and light mixed', 1]];
  const scheme = name(choose, 'stones', tones);
  const sd = Math.floor(rng() * 2 ** 31);
  let k = 0;
  const toneOf = r => {
    const c = coin(k, 7, sd), c2 = coin(k++, 11, sd);
    if (scheme === 'one dark stone' || scheme === 'all red') return 'dark';
    if (scheme === 'one light stone') return 'light';
    if (scheme === 'the smallest dark') return r.w * r.h === unit * unit ? 'dark' : 'light';
    if (scheme === 'three clays mixed') return c ? 'dark' : c2 ? 'light' : 'mid';
    return c ? 'dark' : 'light';
  };
  const { classes, stones } = rectStones(rng, view, rects, toneOf);
  return {
    classes, stones, pace: unit && unit <= 100 ? 0.7 : 1,
    describe: `${what}; ${scheme}`,
    how: `${stones.length} ${clay ? 'clay tiles' : 'stones'} in ${Object.keys(classes).length} sizes and tones, laid row by row`,
  };
}

// ---------------------------------------------------------------- girih
// Girih tiles in cement: decagon, pentagon, rhombus, hexagon and bowtie with one edge length,
// grown edge to edge from the centre without a repeat (girih.js). Their straps cross every
// edge at its middle at 54°, so the strapwork runs on across the whole floor; the decagons
// carry ten-pointed stars. The straps are one pigment on the ground, or the stars are filled
// with a second and the straps drawn in a third, or the ground round the stars is.
const GIRIH_TURN = { decagon: 1, pentagon: 2, rhombus: 5, hexagon: 5, bowtie: 5 };

function girih(rng, view, choose, family) {
  const E = 10 * parseInt(name(choose, 'size', [['12 cm', 1], ['14 cm', 2], ['16 cm', 1]]), 10);
  const mix = name(choose, 'tiles', [['with rosettes', 3], ['with many rosettes', 2], ['hexagons and bowties', 1], ['all five', 1]]);
  const style = name(choose, 'design', [['straps', 2], ['filled stars', 3], ['filled ground', 2]]);
  const strap = name(choose, 'straps', [['single straps', 3], ['double straps', 2]]);
  const weights = mix === 'all five' ? { decagon: 2, pentagon: 1.5, rhombus: 1.5, hexagon: 3, bowtie: 2 }
    : mix === 'hexagons and bowties' ? { decagon: 0, pentagon: 0, rhombus: 0, hexagon: 3, bowtie: 2 }
      : { decagon: 2, pentagon: 0.3, rhombus: 0.3, hexagon: 3, bowtie: 2 };
  const rosettes = { 'with rosettes': 0.3, 'with many rosettes': 0.6, 'hexagons and bowties': 0, 'all five': 0.2 }[mix];
  const room = view.roomRect;
  const rect = room.map(v => v / E).map((v, i) => v + (i < 2 ? -1.5 : 1.5));
  let grown;
  for (let t = 0; t < 6; t++) {
    grown = growGirih(rng, rect, weights, rosettes);
    if (grown.complete) break;
  }
  const glaze = family === 'glaze';
  // glazed: the four field glazes go to the tile types in an order of the floor's own
  const slots = [1, 2, 3, 4];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const slotOf = { decagon: slots[0], hexagon: slots[1], bowtie: slots[2], pentagon: slots[3], rhombus: slots[3] };
  const hw = E * (glaze ? 0.055 : strap === 'double straps' ? 0.075 : 0.045);
  const dp = [hw, ['straps', 'filled stars', 'filled ground'].indexOf(style) + (strap === 'double straps' ? 4 : 0)];
  const stones = [], count = {};
  for (const t of grown.tiles) {
    const center = [t.at[0] * E, t.at[1] * E];
    if (!inRect(center, room)) continue;
    count[t.type] = (count[t.type] || 0) + 1;
    const turn = (t.rot + GIRIH_TURN[t.type] * Math.floor(rng() * 10)) * Math.PI / 5;
    stones.push({ ...placed(center, view, E), ring: 0, turn: 0, cls: t.type, L: rot(turn) });
  }
  stones.sort(byDistance);
  const classes = {};
  const names = Object.keys(count);
  for (const k of names) {
    const sh = girihShape(k);
    classes[k] = {
      poly: sh.poly.map(v => [v[0] * E, v[1] * E]), cement: true, design: 7, dsize: E, variant: glaze ? slotOf[k] : 0, dp,
      d2: sh.cross ? [sh.cross[0][0] * E, sh.cross[0][1] * E, sh.cross[1][0] * E, sh.cross[1][1] * E] : [0, 0, 0, 0],
      pool: Math.max(6, Math.min(56, Math.round(count[k] / 3), Math.floor(150 / names.length))),
    };
  }
  const order = ['decagon', 'hexagon', 'bowtie', 'pentagon', 'rhombus'].filter(k => count[k]);
  return {
    classes, stones, pace: 0.7,
    describe: `girih ${mix === 'hexagons and bowties' ? 'of hexagons and bowties' : mix}, ${glaze ? 'each field in its own glaze' : `in ${strap}${style === 'filled stars' ? ' round filled stars' : style === 'filled ground' ? ' on a filled ground' : ''}`}: ${order.map(k => `${count[k]} ${k === 'rhombus' ? 'rhombi' : k + 's'}`).join(', ')}, never repeating`,
    how: `${glaze ? 'glazed' : 'cement'} tiles with ${E / 10} cm edges, grown edge to edge from the centre`,
  };
}

const BUILD = { douat, smith, loops, hex: hexes, cubes, penrose, arcs: penroseArcs, ammann, pinwheel, opus, girih };

export function buildTiling(kind, rng, view, choose = plainChooser(rng), family = TILINGS[kind].families[0]) {
  const t = BUILD[kind](rng, view, (slot, options) => choose(kind + '.' + slot, options), family);
  t.kind = kind;
  return t;
}

export { LETTERS };
