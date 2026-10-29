// Floors as lists of stones in laying order. Every stone is one of a few shape classes
// (a triangle, a square, a hexagon, two rhombs), placed by a 2×2 map from the class's own
// frame (centred, millimetres, y down) into the floor. Stones of a class share a pool of
// baked appearances; the map turns or mirrors them into place.
import { samplePattern, layingOrder, LETTERS } from './pattern.js';

export const TILINGS = {
  douat: { name: 'half squares in stone', family: 'stone', weight: 4 },
  smith: { name: 'quarter circles in cement', family: 'cement', weight: 2 },
  hex: { name: 'hexagons in cement', family: 'cement', weight: 2 },
  penrose: { name: 'Penrose rhombs in stone', family: 'stone', weight: 2 },
};

export function pickTiling(rng, id) {
  if (id && TILINGS[id]) return id;
  const keys = Object.keys(TILINGS);
  let r = rng() * keys.reduce((a, k) => a + TILINGS[k].weight, 0);
  for (const k of keys) { r -= TILINGS[k].weight; if (r <= 0) return k; }
  return 'douat';
}

const rot = t => [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t)];   // column-major 2×2
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3]];
const I2 = [1, 0, 0, 1];
const inRect = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
// how far a point lies outside a rectangle (0 inside), the measure of the rings around it
const outside = (p, r) => Math.max(r[0] - p[0], p[0] - r[2], r[1] - p[1], p[1] - r[3], 0);
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
// a fair coin per grid position (a full 32-bit mix, so neighbours are independent)
function coin(i, j, seed) {
  let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 31) & 1;
}

// Lay the pattern area first in the given order, then everything else by distance from it.
function finish(stones, inner, innerOrder) {
  const a = stones.filter(s => !s.outer), b = stones.filter(s => s.outer);
  a.sort(innerOrder);
  b.sort((p, q) => p.ring - q.ring || p.turn - q.turn);
  return a.concat(b);
}
const turnOf = (c) => (Math.atan2(c[1], c[0]) + Math.PI * 2.75) % (Math.PI * 2);

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

// ---------------------------------------------------------------- Smith's quarter circles
function smith(rng, view) {
  const P = 200, h = P / 2;
  const sq = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const S = [0, 1, 1, 0];                               // reflection in the disc diagonal
  const room = view.roomRect, inner = view.rect;
  const i0 = Math.floor(room[0] / P), i1 = Math.ceil(room[2] / P), j0 = Math.floor(room[1] / P), j1 = Math.ceil(room[3] / P);
  const ni = Math.round((inner[2] - inner[0]) / P), nj = Math.round((inner[3] - inner[1]) / P);
  const ii = Math.round(inner[0] / P), jj = Math.round(inner[1] / P);
  let at, describe;
  if (rng() < 0.45) {
    const seed = Math.floor(rng() * 2 ** 31);
    at = (i, j) => coin(i, j, seed);
    describe = 'quarter circles, each tile turned at random';
  } else {
    const pat = samplePattern(rng, ni, nj);
    at = (i, j) => pat.at(i - ii, j - jj) & 1;
    describe = `quarter circles turned by Douat's rule: ${pat.describe}`;
  }
  const stones = [];
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const center = [(i + 0.5) * P, (j + 0.5) * P];
    if (!inRect(center, room)) continue;
    const o = at(i, j);
    // each region takes the colour of the grid corners it touches: corner (i, j) parity
    const discParity = (i + j + o) & 1;
    const L = mul(rot(o * Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0)), rng() < 0.5 ? I2 : S);
    const outer = !inRect(center, inner);
    stones.push({ cls: discParity === 0 ? 'discsDark' : 'discsLight', center, L, outer,
      ring: Math.ceil(outside(center, inner) / P), turn: turnOf(center), from: unit(center[0], center[1]) });
  }
  return {
    classes: {
      discsDark: { poly: sq, cement: true, design: 1, dsize: h, variant: 0 },
      discsLight: { poly: sq, cement: true, design: 1, dsize: h, variant: 1 },
    },
    stones: finish(stones, inner, (p, q) => p.center[1] - q.center[1] || p.center[0] - q.center[0]),
    describe,
    how: `${ni}×${nj} tiles of 20 cm laid row by row, then ring by ring into the room`,
  };
}

// ---------------------------------------------------------------- hexagons with arcs
function hexes(rng, view) {
  const a = 115;                                        // edge; 20 cm across the flats
  const hexPoly = Array.from({ length: 6 }, (_, k) => [a * Math.cos(k * Math.PI / 3), a * Math.sin(k * Math.PI / 3)]);
  const S = [1, 0, 0, -1];                              // reflection through corner 0 keeps the arcs
  const room = view.roomRect, inner = view.rect;
  const rules = [
    ['at random', () => { const seed = Math.floor(rng() * 2 ** 31); return (q, r) => coin(q, r, seed); }],
    ['in rings round the centre', () => (q, r) => (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) >> (rng() < 0.5 ? 0 : 1)) & 1],
    ['in columns', () => { const w = 1 + Math.floor(rng() * 2); return (q) => Math.floor(((q % (2 * w)) + 2 * w) % (2 * w) / w); }],
    ['one in three alike', () => (q, r) => (((q - r) % 3) + 3) % 3 === 0 ? 1 : 0],
    ['in diagonal bands', () => { const w = 1 + Math.floor(rng() * 3); return (q, r) => Math.floor((((q + 2 * r) % (2 * w)) + 2 * w) % (2 * w) / w); }],
  ];
  const [ruleName, make] = rules[Math.floor(rng() * rules.length)];
  const at = make();
  const stones = [];
  const qmax = Math.ceil(Math.max(-room[0], room[2]) / (1.5 * a)) + 1;
  const rmax = Math.ceil(Math.max(-room[1], room[3]) / (Math.sqrt(3) * a)) + qmax;
  for (let q = -qmax; q <= qmax; q++) for (let r = -rmax; r <= rmax; r++) {
    const center = [1.5 * a * q, Math.sqrt(3) * a * (r + q / 2)];
    if (!inRect(center, room)) continue;
    const o = at(q, r);
    const L = mul(rot(o * Math.PI / 3 + Math.floor(rng() * 3) * 2 * Math.PI / 3), rng() < 0.5 ? I2 : S);
    const outer = !inRect(center, inner);
    stones.push({ cls: 'hex', center, L, outer, ring: Math.ceil(outside(center, inner) / (1.7 * a)), turn: turnOf(center),
      from: unit(center[0], center[1]), d: Math.hypot(center[0], center[1]) });
  }
  return {
    classes: { hex: { poly: hexPoly, cement: true, design: 2, dsize: a, variant: 0 } },
    stones: finish(stones, inner, (p, q) => p.d - q.d),
    describe: `hexagons with three arcs each, turned ${ruleName}`,
    how: 'hexagonal tiles of 20 cm laid out from the centre into the room',
  };
}

// ---------------------------------------------------------------- Penrose rhombs
// Robinson triangles subdivided from a sun of ten (Preshing's formulation); each pair
// that shares its base edge is one rhomb, thick (72°) or thin (36°).
function penrose(rng, view) {
  const E = 190;                                        // rhomb edge, mm
  const phi = (1 + Math.sqrt(5)) / 2;
  const room = view.roomRect, inner = view.rect;
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
  const thickDark = rng() < 0.7;
  const stones = [];
  let nThick = 0, nThin = 0;
  for (const pair of halves.values()) {
    if (pair.length !== 2) continue;
    const [[c, A1, B, C], [, A2]] = pair;
    const center = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    if (!inRect(center, room)) continue;
    // the long diagonal joins the two corners at the sharp angles
    const dBC = Math.hypot(B[0] - C[0], B[1] - C[1]), dAA = Math.hypot(A1[0] - A2[0], A1[1] - A2[1]);
    const [p, q] = dBC > dAA ? [B, C] : [A1, A2];
    const thick = Math.min(dBC, dAA) / Math.max(dBC, dAA) > 0.5;
    if (thick) nThick++; else nThin++;
    const theta = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const L = mul(rot(theta), rng() < 0.5 ? I2 : [1, 0, 0, -1]);
    const outer = !inRect(center, inner);
    stones.push({ cls: thick ? 'thick' : 'thin', center, L, outer, ring: 0, turn: 0,
      from: unit(center[0], center[1]), d: Math.hypot(center[0], center[1]) });
  }
  const rhomb = (ang) => {
    const D = 2 * E * Math.cos(ang / 2), d = 2 * E * Math.sin(ang / 2);
    return [[D / 2, 0], [0, d / 2], [-D / 2, 0], [0, -d / 2]];
  };
  stones.sort((p, q) => p.d - q.d);
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

export function buildTiling(kind, rng, view) {
  const t = { douat, smith, hex: hexes, penrose }[kind](rng, view);
  t.kind = kind;
  return t;
}

export { LETTERS };
