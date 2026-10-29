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
    // a reflex corner (the bowtie's) is mitred whichever way the outline moves
    const reflex = e1[0] * e2[1] - e1[1] * e2[0] < 0;
    if (r > 0 && !reflex) {
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
