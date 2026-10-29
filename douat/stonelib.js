// The parts of the stone model the geometry needs on the CPU, mirrored exactly from
// material.js: the random table, the hash, value noise, and each stone's parameters.

export const RND_N = 512;

// 512² random bytes; the GPU reads the same table as a texture.
export function makeRndBytes() {
  const bytes = new Uint8Array(RND_N * RND_N * 4);
  let st = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    st ^= st << 13; st ^= st >>> 17; st ^= st << 5;
    bytes[i] = st & 255;
  }
  return bytes;
}

export function pcg3(x, y, z) {
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  y = (Math.imul(y, 1664525) + 1013904223) >>> 0;
  z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  return [x, y, z];
}

export class Rnd {
  constructor(bytes) { this.b = bytes; }
  off(s) {
    const h = Math.imul(s >>> 0, 2654435761) >>> 0;
    return [h & 511, (h >>> 9) & 511];
  }
  at(cx, cy, s) {
    const [ox, oy] = this.off(s);
    const x = (cx + ox) & 511, y = (cy + oy) & 511, k = (y * RND_N + x) * 4;
    return [this.b[k] / 255, this.b[k + 1] / 255, this.b[k + 2] / 255, this.b[k + 3] / 255];
  }
  hrnd(h, k) { return this.at(h[0] & 511, h[1] & 511, (h[2] + k) >>> 0); }
  gnoise(px, py, s) {
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const [ox, oy] = this.off(s);
    const cx = (ix + ox) & 511, cy = (iy + oy) & 511, cx1 = (cx + 1) & 511, cy1 = (cy + 1) & 511;
    const t = (x, y) => this.b[(y * RND_N + x) * 4] / 255;
    const q = f => f * f * f * (f * (f * 6 - 15) + 10);
    const ux = q(fx), uy = q(fy);
    const a = t(cx, cy), b = t(cx1, cy), d = t(cx, cy1), e = t(cx1, cy1);
    return ((a + (b - a) * ux) * (1 - uy) + (d + (e - d) * ux) * uy) * 2 - 1;
  }
}

// cell corners, y down: 0 bottom-left, 1 top-left, 2 top-right, 3 bottom-right
const corner = (c, P) => c === 0 ? [0, P] : c === 1 ? [0, 0] : c === 2 ? [P, 0] : [P, P];

// Everything the shader's makeStone decides that the geometry needs.
export function stoneParams(rnd, i, j, k, st, seed, P, joint) {
  const h = pcg3((i + 4096) >>> 0, (Math.imul(j + 4096, 2) + k) >>> 0, seed >>> 0);
  const r1 = h.map(v => v / 4294967296);
  const r2 = rnd.hrnd(h, 0x68e31da4), r3 = rnd.hrnd(h, 0x7fb5d329);
  const tri = st < 4;
  const dark = tri ? k === 0 : st === 4;
  const hj = joint * 0.5 + (r3[0] - 0.5) * 1.4;
  const rc = 0.8 + 2.4 * r1[2];
  let poly, cen;
  if (tri) {
    const cc = k === 0 ? st : (st + 2) & 3;
    const C = corner(cc, P), A = corner((cc + 1) & 3, P), B = corner((cc + 3) & 3, P);
    const rin = P * (1 - 0.70710678);
    const nA = norm(sub(A, C)), nB = norm(sub(B, C));
    const I = [C[0] + rin * (nA[0] + nB[0]), C[1] + rin * (nA[1] + nB[1])];
    const f = (rin - hj - rc) / rin;
    poly = [C, A, B].map(V => [I[0] + (V[0] - I[0]) * f, I[1] + (V[1] - I[1]) * f]);
    cen = [(C[0] + A[0] + B[0]) / 3, (C[1] + A[1] + B[1]) / 3];
  } else {
    const hs = P * 0.5 - hj - rc;
    cen = [P / 2, P / 2];
    poly = [[cen[0] - hs, cen[1] - hs], [cen[0] + hs, cen[1] - hs], [cen[0] + hs, cen[1] + hs], [cen[0] - hs, cen[1] + hs]];
  }
  return {
    i, j, k, st, tri, dark, h, rc, poly, cen,
    off: [(r2[0] - 0.5) * 2 * 1.1, (r2[1] - 0.5) * 2 * 1.1],
    rot: (r2[2] - 0.5) * 2 * 0.011,
    lip: (r1[0] - 0.5) * 1.5,
    tilt: [(r3[1] - 0.5) * 0.03, (r3[2] - 0.5) * 0.03],
  };
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function norm(a) { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; }

// Convex polygon grown by r with round corners (r > 0), or shrunk by -r (r < 0).
// Points run in the polygon's own winding; returned counter-clockwise in screen terms (y down).
export function offsetPoly(poly, r, seg = 5) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const P = area > 0 ? poly.slice() : poly.slice().reverse();     // positive area
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    // outward normals of edges a-b and b-c (positive area, y down: outward = (dy, -dx))
    const e1 = norm(sub(b, a)), e2 = norm(sub(c, b));
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
    if (r > 0) {
      const t1 = Math.atan2(n1[1], n1[0]);
      let t2 = Math.atan2(n2[1], n2[0]);
      while (t2 < t1) t2 += Math.PI * 2;
      for (let s = 0; s <= seg; s++) {
        const t = t1 + (t2 - t1) * s / seg;
        out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]);
      }
    } else {
      // intersect the two inward-shifted edges
      const m = [n1[0] + n2[0], n1[1] + n2[1]];
      const k = r / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
      out.push([b[0] + m[0] * k, b[1] + m[1] * k]);
    }
  }
  return out;
}
