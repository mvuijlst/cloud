// Baked-stone pools and stone meshes. Meshes are in laying order, so the stones laid so far
// are a prefix of the buffers. A stone's top is a polygon a little larger than the stone, cut
// to its outline by the baked coverage; its sides are real faces just inside that outline.
import { pcg3, offsetPoly } from './stonelib.js';

// pos 3, normal 3, tangent 3, atlas uv 2, info 2 (unused; kind 0 top, 1 side, 2 mirrored top)
export const FLOATS = 13;
const MARGIN = 6;                // mm of empty slot around a stone's own extent

export function atlasLayout(slots, slotPx, maxSize) {
  let S = slotPx;
  for (;;) {
    const cols = Math.ceil(Math.sqrt(slots));
    const rows = Math.ceil(slots / cols);
    if (cols * S <= maxSize && rows * S <= maxSize) return { S, cols, rows, W: cols * S, H: rows * S };
    S = Math.floor(S * 0.8);
  }
}

// A pool of distinct stones per class, each with its own joint, corner radius and hash.
export function buildPool(tiling, material, seed, perClass) {
  const entries = [], byClass = {};
  const names = Object.keys(tiling.classes);
  names.forEach((name, ci) => {
    const c = tiling.classes[name];
    const ext = Math.max(...c.poly.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    const span = 2 * (ext + MARGIN);
    byClass[name] = [];
    for (let k = 0; k < perClass; k++) {
      const h = pcg3((k + 1) >>> 0, (ci * 7919 + 17) >>> 0, seed >>> 0);
      const r = pcg3(h[2], h[0], h[1]).map(v => v / 4294967296);
      const cement = !!c.cement;
      const hj = material.joint * 0.5 + (r[0] - 0.5) * (cement ? 0.5 : 1.4);
      const rc = cement ? 0.5 + 1.0 * r[1] : 0.8 + 2.4 * r[1];
      byClass[name].push(entries.length);
      entries.push({
        cls: name, h, span, rc, cement,
        dark: !!c.dark, design: c.design || 0, dsize: c.dsize || 0, variant: c.variant || 0,
        poly: offsetPoly(c.poly, -(hj + rc)),
      });
    }
  });
  return { entries, byClass };
}

// Per-slot tables for the bake shader: polygon, sizes and design as floats; hash and flags as uints.
export function slotTables(pool) {
  const n = pool.entries.length;
  const f = new Float32Array(n * 5 * 4), u = new Uint32Array(n * 4);
  pool.entries.forEach((e, i) => {
    for (let v = 0; v < 6; v++) {
      const p = e.poly[Math.min(v, e.poly.length - 1)];
      f[i * 20 + v * 2] = p[0]; f[i * 20 + v * 2 + 1] = p[1];
    }
    f.set([e.poly.length, e.rc, e.span, e.design], i * 20 + 12);
    f.set([e.dsize, e.variant, 0, 0], i * 20 + 16);
    u.set([e.h[0], e.h[1], e.h[2], (e.dark ? 1 : 0) | (e.cement ? 2 : 0)], i * 4);
  });
  return { f, u, n };
}

export function buildStones(floor, rnd, atlas) {
  const { view, seed, stones, pool } = floor;
  const T = view.thick;
  const rng = (() => { let a = seed ^ 0x5bd1e995; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const tops = [], walls = [];
  const top = [], wall = [], pivots = [];
  const warp = (x, y, k) => [
    k * (rnd.gnoise(x / 1300, y / 1300, (seed + 91) >>> 0) * 3.2 + rnd.gnoise(x / 380, y / 380, (seed + 95) >>> 0) * 0.9),
    k * (rnd.gnoise(x / 1300, y / 1300, (seed + 93) >>> 0) * 3.2 + rnd.gnoise(x / 380, y / 380, (seed + 97) >>> 0) * 0.9),
  ];
  for (const st of stones) {
    const e = pool.entries[st.entry];
    const k = e.cement ? 0.35 : 1;                    // pressed tiles sit truer than hand-cut stone
    const jr = (rng() - 0.5) * 2 * 0.011 * k;
    const off = [(rng() - 0.5) * 2 * 1.1 * k, (rng() - 0.5) * 2 * 1.1 * k];
    const lip = (rng() - 0.5) * 1.5 * k;
    const tilt = [(rng() - 0.5) * 0.03 * k, (rng() - 0.5) * 0.03 * k];
    const w = warp(st.center[0], st.center[1], k);
    // the class frame to the floor: placement map, then the stone's own small turn
    const c = Math.cos(jr), sn = Math.sin(jr);
    const L = st.L;
    const map = q => {
      const x = L[0] * q[0] + L[2] * q[1], y = L[1] * q[0] + L[3] * q[1];
      return [c * x - sn * y, sn * x + c * y];
    };
    const cx = st.center[0] + off[0] + w[0], cy = st.center[1] + off[1] + w[1];
    const world = q => { const v = map(q); return [cx + v[0], cy + v[1]]; };
    const topZ = p => T + lip + tilt[0] * (p[0] - cx) + tilt[1] * (p[1] - cy);
    const sl = pool.slotOf[st.entry], sx = sl % atlas.cols, sy = Math.floor(sl / atlas.cols);
    const uv = q => [(sx * atlas.S + (q[0] / e.span + 0.5) * atlas.S) / atlas.W,
      (sy * atlas.S + (q[1] / e.span + 0.5) * atlas.S) / atlas.H];
    const nl = Math.hypot(tilt[0], tilt[1], 1);
    const N = [-tilt[0] / nl, -tilt[1] / nl, 1 / nl];
    const tx = map([1, 0]);
    const Tg = [tx[0], tx[1], 0];
    const mirrored = L[0] * L[3] - L[1] * L[2] < 0;
    const vert = (out, q, z, n, u, kind) => {
      const p = world(q);
      out.push(p[0], p[1], z === null ? topZ(p) : z, n[0], n[1], n[2], Tg[0], Tg[1], Tg[2], u[0], u[1], 0, kind);
    };
    // top: a fan around the centre of a slightly grown outline
    const start = tops.length / FLOATS;
    const outline = offsetPoly(e.poly, e.rc + (e.cement ? 1.2 : 2.0), 4);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      for (const q of [[0, 0], a, b]) vert(tops, q, null, N, uv(q), mirrored ? 2 : 0);
    }
    top.push([start, tops.length / FLOATS - start]);
    // sides: from the bed up to just under the rolled arris
    const wstart = walls.length / FLOATS;
    const ins = e.rc - (e.cement ? 0.4 : 1.2);
    const inner = ins > 0.2 ? offsetPoly(e.poly, ins, 3) : offsetPoly(e.poly, ins);
    const cu = uv([0, 0]);
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i], b = inner[(i + 1) % inner.length];
      const pa = world(a), pb = world(b);
      const ex = pb[0] - pa[0], ey = pb[1] - pa[1], el = Math.hypot(ex, ey) || 1;
      // outward normal in the floor: the outline runs counter-clockwise in the class frame,
      // and a mirrored placement reverses it
      const s = mirrored ? -1 : 1;
      const n = [s * ey / el, -s * ex / el, 0];
      const za = topZ(pa) - 0.4, zb = topZ(pb) - 0.4;
      vert(walls, a, 0, n, cu, 1); vert(walls, b, 0, n, cu, 1); vert(walls, b, zb, n, cu, 1);
      vert(walls, a, 0, n, cu, 1); vert(walls, b, zb, n, cu, 1); vert(walls, a, za, n, cu, 1);
    }
    wall.push([wstart, walls.length / FLOATS - wstart]);
    pivots.push([cx, cy, T * 0.5]);
  }
  const topVerts = tops.length / FLOATS;
  const data = new Float32Array(tops.length + walls.length);
  data.set(tops, 0);
  data.set(walls, tops.length);
  return { data, top, wall: wall.map(([a, n]) => [a + topVerts, n]), pivots, topVerts };
}

// The mortar bed under and around the floor, and the joint filling just under the tops.
export function buildGround(view, material, bedRect) {
  const T = view.thick;
  const quad = (r, z) => [r[0], r[1], z, r[2], r[1], z, r[2], r[3], z, r[0], r[1], z, r[2], r[3], z, r[0], r[3], z];
  return new Float32Array([...quad(bedRect, 0), ...quad(view.roomRect, T - material.fillDepth)]);
}
