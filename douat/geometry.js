// Stone meshes, in laying order, so that the stones laid so far are a prefix of the buffers.
// A stone's top is a polygon a little larger than the stone, cut to its hand-dressed
// outline by the baked texture; its sides are real faces just inside that outline.
import { stoneParams, offsetPoly } from './stonelib.js';

export const FLOATS = 13;   // pos 3, normal 3, tangent 3, atlas uv 2, info 2 (half k, kind)

export function atlasLayout(cells, slotPx, maxSize) {
  let S = slotPx;
  for (;;) {
    const cols = Math.ceil(Math.sqrt(cells));
    const rows = Math.ceil(cells / cols);
    if (cols * S <= maxSize && rows * S <= maxSize) return { S, cols, rows, W: cols * S, H: rows * S, margin: 6 };
    S = Math.floor(S * 0.8);
  }
}

export function buildStones(floor, rnd, atlas) {
  const { view, material, seed, stones } = floor;
  const P = view.pitch, T = view.thick, NX = view.NX;
  const span = P + 2 * atlas.margin;
  const tops = [], walls = [];
  const top = [], wall = [], pivots = [];
  const warp = (x, y) => [
    rnd.gnoise(x / 1300, y / 1300, (seed + 91) >>> 0) * 3.2 + rnd.gnoise(x / 380, y / 380, (seed + 95) >>> 0) * 0.9,
    rnd.gnoise(x / 1300, y / 1300, (seed + 93) >>> 0) * 3.2 + rnd.gnoise(x / 380, y / 380, (seed + 97) >>> 0) * 0.9,
  ];
  for (const [i, j, k] of stones) {
    const st = floor.cells[(j * NX + i) * 4];
    const s = stoneParams(rnd, i, j, k, st, seed, P, material.joint);
    const ox = view.origin[0] + i * P, oy = view.origin[1] + j * P;
    const w = warp(ox + s.cen[0], oy + s.cen[1]);
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    const world = q => {
      const dx = q[0] - s.cen[0], dy = q[1] - s.cen[1];
      return [ox + s.cen[0] + s.off[0] + w[0] + c * dx - sn * dy, oy + s.cen[1] + s.off[1] + w[1] + sn * dx + c * dy];
    };
    const topZ = q => T + s.lip + s.tilt[0] * (q[0] - s.cen[0]) + s.tilt[1] * (q[1] - s.cen[1]);
    const idx = j * NX + i, sx = idx % atlas.cols, sy = Math.floor(idx / atlas.cols);
    const uv = q => [(sx * atlas.S + (q[0] + atlas.margin) / span * atlas.S) / atlas.W,
      (sy * atlas.S + (q[1] + atlas.margin) / span * atlas.S) / atlas.H];
    // the top's tilted plane, turned with the stone
    const tn = [-s.tilt[0], -s.tilt[1]];
    const nl = Math.hypot(tn[0], tn[1], 1);
    const N = [(c * tn[0] - sn * tn[1]) / nl, (sn * tn[0] + c * tn[1]) / nl, 1 / nl];
    const Tg = [c, sn, 0];
    const vert = (out, q, z, n, t, u, kind) => {
      const p = world(q);
      out.push(p[0], p[1], z, n[0], n[1], n[2], t[0], t[1], t[2], u[0], u[1], k, kind);
    };
    // top: a fan around the centre of a slightly grown outline
    const start = tops.length / FLOATS;
    const outline = offsetPoly(s.poly, s.rc + 2.0, 4);
    for (let e = 0; e < outline.length; e++) {
      const a = outline[e], b = outline[(e + 1) % outline.length];
      for (const q of [s.cen, a, b]) vert(tops, q, topZ(q), N, Tg, uv(q), 0);
    }
    top.push([start, tops.length / FLOATS - start]);
    // sides: from the bed up to just under the rolled arris
    const wstart = walls.length / FLOATS;
    const inner = s.rc > 1.4 ? offsetPoly(s.poly, s.rc - 1.2, 3) : offsetPoly(s.poly, s.rc - 1.2);
    const cu = uv(s.cen);
    for (let e = 0; e < inner.length; e++) {
      const a = inner[e], b = inner[(e + 1) % inner.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
      const nx = ey / el, ny = -ex / el;                          // outward in stone space
      const n = [c * nx - sn * ny, sn * nx + c * ny, 0];
      const za = topZ(a) - 0.4, zb = topZ(b) - 0.4;
      vert(walls, a, 0, n, Tg, cu, 1); vert(walls, b, 0, n, Tg, cu, 1); vert(walls, b, zb, n, Tg, cu, 1);
      vert(walls, a, 0, n, Tg, cu, 1); vert(walls, b, zb, n, Tg, cu, 1); vert(walls, a, za, n, Tg, cu, 1);
    }
    wall.push([wstart, walls.length / FLOATS - wstart]);
    const pc = world(s.cen);
    pivots.push([pc[0], pc[1], T * 0.5]);
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
  return new Float32Array([...quad(bedRect, 0), ...quad(view.rect, T - material.fillDepth)]);
}
