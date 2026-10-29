// Floors as lists of stones in laying order. Every stone is one of a few shape classes
// (a triangle, a square, a hexagon, a rhomb), placed by a 2×2 map from the class's own
// frame (centred, millimetres, y down) into the floor. Stones of a class share a pool of
// baked appearances; the map turns or mirrors them into place.
//
// Each tiling makes its choices (design, rule, shape) through choose(slot, [[name, weight]…]),
// which main.js steers away from what recent floors used, and which always draws one random
// number so that a floor can be replayed from its seed and its choices.
import { samplePattern, layingOrder, LETTERS } from './pattern.js';

export const TILINGS = {
  douat: { name: 'half squares', family: 'stone', weight: 4 },
  smith: { name: 'quarter circles', family: 'cement', weight: 2 },
  loops: { name: 'Truchet arcs', family: 'cement', weight: 2 },
  hex: { name: 'hexagons', family: 'cement', weight: 2 },
  cubes: { name: 'cubes', family: 'stone', weight: 3 },
  penrose: { name: 'Penrose rhombs', family: 'stone', weight: 2 },
  arcs: { name: 'Penrose arcs', family: 'cement', weight: 2 },
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
// With arcs: Penrose's own decoration, two arcs per rhomb round the two ends of BC (the sharp
// corners of a thick rhomb, the blunt ones of a thin). The radii were found by testing every
// candidate against all shared edges of a large patch (2,210 edges, none unmatched): the arcs
// round B are ρ on thick rhombs and 1 − ρ on thin ones, those round C have one radius σ.
// They join into curves that never repeat; this is the aperiodic Truchet tile.
const ARC_RHO = 0.78, ARC_SIGMA = 0.24;

function penroseArcs(rng, view, choose) { return penrose(rng, view, choose, true); }

function penrose(rng, view, choose, arcs = false) {
  const E = 190;                                        // rhomb edge, mm
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
  const inks = arcs ? name(choose, 'design', [['arcs in two colours', 3], ['arcs in one colour', 1]]) : '';
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
    const one = inks === 'arcs in one colour' ? -1 : 1;
    return {
      classes: {
        thick: { poly: rhomb(72 * Math.PI / 180), cement: true, design: 6, dsize: E * Math.cos(36 * Math.PI / 180), variant: 0, dp: [ARC_RHO * E, one * ARC_SIGMA * E] },
        thin: { poly: rhomb(36 * Math.PI / 180), cement: true, design: 6, dsize: E * Math.sin(18 * Math.PI / 180), variant: 1, dp: [(1 - ARC_RHO) * E, one * ARC_SIGMA * E] },
      },
      stones,
      describe: `Penrose rhombs with Penrose's ${inks}: ${nThick} thick and ${nThin} thin, the arcs joining into curves that never repeat`,
      how: 'cement rhombs of 19 cm laid out from the centre',
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

const BUILD = { douat, smith, loops, hex: hexes, cubes, penrose, arcs: penroseArcs };

export function buildTiling(kind, rng, view, choose = plainChooser(rng)) {
  const t = BUILD[kind](rng, view, (slot, options) => choose(kind + '.' + slot, options));
  t.kind = kind;
  return t;
}

export { LETTERS };
