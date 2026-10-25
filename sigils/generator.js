/* Goetic-style seal generator, client side.

   A port of tools/generate.py (and the parts of tools/sigil.py it needs) to
   plain JavaScript with no dependencies, so it runs in any browser and under
   Node. The fitted numbers come from sigil-data.js (tools/build_web_data.py).

   Every seal is built by one of six construction grammars, one per family on
   the sheet (axial, comb, bowl, compartment, radial, cursive), drawn in the
   sheet's proportions (16, 10, 11, 22, 6, 7 of 72). Parts and their
   frequencies come from the hand encodings: stroke width, aspect, ring radius,
   cross half-arm, triangle size, what sits at a free line end, how often a
   seal is mirrored. A seal grows until its primitive count reaches a target
   drawn from the encodings of its family; a raster of what is already drawn
   keeps new parts from colliding with old ones except where they join.

   Output is an encoding in vocabulary 1.0 (encodings/VOCABULARY.md), the same
   JSON tools/sigil.py renders, normalised to a tight ink box of height 1.

   The random stream differs from Python's, so a seed gives different seals
   here than in tools/generate.py; the two are checked against the same
   acceptance and novelty tests (GENERATOR.md). */
(function (root) {
  'use strict';

  const D = root.SIGIL_DATA;
  const FAMILY_COUNTS = [['axial', 16], ['comb', 10], ['bowl', 11], ['compartment', 22], ['radial', 6], ['cursive', 7]];
  const R = 160;          // occupancy raster, pixels per unit height
  const MARGIN = 0.12;    // occupancy canvas margin around the design box, units
  const STROKE_K = 0.75;  // drawn width / encoded (measured) width, GENERATOR.md

  // ---------- random numbers (mulberry32) ----------

  function makeRng(seed) {
    let a = seed >>> 0;
    const random = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = {
      random,
      uniform: (lo, hi) => lo + (hi - lo) * random(),
      randrange: n => Math.floor(random() * n),
      choice: arr => arr[Math.floor(random() * arr.length)],
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
      sample: (arr, k) => rng.shuffle(arr.slice()).slice(0, k),
    };
    return rng;
  }

  // ---------- small geometry ----------

  const RAD = Math.PI / 180;
  const mod = (a, n) => ((a % n) + n) % n;
  const unit = a => [Math.cos(a * RAD), Math.sin(a * RAD)];
  const ang = u => Math.atan2(u[1], u[0]) / RAD;
  const add = (p, u, k = 1) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const perp = u => [-u[1], u[0]];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rnd = (v, n = 4) => Array.isArray(v) ? v.map(x => rnd(x, n)) : Math.round(v * 10 ** n) / 10 ** n;
  const L = (p, q) => ({ t: 'line', p: rnd([p[0], p[1], q[0], q[1]]) });
  const clone = o => JSON.parse(JSON.stringify(o));
  const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

  // A triangle; unfilled ones are closed plines, because tools/sigil.py
  // renders an unfilled tri as an open two-stroke polyline.
  function tri(pts, fill = true) {
    return fill ? { t: 'tri', p: rnd(pts) } : { t: 'pline', p: rnd(pts), closed: true };
  }

  // ---------- vocabulary geometry (tools/sigil.py) ----------

  function bezPoints(pts, nPer = 24) {
    const out = [pts[0]];
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const [p0, p1, p2, p3] = pts.slice(i, i + 4);
      for (let j = 1; j <= nPer; j++) {
        const t = j / nPer, s = 1 - t;
        out.push([s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0],
                  s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1]]);
      }
    }
    return out;
  }

  function arcPoints(c, r, a0, a1, n) {
    const [rx, ry] = Array.isArray(r) ? r : [r, r];
    if (n === undefined) n = Math.max(8, Math.floor(Math.abs(a1 - a0) / 4));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * RAD;
      out.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)]);
    }
    return out;
  }

  function spiralPoints(c, r0, r1, a0, sweep) {
    const n = Math.max(12, Math.floor(Math.abs(sweep) / 4));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (a0 + sweep * t) * RAD, rad = r0 + (r1 - r0) * t;
      out.push([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)]);
    }
    return out;
  }

  // cross pattee: four arms with a narrow waist, concave sides and a wide tip
  function crossPolys(c, s, rot) {
    const polys = [];
    for (let k = 0; k < 4; k++) {
      const u = unit(rot + 90 * k), v = [-u[1], u[0]];
      const waist = 0.14 * s, spread = 0.55 * s;
      const off = f => waist + (spread - waist) * f ** 2.2;
      const P = (f, sign) => [c[0] + u[0] * f * s + sign * v[0] * off(f), c[1] + u[1] * f * s + sign * v[1] * off(f)];
      const tip = add(c, u, s);
      const poly = [add(c, v, waist)];
      for (const f of [0.15, 0.4, 0.65, 0.85]) poly.push(P(f, 1));
      poly.push(add(tip, v, spread), add(tip, v, -spread));
      for (const f of [0.85, 0.65, 0.4, 0.15]) poly.push(P(f, -1));
      poly.push(add(c, v, -waist));
      polys.push(poly);
    }
    return polys;
  }

  // filled crescent: circle (c, r) minus circle ri shifted k*r toward rot
  function crescentPoly(c, r, k, rot, ri) {
    const d = k * r; if (ri === undefined) ri = r;
    const u = unit(rot), cb = add(c, u, d);
    let cosT = (d * d + r * r - ri * ri) / (2 * d * r);
    if (cosT >= 1) cosT = 0.999;
    const theta = Math.acos(Math.max(-1, cosT)) / RAD;
    const outer = arcPoints(c, r, rot + theta, rot + 360 - theta);
    const p1 = outer[outer.length - 1], p2 = outer[0];
    const a1 = Math.atan2(p1[1] - cb[1], p1[0] - cb[0]) / RAD;
    const a2 = Math.atan2(p2[1] - cb[1], p2[0] - cb[0]) / RAD;
    const norm = a => mod(a + 180, 360) - 180;
    let sweep = norm(a2 - a1);
    if (Math.abs(norm(a1 + sweep / 2 - (rot + 180))) > 90) sweep = sweep > 0 ? sweep - 360 : sweep + 360;
    return outer.concat(arcPoints(cb, ri, a1, a1 + sweep));
  }

  const GROUPING = new Set(['repeat', 'mirror']);

  function translate(m, dx, dy) {
    m = clone(m);
    const t = m.t;
    if (t === 'line') { const p = m.p; m.p = [p[0] + dx, p[1] + dy, p[2] + dx, p[3] + dy]; }
    else if (['pline', 'bez', 'tri', 'path'].includes(t)) m.p = m.p.map(([x, y]) => [x + dx, y + dy]);
    else if (['arc', 'ring', 'dot', 'cross', 'spiral', 'crescent'].includes(t)) m.c = [m.c[0] + dx, m.c[1] + dy];
    else if (GROUPING.has(t)) {
      m.m = m.m.map(x => translate(x, dx, dy));
      if (t === 'mirror') m.at += m.axis === 'x' ? dx : dy;
    }
    return m;
  }

  function reflect(m, axis, at) {
    m = clone(m);
    const rp = (x, y) => axis === 'x' ? [2 * at - x, y] : [x, 2 * at - y];
    const ra = a => axis === 'x' ? mod(180 - a, 360) : mod(-a, 360);
    const t = m.t;
    if (t === 'line') { const a = rp(m.p[0], m.p[1]), b = rp(m.p[2], m.p[3]); m.p = [a[0], a[1], b[0], b[1]]; }
    else if (['pline', 'bez', 'tri', 'path'].includes(t)) m.p = m.p.map(([x, y]) => rp(x, y));
    else if (t === 'ring' || t === 'dot') m.c = rp(...m.c);
    else if (t === 'arc') {
      m.c = rp(...m.c);
      const [a0, a1] = m.a;
      m.a = [ra(a1), ra(a0)];          // reflection reverses the sweep
      if (m.a[1] < m.a[0]) m.a[1] += 360;
    } else if (t === 'cross' || t === 'crescent') { m.c = rp(...m.c); m.rot = ra(m.rot || 0); }
    else if (t === 'spiral') { m.c = rp(...m.c); m.a = [ra(m.a[0]), -m.a[1]]; }
    else if (t === 'repeat') {
      m.m = m.m.map(x => reflect(x, axis, at));
      m.d = axis === 'x' ? [-m.d[0], m.d[1]] : [m.d[0], -m.d[1]];
    } else if (t === 'mirror') {
      m.m = m.m.map(x => reflect(x, axis, at));
      if (m.axis === axis) m.at = 2 * at - m.at;
    }
    return m;
  }

  // flatten repeat and mirror into primitives
  function expand(members) {
    const out = [];
    for (const m of members) {
      if (m.t === 'repeat') {
        for (let i = 0; i < m.n; i++) out.push(...expand(m.m.map(x => translate(x, m.d[0] * i, m.d[1] * i))));
      } else if (m.t === 'mirror') {
        out.push(...expand(m.m));
        out.push(...expand(m.m.map(x => reflect(x, m.axis, m.at))));
      } else out.push(m);
    }
    return out;
  }

  // ---------- rasteriser: pixel indices covered by a member list ----------
  // Pixel centres sit at integer coordinates and a stroke of width w is a
  // capsule of radius w/2. exact=false rounds the width to whole pixels.
  // ocv=true imitates OpenCV's LINE_8 drawing in tools/sigil.py: coordinates on
  // a 1/16 px grid, strokes and filled outlines reaching half a pixel further
  // (fitted member by member against cv2: about 1% of pixels disagree).

  function rasterize(members, W, H, s, pad, stroke, exact, ocv = false) {
    const out = [], quant = ocv, grow = ocv ? 0.5 : 0;
    const q16 = v => quant ? Math.round(v * 16) / 16 : v;   // OpenCV's 4-bit sub-pixel coordinates
    const P = p => [q16(p[0] * s + pad), q16(p[1] * s + pad)];
    const width = m => {
      const w = (m.w === undefined ? stroke : m.w) * s;
      return exact ? w : Math.max(1, Math.round(w));
    };
    function capsule(a, b, r) {
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0]) + r));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1]) + r));
      const dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy, r2 = r * r;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          let t = ll ? ((x - a[0]) * dx + (y - a[1]) * dy) / ll : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = a[0] + t * dx - x, ey = a[1] + t * dy - y;
          if (ex * ex + ey * ey <= r2) out.push(y * W + x);
        }
      }
    }
    function polyline(pts, w, closed) {
      const q = pts.map(P), r = w / 2 + grow;
      for (let i = 0; i + 1 < q.length; i++) capsule(q[i], q[i + 1], r);
      if (closed && q.length > 2) capsule(q[q.length - 1], q[0], r);
      if (q.length === 1) capsule(q[0], q[0], r);
    }
    function fill(pts) {
      const q = pts.map(P);
      let y0 = Infinity, y1 = -Infinity;
      for (const p of q) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.max(0, Math.ceil(y0)); y <= Math.min(H - 1, Math.floor(y1)); y++) {
        const xs = [];
        for (let i = 0; i < q.length; i++) {
          const a = q[i], b = q[(i + 1) % q.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort((u, v) => u - v);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          for (let x = Math.max(0, Math.ceil(xs[i])); x <= Math.min(W - 1, Math.floor(xs[i + 1])); x++) out.push(y * W + x);
        }
      }
      if (grow) for (let i = 0; i < q.length; i++) capsule(q[i], q[(i + 1) % q.length], grow);
    }
    function annulus(c, r, w, solid) {
      const [cx, cy] = P(c), rr = q16(r * s), h = solid ? 0 : w / 2 + grow, ro = rr + h + (solid ? grow / 2 : 0), ri = solid ? -1 : rr - h;
      for (let y = Math.max(0, Math.floor(cy - ro)); y <= Math.min(H - 1, Math.ceil(cy + ro)); y++) {
        for (let x = Math.max(0, Math.floor(cx - ro)); x <= Math.min(W - 1, Math.ceil(cx + ro)); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d <= ro && d >= ri) out.push(y * W + x);
        }
      }
    }
    for (const m of members) {
      const w = width(m), t = m.t;
      if (t === 'line') polyline([m.p.slice(0, 2), m.p.slice(2)], w, false);
      else if (t === 'pline' || t === 'tri') {
        if (m.fill === undefined ? t === 'tri' : m.fill) {
          fill(m.p);
          polyline(m.p, exact ? w / 2 : Math.max(1, Math.floor(w / 2)), true);
        } else polyline(m.p, w, !!m.closed);
      } else if (t === 'bez' || t === 'path') polyline(bezPoints(m.p), w, false);
      else if (t === 'arc') polyline(arcPoints(m.c, m.r, m.a[0], m.a[1]), w, false);
      else if (t === 'ring') annulus(m.c, m.r, w, false);
      else if (t === 'dot') annulus(m.c, m.r, w, true);
      else if (t === 'cross') {
        const rot = m.rot || 0, flared = m.flared === undefined ? true : m.flared;
        if (flared) for (const poly of crossPolys(m.c, m.s, rot)) fill(poly);
        const lw = flared ? (exact ? w * 0.8 : Math.max(1, Math.floor(w * 0.8))) : w;
        for (let k = 0; k < 2; k++) {
          const u = unit(rot + 90 * k);
          polyline([add(m.c, u, -m.s), add(m.c, u, m.s)], lw, false);
        }
      } else if (t === 'spiral') polyline(spiralPoints(m.c, m.r[0], m.r[1], m.a[0], m.a[1]), w, false);
      else if (t === 'crescent') fill(crescentPoly(m.c, m.r, m.k === undefined ? 0.35 : m.k, m.rot || 0, m.ri));
      else throw new Error('unknown member type ' + t);
    }
    return out;
  }

  // squared Euclidean distance transform (Felzenszwalb and Huttenlocher), in place on f
  function edt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  }

  // distance (px) from each pixel with region[i] set to the nearest pixel without
  function distanceTransform(region, W, H) {
    const INF = 1e20, n = Math.max(W, H);
    const g = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = region[i] ? INF : 0;
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = g[y * W + x];
      edt1(f, H, d, v, z);
      for (let y = 0; y < H; y++) g[y * W + x] = d[y];
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) f[x] = g[y * W + x];
      edt1(f, W, d, v, z);
      for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]);
    }
    return g;
  }

  // ---------- fitted distributions ----------

  // piecewise-linear inverse CDF through a quantile summary
  function qDraw(rng, key) {
    const q = D[key];
    const xs = [0, 0.10, 0.25, 0.5, 0.75, 0.90, 1];
    const ys = [q.q10 - (q.q25 - q.q10) * 0.6, q.q10, q.q25, q.median, q.q75, q.q90, q.q90 + (q.q90 - q.q75) * 0.6];
    const u = rng.random();
    for (let i = 1; i < xs.length; i++) {
      if (u <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (u - xs[i - 1]) / (xs[i] - xs[i - 1]);
    }
    return ys[ys.length - 1];
  }

  function pick(rng, weights, exclude = []) {
    const items = weights.filter(([k]) => !exclude.includes(k));
    let x = rng.random() * items.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of items) { x -= w; if (x <= 0) return k; }
    return items[items.length - 1][0];
  }

  const ringR = rng => clamp(qDraw(rng, 'ring_r'), 0.028, 0.075);
  const crossS = rng => clamp(qDraw(rng, 'cross_s'), 0.055, 0.15);

  // ---------- the canvas: members, symmetry, occupancy, sockets ----------

  class Canvas {
    constructor(rng, aspect, stroke, mirror) {
      this.rng = rng; this.A = aspect; this.s = stroke;
      this.ax = mirror ? aspect / 2 : null;
      this.mirrorAt = this.ax;          // kept when ax is cleared for one-sided extras
      this.pad = Math.floor(MARGIN * R);
      this.W = Math.round(aspect * R) + 2 * this.pad; this.H = R + 2 * this.pad;
      this.occ = new Uint8Array(this.W * this.H);     // ink
      this.occD = new Uint8Array(this.W * this.H);    // ink dilated by the clearance
      this.scratch = new Uint8Array(this.W * this.H);
      this.center = []; this.side = [];
      this.sockets = [];   // {p, u, group}
      this.rails = [];     // horizontal lines usable for pendants: [x0, x1, y, group]
      this.posts = [];     // vertical lines usable for spurs: [x, y0, y1, group]
      this.count = 0; this.floating = 0; this.log = [];
      this.trace = [];     // every placement in order, mirror images included: what the page animates
      this.clear = Math.max(2, Math.round(0.7 * stroke * R));
      this.disk = [];
      for (let dy = -this.clear; dy <= this.clear; dy++) {
        for (let dx = -this.clear; dx <= this.clear; dx++) {
          if (dx * dx + dy * dy <= this.clear * this.clear + this.clear) this.disk.push([dx, dy]);
        }
      }
    }

    raster(members) { return rasterize(expand(members), this.W, this.H, R, this.pad, this.s, false, true); }

    px(p) { return [Math.round(p[0] * R + this.pad), Math.round(p[1] * R + this.pad)]; }

    mirrored(group) { return group === 'side' && this.ax !== null; }

    full(members, group) {
      return this.mirrored(group) ? [{ t: 'mirror', axis: 'x', at: rnd(this.ax), m: members }] : members;
    }

    dilateInto(pix, buf, mark) {
      const { W, H } = this;
      for (const i of pix) {
        const x = i % W, y = (i - x) / W;
        for (const [dx, dy] of this.disk) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
            const j = yy * W + xx;
            if (!buf[j]) { buf[j] = 1; if (mark) mark.push(j); }
          }
        }
      }
    }

    fits(members, group, contacts = [], slack = 0) {
      const m = Array.from(new Set(this.raster(members)));
      if (!m.length) return false;
      const { W, pad } = this, tol = Math.floor(0.01 * R);
      const bx0 = pad - tol, bx1 = pad + Math.round(this.A * R) + tol, by0 = pad - tol, by1 = pad + R + tol;
      for (const i of m) {
        const x = i % W, y = (i - x) / W;
        if (x < bx0 || x >= bx1 || y < by0 || y >= by1) return false;   // inside the design box
      }
      const mir = this.mirrored(group);
      let cts = contacts.map(c => this.px(c));
      if (mir) cts = cts.concat(contacts.map(c => this.px([2 * this.ax - c[0], c[1]])));
      const rad = Math.round(1.4 * this.s * R) + this.clear, rad2 = rad * rad;
      const marked = [];
      if (mir) this.dilateInto(m, this.scratch, marked);   // to test the part against its own reflection
      const axPx = this.ax === null ? 0 : this.ax * R + pad;
      let hits = 0;
      for (const i of m) {
        const x = i % W, y = (i - x) / W;
        if (cts.some(([cx, cy]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad2)) continue;
        let hit = this.occD[i];
        if (!hit && mir) {
          const rx = Math.round(2 * axPx - x);
          hit = rx >= 0 && rx < W && this.scratch[y * W + rx];
        }
        if (hit && ++hits > slack) break;
      }
      for (const j of marked) this.scratch[j] = 0;
      return hits <= slack;
    }

    add(members, group = 'center', contacts = [], force = false, note = null) {
      if (!force && !this.fits(members, group, contacts)) return false;
      const pix = this.raster(this.full(members, group));
      for (const i of pix) this.occ[i] = 1;
      this.dilateInto(pix, this.occD, null);
      (this.mirrored(group) ? this.side : this.center).push(...members);
      this.count += expand(members).length * (this.mirrored(group) ? 2 : 1);
      if (note) this.log.push(note);
      this.trace.push({ note, prims: expand(this.full(members, group)) });
      return true;
    }

    socket(p, u, group) { this.sockets.push({ p, u, group }); }

    members() {
      const out = this.center.slice();
      if (this.side.length) out.push({ t: 'mirror', axis: 'x', at: rnd(this.mirrorAt), m: this.side });
      return out;
    }

    freeX(group) { return this.mirrored(group) ? [0, this.ax] : [0, this.A]; }
  }

  const sideGroup = cv => cv.ax !== null ? 'side' : 'center';

  // ---------- terminals: what sits at a free stroke end ----------

  // Free line ends in the encodings land on a ring 29%, a triangle 9%, nothing
  // 7%, a cross 6%, a spiral 5%, a dot 1% (the rest join other strokes). The
  // T-bar with ring ends and the crescent are the sheet's other end shapes, and
  // the encoders' wishes name the rest: a single pattee arm on a plain stem, the
  // flared end of an I-bar, a closed lobed outline (heart), a fork. With the
  // first weights rings ended 40% of generated line ends against the sheet's
  // 29% (tools/variety.py), the plainest cause of sameness; these are lowered to match.
  const TERMINAL_W = [['ring', 0.33], ['tri', 0.1], ['none', 0.05], ['cross', 0.1], ['spiral', 0.08],
                      ['tbar', 0.06], ['dot', 0.02], ['crescent', 0.04], ['foot', 0.04], ['ring2', 0.03],
                      ['pattee', 0.05], ['ibar', 0.03], ['heart', 0.025], ['fork', 0.04]];

  // a flared end: from width w0 at p to w1 at p + u*len, sides curving out as on a cross pattee
  function flare(p, u, len, w0, w1) {
    const v = perp(u), side = [], fs = [0, 0.3, 0.55, 0.8, 1];
    for (const f of fs) side.push([f, w0 + (w1 - w0) * f ** 2.2]);
    const pts = side.map(([f, w]) => add(add(p, u, f * len), v, w / 2))
      .concat(side.slice().reverse().map(([f, w]) => add(add(p, u, f * len), v, -w / 2)));
    return { t: 'pline', p: rnd(pts), closed: true, fill: true };
  }

  // a heart, its point at p, its lobes toward u (Beleth's lobed outlines)
  function heart(p, u, h) {
    const v = perp(u), w = 0.5 * h;
    const P = (a, b) => add(add(p, u, a * h), v, b * h);
    const pts = [P(0, 0), P(0.2, 0.25), P(0.38, 0.55), P(0.62, 0.55), P(0.85, 0.56), P(1.02, 0.45), P(1.0, 0.25),
                 P(0.98, 0.1), P(0.88, 0.02), P(0.82, 0), P(0.88, -0.02), P(0.98, -0.1), P(1.0, -0.25),
                 P(1.02, -0.45), P(0.85, -0.56), P(0.62, -0.55), P(0.38, -0.55), P(0.2, -0.25), P(0, 0)];
    void w;
    return { t: 'bez', p: rnd(pts) };
  }

  function terminal(rng, p, u, kind, scale = 1) {
    const v = perp(u);
    if (kind === 'ring') {
      const r = ringR(rng) * scale;
      return [{ t: 'ring', c: rnd(add(p, u, r)), r: rnd(r) }];
    }
    if (kind === 'ring2') {   // ring, short neck, smaller ring
      const r = ringR(rng) * scale, r2 = r * 0.8;
      const c1 = add(p, u, r), q = add(c1, u, r), q2 = add(q, u, 0.04);
      return [{ t: 'ring', c: rnd(c1), r: rnd(r) }, L(q, q2), { t: 'ring', c: rnd(add(q2, u, r2)), r: rnd(r2) }];
    }
    if (kind === 'dot') {
      const r = 0.022 * scale;
      return [{ t: 'dot', c: rnd(add(p, u, r * 0.6)), r: rnd(r) }];
    }
    if (kind === 'cross') {
      const s = crossS(rng) * scale;
      return [{ t: 'cross', c: rnd(add(p, u, s * 0.95)), s: rnd(s), flared: true, rot: rnd(mod(ang(u), 90), 1) }];
    }
    if (kind === 'tri') {     // arrowhead
      const sz = clamp(qDraw(rng, 'tri_size'), 0.08, 0.2) * scale;
      const h = sz * rng.uniform(0.38, 0.5), base = add(p, u, -sz * 0.15);
      return [{ t: 'tri', p: rnd([add(base, v, h), add(base, v, -h), add(p, u, sz * 0.85)]) }];
    }
    if (kind === 'foot') {    // triangle standing on its tip at the stroke end
      const sz = clamp(qDraw(rng, 'tri_size'), 0.08, 0.18) * scale;
      const h = sz * 0.55, b = add(p, u, sz * 0.85);
      return [tri([p, add(b, v, h), add(b, v, -h)], rng.random() < 0.6)];
    }
    if (kind === 'spiral') {
      const r0 = clamp(qDraw(rng, 'spiral_r'), 0.04, 0.085) * scale;
      const sweep = rng.choice([1, -1]) * rng.uniform(330, 470);
      const a0 = sweep > 0 ? ang(u) - 90 : ang(u) + 90;
      const c = add(p, unit(a0), -r0);
      return [{ t: 'spiral', c: rnd(c), r: rnd([r0, r0 * 0.18]), a: rnd([a0, sweep], 1) }];
    }
    if (kind === 'tbar') {
      const h = rng.uniform(0.05, 0.09) * scale, r = ringR(rng) * 0.85 * scale;
      const a = add(p, v, h), b = add(p, v, -h);
      return [L(a, b), { t: 'ring', c: rnd(add(a, v, r)), r: rnd(r) }, { t: 'ring', c: rnd(add(b, v, -r)), r: rnd(r) }];
    }
    if (kind === 'crescent') {
      const r = rng.uniform(0.05, 0.075) * scale;
      return [{ t: 'crescent', c: rnd(add(p, u, r * 0.9)), r: rnd(r), ri: rnd(r * 0.92), k: 0.45, rot: rnd(mod(ang(u), 360), 1) }];
    }
    if (kind === 'pattee') {  // one arm of a cross pattee on the stem's end
      const s = crossS(rng) * rng.uniform(0.7, 0.95) * scale;
      return [{ t: 'pline', p: rnd(crossPolys(p, s, ang(u))[0]), closed: true, fill: true }];
    }
    if (kind === 'ibar') {    // the flared end of an I-bar
      return [flare(p, u, rng.uniform(0.03, 0.05) * scale, 0.012, rng.uniform(0.06, 0.09) * scale)];
    }
    if (kind === 'heart') {
      return [heart(p, u, rng.uniform(0.08, 0.12) * scale)];
    }
    if (kind === 'fork') {    // three prongs, the outer two sometimes ringed
      const lf = rng.uniform(0.05, 0.08) * scale, spread = rng.uniform(30, 45), ringed = rng.random() < 0.5, r = ringR(rng) * 0.7 * scale;
      const out = [];
      for (const da of [-spread, 0, spread]) {
        const w = unit(ang(u) + da), q = add(p, w, lf);
        out.push(L(p, q));
        if (ringed && da !== 0) out.push({ t: 'ring', c: rnd(add(q, w, r)), r: rnd(r) });
      }
      return out;
    }
    return [];
  }

  // horizontal extent of a few primitive members (stroke not included)
  function widthX(members) {
    const xs = [];
    for (const m of expand(members)) {
      if (m.c) {
        let r = m.s !== undefined ? m.s : (m.r || 0);
        if (Array.isArray(r)) r = Math.max(...r);
        xs.push(m.c[0] - r, m.c[0] + r);
      } else if (m.t === 'line') xs.push(m.p[0], m.p[2]);
      else for (const q of m.p) xs.push(q[0]);
    }
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  }

  // try terminal kinds at a socket until one fits; returns the kind placed
  function placeTerminal(cv, sock, kinds = null, exclude = []) {
    const rng = cv.rng;
    for (let attempt = 0; attempt < 6; attempt++) {
      const kind = kinds ? kinds[attempt % kinds.length] : pick(rng, TERMINAL_W, exclude);
      if (kind === 'none') return 'none';
      for (const scale of [1, 0.8]) {
        if (cv.add(terminal(rng, sock.p, sock.u, kind, scale), sock.group, [sock.p])) return kind;
      }
    }
    return 'none';
  }

  // ---------- ornaments used by the decoration loop ----------

  // a point on a rail and the group a part attached there belongs to
  function railSpot(cv, margin = 0.05) {
    const rng = cv.rng;
    const [x0, x1, y] = rng.choice(cv.rails);
    if (cv.ax === null) return x1 - x0 > 2 * margin ? [rng.uniform(x0 + margin, x1 - margin), y, 'center'] : null;
    if (x0 - 1e-6 <= cv.ax && cv.ax <= x1 + 1e-6 && rng.random() < 0.2) return [cv.ax, y, 'center'];
    const b = Math.min(x1 - margin, cv.ax - 0.06);
    if (b <= x0 + margin) return null;
    return [rng.uniform(x0 + margin, b), y, 'side'];
  }

  // a vertical stem hung from (or raised on) a rail, ending in a terminal
  function pendant(cv) {
    const rng = cv.rng;
    if (!cv.rails.length) return false;
    const spot = railSpot(cv);
    if (!spot) return false;
    const [x, y, g] = spot;
    const kind = pick(rng, TERMINAL_W, ['none']);
    for (const [length, scale] of [[rng.uniform(0.08, 0.22), 1], [rng.uniform(0.05, 0.1), 0.8]]) {
      for (const d of rng.sample([1, -1], 2)) {
        const p0 = [x, y], p1 = [x, y + d * length];
        const zig = length > 0.12 && rng.random() < 0.15;   // a zigzag stem, as on Focalor and Zagan
        const stem = zig ? { t: 'pline', p: rnd([p0, [x - 0.03, y + d * length * 0.33], [x + 0.03, y + d * length * 0.66], p1]) } : L(p0, p1);
        const ms = [stem].concat(terminal(rng, p1, [0, d], kind, scale));
        if (cv.add(ms, g, [p0], false, `${zig ? 'zigzag ' : ''}${d > 0 ? 'pendant' : 'stem'} with ${kind}`)) {
          cv.posts.push([x, Math.min(y, p1[1]), Math.max(y, p1[1]), g]);
          return true;
        }
      }
    }
    return false;
  }

  // a row of two to five rings hanging from (or sitting on) a rail, as on Eligos and Vepar
  function ringrow(cv) {
    const rng = cv.rng;
    if (!cv.rails.length) return false;
    const [x0, x1, y] = rng.choice(cv.rails);
    const r = ringR(rng) * rng.uniform(0.75, 1), n = rng.choice([2, 3, 3, 4, 5]);
    const d = 2 * r + cv.s * rng.uniform(1.2, 2.2);
    const side = rng.choice([1, -1]);
    let yc = y + side * (r + cv.s * rng.uniform(0.6, 1.5));
    const hang = rng.random() < 0.4;   // rings on short necks
    if (hang) yc = y + side * (r + rng.uniform(0.04, 0.07));
    const span = d * (n - 1);
    let xs, g;
    if (cv.ax !== null && x0 <= cv.ax && cv.ax <= x1 && rng.random() < 0.6) { xs = cv.ax - span / 2; g = 'center'; }
    else {
      const b = (cv.ax === null ? x1 - r : Math.min(x1 - r, cv.ax - r - 0.03)) - span;
      if (b <= x0 + r) return false;
      xs = rng.uniform(x0 + r, b); g = cv.ax !== null ? 'side' : 'center';
    }
    const m = [{ t: 'ring', c: rnd([xs, yc]), r: rnd(r) }];
    if (hang) m.unshift(L([xs, y], [xs, yc - side * r]));
    const contacts = Array.from({ length: n }, (_, i) => [xs + i * d, y]);
    return cv.add([{ t: 'repeat', n, d: [rnd(d), 0], m }], g, contacts, false, `row of ${n} rings`);
  }

  // a short stroke out of a post, level or at 45 degrees, ending in a terminal
  function spur(cv) {
    const rng = cv.rng;
    if (!cv.posts.length) return false;
    let [x, y0, y1, g] = rng.choice(cv.posts);
    if (y1 - y0 < 0.12) return false;
    let d;
    if (cv.ax !== null) {
      if (x > cv.ax + 1e-6) return false;
      g = 'side'; d = -1;   // mirrored: build the left one, the right one is its reflection
    } else d = rng.choice([-1, 1]);
    const y = rng.uniform(y0 + 0.05, y1 - 0.05);
    const tilt = pick(rng, [[0, 0.55], [45, 0.25], [-45, 0.2]]);
    const u = d < 0 ? unit(180 + tilt) : unit(-tilt);
    const len = rng.uniform(0.07, 0.17) * (tilt ? 1.2 : 1), p1 = add([x, y], u, len);
    const kind = pick(rng, TERMINAL_W, ['none', 'foot']);
    if (rng.random() < 0.4) {   // a curved spur: the sheet joins lines to curves far more often than to rings alone
      const bend = rng.choice([1, -1]) * len * 0.35, v = perp(u);
      const c1 = add(add([x, y], u, len * 0.35), v, bend), c2 = add(add([x, y], u, len * 0.7), v, bend);
      const end = add(p1, v, bend * 0.4), ue = [end[0] - c2[0], end[1] - c2[1]], n = Math.hypot(...ue);
      return cv.add([{ t: 'bez', p: rnd([[x, y], c1, c2, end]) }].concat(terminal(rng, end, [ue[0] / n, ue[1] / n], kind)), g, [[x, y]], false,
                    `curved spur with ${kind}`);
    }
    return cv.add([L([x, y], p1)].concat(terminal(rng, p1, u, kind)), g, [[x, y]], false,
                  `${tilt ? 'diagonal ' : ''}spur with ${kind}`);
  }

  // a small arch standing on (or hanging from) a rail
  function arch(cv) {
    const rng = cv.rng;
    if (!cv.rails.length) return false;
    const [x0, x1, y] = rng.choice(cv.rails);
    const r = rng.uniform(0.05, 0.1);
    const lo = x0 + r + 0.02;
    let hi = x1 - r - 0.02;
    if (cv.ax !== null) hi = Math.min(hi, cv.ax - r - 0.03);
    if (hi <= lo) return false;
    const cx = rng.uniform(lo, hi), up = rng.random() < 0.6;
    const ms = [{ t: 'arc', c: rnd([cx, y]), r: rnd([r, r * rng.uniform(0.8, 1.3)]), a: up ? [180, 360] : [0, 180] }];
    return cv.add(ms, cv.ax !== null ? 'side' : 'center', [[cx - r, y], [cx + r, y]], false, 'arch on a rail');
  }

  // a dome standing on a rail (or a bowl hanging from it), often crowned: Agares, Barbatos
  function dome(cv) {
    const rng = cv.rng;
    if (!cv.rails.length) return false;
    const [x0, x1, y] = rng.choice(cv.rails);
    const hw = rng.uniform(0.07, 0.16), hh = hw * rng.uniform(0.6, 1.1), up = rng.random() < 0.65;
    let cx, g;
    if (cv.ax !== null && x0 + hw <= cv.ax && cv.ax <= x1 - hw && rng.random() < 0.25) { cx = cv.ax; g = 'center'; }
    else {
      const lo = x0 + hw + 0.02, hi = (cv.ax !== null ? Math.min(x1, cv.ax - 0.03) : x1) - hw - 0.02;
      if (hi <= lo) return false;
      cx = rng.uniform(lo, hi); g = cv.ax !== null ? 'side' : 'center';
    }
    const d = up ? -1 : 1, top = [cx, y + d * hh];
    const kind = pick(rng, [['cross', 0.25], ['pattee', 0.15], ['ring', 0.15], ['fork', 0.1], ['tri', 0.1], ['none', 0.25]]);
    const ms = [{ t: 'arc', c: rnd([cx, y]), r: rnd([hw, hh]), a: up ? [180, 360] : [0, 180] }].concat(terminal(rng, top, [0, d], kind, 0.85));
    return cv.add(ms, g, [[cx - hw, y], [cx + hw, y]], false, `${up ? 'dome' : 'bowl'} on a rail${kind === 'none' ? '' : ' with ' + kind}`);
  }

  // distance (px) to the nearest ink for background pixels enclosed by ink
  function enclosedRoom(cv) {
    const { W, H, occ } = cv;
    const outside = new Uint8Array(W * H), stack = [0];
    outside[0] = 1;
    while (stack.length) {   // 4-connected flood fill from the corner
      const i = stack.pop(), x = i % W, y = (i - x) / W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !outside[j] && !occ[j]) { outside[j] = 1; stack.push(j); }
      }
    }
    const enclosed = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) enclosed[i] = !occ[i] && !outside[i] ? 1 : 0;
    return distanceTransform(enclosed, W, H);
  }

  // a free-standing part inside an enclosure: on the sheet loose parts sit in
  // cells, bowls and frames, not in open space
  function filler(cv) {
    const rng = cv.rng, { W, H, pad } = cv;
    const room = enclosedRoom(cv);
    let axisCol = 0;
    if (cv.ax !== null) {
      axisCol = Math.round(cv.ax * R) + pad;
      for (let y = 0; y < H; y++) for (let x = axisCol + 1; x < W; x++) room[y * W + x] = 0;
    }
    const kind = pick(rng, [['cross', 0.45], ['ring', 0.17], ['ringrow', 0.1], ['diamond', 0.08], ['tri', 0.08], ['dot', 0.04], ['heart', 0.06]]);
    const size = { cross: () => crossS(rng) * rng.uniform(0.55, 0.85), ring: () => ringR(rng), ringrow: () => ringR(rng) * 0.8,
                   diamond: () => rng.uniform(0.035, 0.06), tri: () => rng.uniform(0.04, 0.07), dot: () => 0.02,
                   heart: () => rng.uniform(0.04, 0.06) }[kind]();
    const need = kind === 'ringrow' ? (2 * size + cv.s * 2) * R + cv.clear : (size + cv.s) * R + cv.clear;
    const spots = [];
    for (let i = 0; i < W * H; i++) if (room[i] >= need) spots.push(i);
    if (!spots.length) return false;
    const i = rng.choice(spots), px = i % W, py = (i - px) / W;
    let x = (px - pad) / R;
    const y = (py - pad) / R;
    let g = 'center';
    if (cv.ax !== null) {
      if (axisCol - px < need) x = cv.ax;   // close to the axis: sit on it
      else g = 'side';
    }
    let ms;
    if (kind === 'cross') ms = [{ t: 'cross', c: rnd([x, y]), s: rnd(size), flared: true, rot: 0 }];
    else if (kind === 'ring') ms = [{ t: 'ring', c: rnd([x, y]), r: rnd(size) }];
    else if (kind === 'ringrow') {
      const d = 2 * size + cv.s * 1.6;
      ms = [{ t: 'repeat', n: 2, d: [0, rnd(d)], m: [{ t: 'ring', c: rnd([x, y - d / 2]), r: rnd(size) }] }];
    } else if (kind === 'diamond') {
      const h = size;
      ms = [{ t: 'pline', p: rnd([[x, y - h], [x + h, y], [x, y + h], [x - h, y]]), closed: true, fill: rng.random() < 0.4 }];
    } else if (kind === 'tri') {
      const h = size, up = rng.choice([1, -1]);
      ms = [tri([[x, y - up * h], [x + h, y + up * h * 0.8], [x - h, y + up * h * 0.8]], rng.random() < 0.6)];
    } else if (kind === 'heart') {
      const h = 2 * size, up = rng.random() < 0.5;
      ms = [heart([x, y + (up ? 0.5 : -0.5) * h], [0, up ? -1 : 1], h)];
    } else ms = [{ t: 'dot', c: rnd([x, y]), r: 0.02 }];
    if (cv.add(ms, g, [], false, `${kind} in an enclosure`)) { cv.floating++; return true; }
    return false;
  }

  // a vertical stroke joining two rails, which makes a cell
  function connector(cv) {
    const rng = cv.rng;
    if (cv.rails.length < 2) return false;
    const [a, b] = rng.sample(cv.rails, 2);
    if (Math.abs(a[2] - b[2]) < 0.12) return false;
    const lo = Math.max(a[0], b[0]) + 0.04;
    let hi = Math.min(a[1], b[1]) - 0.04, g = 'center';
    if (cv.ax !== null) { hi = Math.min(hi, cv.ax - 0.05); g = 'side'; }
    if (hi <= lo) return false;
    const x = rng.uniform(lo, hi), y0 = Math.min(a[2], b[2]), y1 = Math.max(a[2], b[2]);
    if (cv.posts.some(([px, py0, py1]) => Math.abs(px - x) < 0.07 && py0 < y1 && py1 > y0)) return false;
    if (cv.add([L([x, y0], [x, y1])], g, [[x, y0], [x, y1]], false, 'wall between rails')) {
      cv.posts.push([x, y0, y1, g]);
      return true;
    }
    return false;
  }

  // a short horizontal bar across a post on the axis (or any post when unmirrored)
  function crossbar(cv) {
    const rng = cv.rng;
    if (!cv.posts.length) return false;
    const [x, y0, y1, g] = rng.choice(cv.posts);
    if (y1 - y0 < 0.15 || g !== 'center' || (cv.ax !== null && Math.abs(x - cv.ax) > 1e-6)) return false;
    const y = rng.uniform(y0 + 0.06, y1 - 0.06), h = rng.uniform(0.06, 0.13);
    const kind = pick(rng, [['ring', 0.55], ['tri', 0.2], ['cross', 0.15], ['none', 0.1]]);
    const a = [x - h, y], b = [x + h, y];
    const ms = [L(a, b)].concat(terminal(rng, a, [-1, 0], kind), terminal(rng, b, [1, 0], kind));
    if (cv.add(ms, 'center', [[x, y]], false, `crossbar with ${kind}`)) {
      cv.rails.push([a[0], b[0], y, 'center']);
      return true;
    }
    return false;
  }

  // grow a level or upright stem from the nearest stroke into the largest
  // empty region of the design box, ending in a terminal: the seals fill their space
  function reach(cv) {
    const rng = cv.rng, { W, H, pad, occ } = cv;
    const xLo = pad, yLo = pad, xHi = pad + Math.round(cv.A * R), yHi = pad + R;
    const xMax = cv.ax !== null ? Math.round(cv.ax * R) + pad - 2 * cv.clear : W;
    const free = new Uint8Array(W * H);
    for (let y = yLo; y < yHi; y++) for (let x = xLo; x < Math.min(xHi, xMax); x++) free[y * W + x] = occ[y * W + x] ? 0 : 1;
    const dt = distanceTransform(free, W, H);
    let mx = 0;
    for (let i = 0; i < W * H; i++) if (dt[i] > mx) mx = dt[i];
    if (mx < 0.06 * R) return false;
    const spots = [];
    for (let i = 0; i < W * H; i++) if (dt[i] >= 0.7 * mx) spots.push(i);
    const ti = rng.choice(spots), tx = ti % W, ty = (ti - tx) / W;
    let best = null;   // nearest ink along the four axis directions
    for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = tx, y = ty, n = 0;
      while (x >= xLo && x < xHi && y >= yLo && y < yHi && !occ[y * W + x]) { x += ux; y += uy; n++; }
      if (x >= xLo && x < xHi && y >= yLo && y < yHi && (!best || n < best[0])) best = [n, x, y, [-ux, -uy]];
    }
    if (!best) return false;
    const [, hx, hy, u] = best;
    const p0 = [(hx - pad) / R, (hy - pad) / R], target = [(tx - pad) / R, (ty - pad) / R];
    const span = dist(p0, target);
    const kind = pick(rng, TERMINAL_W, ['none']);
    const g = cv.ax !== null ? 'side' : 'center';
    // straight arms only half the time: the sheet's lines bend, hook and branch
    // (the first generator's arms were all straight: branch straightness +0.5 sd)
    const form = pick(rng, [['straight', 0.42], ['curved', 0.3], ['hooked', 0.14], ['barred', 0.14]]);
    for (const f of [1, 0.7]) {
      const len = Math.max(0.05, span * f - 0.05), p1 = add(p0, u, len), v = perp(u), sc = f === 1 ? 1 : 0.8;
      let ms, label = 'arm';
      if (form === 'curved' && len > 0.1) {
        const bend = rng.choice([1, -1]) * len * rng.uniform(0.2, 0.4);
        const c1 = add(add(p0, u, len * 0.35), v, bend), c2 = add(add(p0, u, len * 0.75), v, bend), end = add(p1, v, bend * 0.3);
        const te = [end[0] - c2[0], end[1] - c2[1]], tn = Math.hypot(...te);
        ms = [{ t: 'bez', p: rnd([p0, c1, c2, end]) }].concat(terminal(rng, end, [te[0] / tn, te[1] / tn], kind, sc));
        label = 'curved arm';
      } else if (form === 'hooked' && len > 0.12) {   // the arm turns back in a half circle
        const r = Math.min(0.07, len * 0.3), side = rng.choice([1, -1]), q = add(p0, u, len - r), cc = add(q, v, side * r);
        const a0 = ang([q[0] - cc[0], q[1] - cc[1]]);
        const sweep = side > 0 ? -180 : 180, a1 = a0 + sweep;
        const arc = { t: 'arc', c: rnd(cc), r: rnd(r), a: sweep > 0 ? [a0, a1] : [a1, a0] };
        const endp = add(cc, unit(a1), r);
        ms = [L(p0, q), arc].concat(terminal(rng, endp, [-u[0], -u[1]], pick(rng, [['ring', 0.4], ['dot', 0.2], ['none', 0.4]]), 0.7));
        label = 'hooked arm';
      } else if (form === 'barred' && len > 0.1) {    // a short crossbar near the end
        const q = add(p0, u, len * rng.uniform(0.55, 0.75)), h = rng.uniform(0.035, 0.065), kb = pick(rng, [['ring', 0.4], ['none', 0.35], ['tri', 0.25]]);
        ms = [L(p0, p1), L(add(q, v, h), add(q, v, -h))].concat(terminal(rng, add(q, v, h), v, kb, 0.6), terminal(rng, add(q, v, -h), [-v[0], -v[1]], kb, 0.6),
                                                               terminal(rng, p1, u, kind, sc));
        label = 'barred arm';
      } else ms = [L(p0, p1)].concat(terminal(rng, p1, u, kind, sc));
      if (cv.add(ms, g, [p0], false, `${label} with ${kind}`)) {
        if (u[1] === 0) cv.rails.push([Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0]), p0[1], g]);
        else cv.posts.push([p0[0], Math.min(p0[1], p1[1]), Math.max(p0[1], p1[1]), g]);
        return true;
      }
    }
    return false;
  }

  const ORNAMENTS = { pendant, spur, filler, crossbar, connector, arch, ringrow, reach, dome };

  function decorate(cv, target) {
    const rng = cv.rng;
    // terminals first: free ends are where the sheet puts most of its ornament
    rng.shuffle(cv.sockets);
    for (let tries = 0; cv.sockets.length && tries < 60; tries++) {
      const s = cv.sockets.pop();
      if (cv.count >= target && rng.random() < 0.5) placeTerminal(cv, s, ['ring', 'none']);
      else placeTerminal(cv, s);
    }
    // about half the mirrored seals on the sheet carry one-sided extras
    // (Leraje's rail end, Buer's arms): sheet sym_lr median 0.56, not 0.9
    const extras = cv.ax !== null && rng.random() < 0.65 ? rng.choice([1, 2, 2, 3]) : 0;
    // Each ornament grows less likely every time this seal uses it: with fixed
    // weights the "arm" move ran to 2.7 per seal and pendants to 1.7, the stock
    // ringed stems that made the seals look alike (tools/variety.py).
    const uses = {};
    for (let tries = 0; cv.count < target - 2.5 * extras && tries < 700; tries++) {
      const weights = [['pendant', 0.2], ['spur', 0.15], ['filler', cv.floating < 4 ? 0.16 : 0.04], ['crossbar', 0.07],
                       ['connector', 0.09], ['arch', 0.06], ['ringrow', 0.07], ['reach', 0.09], ['dome', 0.09]]
        .map(([k, w]) => [k, w * (k === 'reach' ? 0.45 : 0.6) ** (uses[k] || 0)]);
      const act = pick(rng, weights);
      if (ORNAMENTS[act](cv)) uses[act] = (uses[act] || 0) + 1;
    }
    if (extras) {
      cv.ax = null;
      let placed = 0;
      for (let tries = 0; placed < extras && tries < 80; tries++) {
        placed += ORNAMENTS[pick(rng, [['pendant', 0.4], ['spur', 0.35], ['ringrow', 0.1], ['arch', 0.15]])](cv) ? 1 : 0;
      }
      if (placed) cv.log.push(`${placed} one-sided extra${placed > 1 ? 's' : ''}`);
    }
  }

  // ---------- the six construction grammars ----------

  function gAxial(cv) {
    const rng = cv.rng, A = cv.A, ax = A / 2, mirrored = cv.ax !== null;
    const top = rng.uniform(0.16, 0.26), bot = rng.uniform(0.78, 0.86);
    cv.add([L([ax, top], [ax, bot])], 'center', [], true, 'vertical axis');
    cv.posts.push([ax, top, bot, 'center']);
    placeTerminal(cv, { p: [ax, top], u: [0, -1], group: 'center' },
                  [pick(rng, [['cross', 0.4], ['ring', 0.18], ['tri', 0.14], ['tbar', 0.12], ['crescent', 0.06], ['ring2', 0.1]])]);
    // crossbars: 1 to 3
    const nbars = rng.choice([1, 2, 2, 3, 3]);
    const ys = Array.from({ length: nbars }, () => rng.uniform(top + 0.1, bot - 0.1)).sort((a, b) => a - b);
    for (const y of ys) {
      const hw = rng.uniform(0.18, Math.max(0.2, A / 2 - 0.1));
      const a = [ax - hw, y], b = [ax + hw, y];
      cv.add([L(a, b)], 'center', [[ax, y]], true, 'crossbar');
      cv.rails.push([ax - hw, ax + hw, y, 'center']);
      for (const [p, sgn] of [[a, -1], [b, 1]]) {
        if (sgn === 1 && mirrored) break;
        const g = sideGroup(cv);
        if (rng.random() < 0.55) {   // the bar's end turns down (or up) into a post
          const d = y < 0.55 ? 1 : -1;
          const q = [p[0], p[1] + d * rng.uniform(0.12, 0.26)];
          if (cv.add([L(p, q)], g, [p])) {
            cv.posts.push([p[0], Math.min(p[1], q[1]), Math.max(p[1], q[1]), g]);
            cv.socket(q, [0, d], g);
            continue;
          }
        }
        cv.socket(p, [sgn, 0], g);
      }
    }
    // diagonals from the axis
    if (rng.random() < 0.55) {
      const y0 = rng.uniform(top + 0.15, bot - 0.05), dx = rng.uniform(0.2, A / 2 - 0.08), dy = rng.uniform(0.12, 0.3) * rng.choice([1, -1]);
      for (const sgn of mirrored ? [-1] : [-1, 1]) {
        const q = [ax + sgn * dx, y0 + dy];
        if (q[1] > 0.08 && q[1] < 0.92 && cv.add([L([ax, y0], q)], sideGroup(cv), [[ax, y0]], false, 'diagonal arm')) {
          const n = Math.hypot(dx, dy);
          cv.socket(q, [sgn * dx / n, dy / n], sideGroup(cv));
        }
      }
    }
    // foot
    const foot = pick(rng, [['term', 0.55], ['bowl', 0.25], ['legs', 0.2]]);
    if (foot === 'bowl') {
      const hw = rng.uniform(0.15, Math.min(0.32, A / 2 - 0.08)), hb = rng.uniform(0.08, 0.15), yb = bot - hb;
      if (cv.add([{ t: 'arc', c: rnd([ax, yb]), r: rnd([hw, hb]), a: [0, 180] }], 'center', [[ax, bot]], false, 'bowl foot')) {
        cv.socket([ax - hw, yb], [0, -1], sideGroup(cv));
        if (!mirrored) cv.socket([ax + hw, yb], [0, -1], 'center');
        return;
      }
    }
    if (foot === 'legs') {
      const y0 = bot - rng.uniform(0.15, 0.25), dx = rng.uniform(0.12, 0.25);
      const q = [ax - dx, bot];
      if (cv.add([L([ax, y0], q)], sideGroup(cv), [[ax, y0]], false, 'legs')) {
        const n = Math.hypot(dx, bot - y0);
        cv.socket(q, [-dx / n, (bot - y0) / n], sideGroup(cv));
        if (!mirrored) {
          const q2 = [ax + dx, bot];
          cv.add([L([ax, y0], q2)], 'center', [[ax, y0]]);
          cv.socket(q2, [dx / n, (bot - y0) / n], 'center');
        }
      }
    }
    placeTerminal(cv, { p: [ax, bot], u: [0, 1], group: 'center' },
                  [pick(rng, [['ring', 0.45], ['foot', 0.15], ['tbar', 0.15], ['cross', 0.15], ['tri', 0.1]])]);
  }

  function gComb(cv) {
    const rng = cv.rng, A = cv.A, mirrored = cv.ax !== null;
    const yr = rng.uniform(0.25, 0.45), x0 = rng.uniform(0.07, 0.14), x1 = A - x0;
    cv.add([L([x0, yr], [x1, yr])], 'center', [], true, 'rail');
    cv.socket([x0, yr], [-1, 0], sideGroup(cv));
    if (!mirrored) cv.socket([x1, yr], [1, 0], 'center');
    const n = rng.choice([3, 3, 4, 4, 5, 6]);
    const inset = rng.uniform(0.12, 0.2), d = (x1 - x0 - 2 * inset) / (n - 1);
    const length = rng.uniform(0.25, 0.92 - yr - 0.12);
    const xs = x0 + inset;
    // the teeth are one repeat, placed without a collision test, so the
    // terminal must be narrower than the gap or neighbours fuse
    let kind, term, fitted = false;
    for (let i = 0; i < 6 && !fitted; i++) {
      kind = pick(rng, [['ring', 0.35], ['spiral', 0.25], ['cross', 0.1], ['foot', 0.1], ['tbar', 0.1], ['tri', 0.1]]);
      term = terminal(rng, [xs, yr + length], [0, 1], kind);
      fitted = widthX(term) <= d - 3 * cv.s;
    }
    if (!fitted) {   // a smaller ring if there is room for one, else bare teeth
      const room = d - 3 * cv.s;
      [kind, term] = room >= 0.045 ? ['ring', terminal(rng, [xs, yr + length], [0, 1], 'ring', Math.min(1, room / 0.1))] : ['none', []];
    }
    const stem = [L([xs, yr], [xs, yr + length])].concat(term);
    cv.add([{ t: 'repeat', n, d: [rnd(d), 0], m: stem }], 'center', [], true, `${n} teeth with ${kind}`);
    for (let i = 0; i < n; i++) cv.posts.push([xs + i * d, yr, yr + length, 'center']);
    // above the rail: arches, raised crosses, or I-bar heads
    const top = pick(rng, [['arches', 0.3], ['crosses', 0.3], ['ibars', 0.2], ['none', 0.2]]);
    if (top === 'arches') {
      const r = d / 2;
      cv.add([{ t: 'repeat', n: n - 1, d: [rnd(d), 0], m: [{ t: 'arc', c: rnd([xs + r, yr]), r: rnd([r, Math.min(r * rng.uniform(0.8, 1.4), yr - 0.08)]), a: [180, 360] }] }],
             'center', Array.from({ length: n }, (_, i) => [xs + i * d, yr]), false, 'arches over the rail');
    } else if (top === 'crosses' || top === 'ibars') {
      const h = rng.uniform(0.06, Math.min(0.14, yr - 0.16));
      let head;
      if (top === 'crosses') {
        const s = Math.min(crossS(rng) * 0.8, d * 0.42, yr - h - 0.02);
        head = [{ t: 'cross', c: rnd([xs, yr - h - s * 0.95]), s: rnd(s), flared: true, rot: 0 }];
      } else {
        const w = Math.min(d * 0.35, 0.07);
        head = [L([xs - w, yr - h], [xs + w, yr - h])];
      }
      const sel = n >= 3 ? rng.choice(['all', 'odd']) : 'all';
      const [nn, dd] = sel === 'all' ? [n, d] : [Math.floor((n + 1) / 2), 2 * d];
      const m = [L([xs, yr], [xs, yr - h])].concat(head);
      cv.add([{ t: 'repeat', n: nn, d: [rnd(dd), 0], m }], 'center', Array.from({ length: nn }, (_, i) => [xs + i * dd, yr]), false, `${top} above the rail`);
    }
    cv.rails.push([x0, x1, yr, 'center']);
    // optional lower rail closing the teeth into cells
    if (rng.random() < 0.3) {
      const yb = yr + length * rng.uniform(0.45, 0.7);
      cv.add([L([xs, yb], [xs + (n - 1) * d, yb])], 'center', Array.from({ length: n }, (_, i) => [xs + i * d, yb]), false, 'lower rail');
    }
  }

  function gBowl(cv) {
    const rng = cv.rng, A = cv.A, ax = A / 2, mirrored = cv.ax !== null;
    const yr = rng.uniform(0.3, 0.45), x0 = rng.uniform(0.07, 0.15), x1 = A - x0;
    cv.add([L([x0, yr], [x1, yr])], 'center', [], true, 'rail');
    cv.socket([x0, yr], [-1, 0], sideGroup(cv));
    if (!mirrored) cv.socket([x1, yr], [1, 0], 'center');
    const hw = rng.uniform(0.25, ax - x0 - 0.06), hb = rng.uniform(0.28, 0.88 - yr);
    const straight = rng.random() < 0.35;
    if (straight) {   // U with straight walls
      const hs = hb * rng.uniform(0.3, 0.55), hb2 = hb - hs;
      cv.add([{ t: 'mirror', axis: 'x', at: rnd(ax), m: [L([ax - hw, yr], [ax - hw, yr + hs])] },
              { t: 'arc', c: rnd([ax, yr + hs]), r: rnd([hw, hb2]), a: [0, 180] }], 'center', [], true, 'U bowl');
      cv.posts.push([ax - hw, yr, yr + hs, sideGroup(cv)]);
    } else cv.add([{ t: 'arc', c: rnd([ax, yr]), r: rnd([hw, hb]), a: [0, 180] }], 'center', [], true, 'bowl');
    const ybot = yr + hb;
    cv.rails.push([x0, x1, yr, 'center']);
    // above the rail
    const above = pick(rng, [['crosses', 0.4], ['center', 0.35], ['rings', 0.25]]);
    if (above === 'crosses') {
      const n = rng.choice([1, 2, 3]), h = rng.uniform(0.06, 0.12);
      const s = Math.min(crossS(rng), yr - h - 0.02);
      const span = hw * 2 * rng.uniform(0.5, 0.9), dd = n > 1 ? span / (n - 1) : 0;
      const xs = ax - dd * (n - 1) / 2;
      const m = [L([xs, yr], [xs, yr - h]), { t: 'cross', c: rnd([xs, yr - h - s * 0.95]), s: rnd(s), flared: true, rot: 0 }];
      cv.add(n > 1 ? [{ t: 'repeat', n, d: [rnd(dd), 0], m }] : m, 'center',
             Array.from({ length: n }, (_, i) => [xs + i * dd, yr]), false, `${n} crosses on the rail`);
    } else if (above === 'rings') ringrow(cv);
    else {
      const h = rng.uniform(0.05, 0.12);
      cv.add([L([ax, yr], [ax, yr - h])], 'center', [[ax, yr]]);
      placeTerminal(cv, { p: [ax, yr - h], u: [0, -1], group: 'center' }, ['cross', 'tri', 'tbar', 'ring']);
    }
    // inside the bowl
    if (!straight && rng.random() < 0.25) {   // a second bowl inside the first (Agares)
      const f = rng.uniform(0.55, 0.75);
      cv.add([{ t: 'arc', c: rnd([ax, yr]), r: rnd([hw * f, hb * f]), a: [0, 180] }], 'center',
             [[ax - hw * f, yr], [ax + hw * f, yr]], false, 'inner bowl');
    }
    const inside = pick(rng, [['stem', 0.45], ['rings', 0.25], ['box', 0.15], ['none', 0.15]]);
    if (inside === 'stem') {
      const q = [ax, yr + hb * rng.uniform(0.4, 0.65)];
      if (cv.add([L([ax, yr], q)], 'center', [[ax, yr]], false, 'stem in the bowl')) {
        cv.posts.push([ax, yr, q[1], 'center']);
        placeTerminal(cv, { p: q, u: [0, 1], group: 'center' }, [pick(rng, [['tri', 0.3], ['ring', 0.3], ['cross', 0.25], ['foot', 0.15]])]);
      }
    } else if (inside === 'rings') {
      const r = ringR(rng) * 0.9, n = rng.choice([2, 3, 4]), dd = 2 * r + cv.s * 2;
      const y = rng.random() < 0.6 ? yr + r + cv.s * 2.5 : yr + hb * 0.5;
      cv.add([{ t: 'repeat', n, d: [rnd(dd), 0], m: [{ t: 'ring', c: rnd([ax - dd * (n - 1) / 2, y]), r: rnd(r) }] }], 'center', [], false, 'ring row in the bowl');
    } else if (inside === 'box') {
      const w = hw * rng.uniform(0.3, 0.5), h = hb * rng.uniform(0.25, 0.4), y0 = yr + hb * 0.2;
      cv.add([{ t: 'pline', p: rnd([[ax - w, y0], [ax + w, y0], [ax + w, y0 + h], [ax - w, y0 + h]]), closed: true }], 'center', [], false, 'cell in the bowl');
    }
    // foot under the bowl
    if (rng.random() < 0.7) {
      placeTerminal(cv, { p: [ax, ybot], u: [0, 1], group: 'center' }, [pick(rng, [['ring', 0.5], ['foot', 0.2], ['cross', 0.15], ['tri', 0.15]])]);
    }
  }

  // closed rectilinear outline with a stepped top (and sometimes a stepped bottom)
  function skyline(rng, x0, x1, ytop, ybot, cols, mirrored) {
    const xs = linspace(x0, x1, cols + 1);
    let tops = Array.from({ length: cols }, () => ytop + rng.choice([0, 0, 0.08, 0.14, -0.06]));
    const bots = Array.from({ length: cols }, () => ybot - rng.choice([0, 0, 0, 0.1]));
    if (mirrored) for (let i = 0; i < Math.floor(cols / 2); i++) { tops[cols - 1 - i] = tops[i]; bots[cols - 1 - i] = bots[i]; }
    tops = tops.map(t => Math.min(Math.max(t, 0.06), ybot - 0.2));
    const pts = [];
    for (let i = 0; i < cols; i++) pts.push([xs[i], tops[i]], [xs[i + 1], tops[i]]);
    for (let i = cols - 1; i >= 0; i--) pts.push([xs[i + 1], bots[i]], [xs[i], bots[i]]);
    const out = [];
    for (const p of pts) {
      const q = out[out.length - 1];
      if (q && Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9) continue;
      out.push(p);
    }
    return { pts: out, xs, tops, bots };
  }

  function gCompartment(cv) {
    const rng = cv.rng, A = cv.A, ax = A / 2, mirrored = cv.ax !== null;
    const x0 = rng.uniform(0.1, 0.22), x1 = A - x0;
    const ytop = rng.uniform(0.2, 0.32), ybot = rng.uniform(0.68, 0.82);
    const style = pick(rng, [['stepped', 0.3], ['cells', 0.22], ['arched', 0.14], ['domed', 0.12], ['rounded', 0.1], ['nested', 0.12]]);
    const cols = rng.choice([3, 3, 4, 5]);
    let xs, tops, bots, cells;
    if (style === 'stepped') {
      const sk = skyline(rng, x0, x1, ytop, ybot, cols, mirrored);
      ({ xs, tops, bots } = sk);
      cv.add([{ t: 'pline', p: rnd(sk.pts), closed: true }], 'center', [], true, `stepped outline, ${cols} bays`);
      cells = Array.from({ length: cols }, (_, i) => [(xs[i] + xs[i + 1]) / 2, (tops[i] + bots[i]) / 2]);
      for (let i = 0; i < cols; i++) { cv.rails.push([xs[i], xs[i + 1], tops[i], 'center']); cv.rails.push([xs[i], xs[i + 1], bots[i], 'center']); }
      if (rng.random() < 0.5) {   // internal walls
        for (let i = 1; i < cols; i++) {
          const ya = Math.max(tops[i - 1], tops[i]), yb = Math.min(bots[i - 1], bots[i]);
          if (yb - ya > 0.15) cv.add([L([xs[i], ya], [xs[i], yb])], 'center', [[xs[i], ya], [xs[i], yb]]);
        }
      }
    } else {
      if (style === 'arched') {
        const r = (x1 - x0) / (2 * cols);
        const ms = [L([x0, ytop], [x0, ybot]), L([x1, ytop], [x1, ybot]), L([x0, ybot], [x1, ybot]),
                    { t: 'repeat', n: cols, d: [rnd(2 * r), 0], m: [{ t: 'arc', c: rnd([x0 + r, ytop]), r: rnd([r, Math.min(r, ytop - 0.06)]), a: [180, 360] }] }];
        if (rng.random() < 0.5) ms.push(L([x0, ytop], [x1, ytop]));
        cv.add(ms, 'center', [], true, `arched frame, ${cols} arches`);
      } else if (style === 'domed') {        // walls and floor under one dome (Barbatos, Amon)
        const hw = (x1 - x0) / 2, hh = Math.min(hw * rng.uniform(0.35, 0.7), ytop - 0.05);
        const ms = [L([x0, ytop], [x0, ybot]), L([x1, ytop], [x1, ybot]), L([x0, ybot], [x1, ybot]),
                    { t: 'arc', c: rnd([(x0 + x1) / 2, ytop]), r: rnd([hw, hh]), a: [180, 360] }];
        if (rng.random() < 0.5) ms.push(L([x0, ytop], [x1, ytop]));
        cv.add(ms, 'center', [], true, 'domed frame');
      } else if (style === 'rounded' && x1 - x0 > ybot - ytop + 0.1) {   // straight sides, round ends
        const r = (ybot - ytop) / 2, ym = (ytop + ybot) / 2;
        cv.add([L([x0 + r, ytop], [x1 - r, ytop]), L([x0 + r, ybot], [x1 - r, ybot]),
                { t: 'arc', c: rnd([x0 + r, ym]), r: rnd(r), a: [90, 270] }, { t: 'arc', c: rnd([x1 - r, ym]), r: rnd(r), a: [270, 450] }],
               'center', [], true, 'rounded frame');
      } else if (style === 'nested') {        // a frame within a frame
        const d = rng.uniform(0.045, 0.075);
        cv.add([{ t: 'pline', p: rnd([[x0, ytop], [x1, ytop], [x1, ybot], [x0, ybot]]), closed: true },
                { t: 'pline', p: rnd([[x0 + d, ytop + d], [x1 - d, ytop + d], [x1 - d, ybot - d], [x0 + d, ybot - d]]), closed: true }],
               'center', [], true, 'nested frames');
      } else {
        cv.add([{ t: 'pline', p: rnd([[x0, ytop], [x1, ytop], [x1, ybot], [x0, ybot]]), closed: true }], 'center', [], true, `frame of ${cols} cells`);
      }
      xs = linspace(x0, x1, cols + 1);
      if (style === 'cells') {
        cv.add([{ t: 'repeat', n: cols - 1, d: [rnd(xs[1] - xs[0]), 0], m: [L([xs[1], ytop], [xs[1], ybot])] }], 'center', [], true);
        if (rng.random() < 0.35) {
          const ym = (ytop + ybot) / 2;
          cv.add([L([x0, ym], [x1, ym])], 'center', [], true, 'middle rail');
        }
      }
      cells = Array.from({ length: cols }, (_, i) => [(xs[i] + xs[i + 1]) / 2, (ytop + ybot) / 2]);
      cv.rails.push([x0, x1, ytop, 'center']); cv.rails.push([x0, x1, ybot, 'center']);
      tops = Array(cols).fill(ytop); bots = Array(cols).fill(ybot);
    }
    cv.posts.push([x0, tops[0], bots[0], sideGroup(cv)]);
    if (!mirrored) cv.posts.push([x1, tops[cols - 1], bots[cols - 1], 'center']);
    // stems out of the outline's corners (the end bays' corners, where the outline is)
    const lt = [x0, tops[0]], lb = [x0, bots[0]], rt = [x1, tops[cols - 1]], rb = [x1, bots[cols - 1]];
    let corners = [[lt, [0, -1]], [lb, [0, 1]], [lt, [-1, 0]], [lb, [-1, 0]]];
    if (!mirrored) corners = corners.concat([[rt, [0, -1]], [rb, [0, 1]], [rt, [1, 0]], [rb, [1, 0]]]);
    for (const [p, u] of rng.sample(corners, rng.choice([1, 2, 2, 3]))) {
      const q = add(p, u, rng.uniform(0.05, 0.12));
      if (cv.add([L(p, q)], sideGroup(cv), [p], false, 'stem at a corner')) cv.socket(q, u, sideGroup(cv));
    }
    // fill cells: crosses mostly, mirrored where the frame is
    const kinds = [['cross', 0.55], ['ring', 0.15], ['tri', 0.1], ['ringrow', 0.1], ['diamond', 0.1]];
    for (const [cx, cy] of cells) {
      if (mirrored && cx > ax + 1e-6) break;
      if (rng.random() < 0.25) continue;
      const onAxis = mirrored && Math.abs(cx - ax) < 1e-6;
      const g = onAxis || !mirrored ? 'center' : 'side';
      const k = pick(rng, kinds), cw = (xs[1] - xs[0]) / 2;
      let ms;
      if (k === 'cross') ms = [{ t: 'cross', c: rnd([cx, cy]), s: rnd(Math.min(crossS(rng), cw * 0.75, 0.12)), flared: true, rot: 0 }];
      else if (k === 'ring') ms = [{ t: 'ring', c: rnd([cx, cy]), r: rnd(ringR(rng)) }];
      else if (k === 'ringrow') {
        const r = Math.min(ringR(rng), cw * 0.35), dd = 2 * r + cv.s * 1.8;
        ms = [{ t: 'repeat', n: 2, d: [0, rnd(dd)], m: [{ t: 'ring', c: rnd([cx, cy - dd / 2]), r: rnd(r) }] }];
      } else if (k === 'diamond') {
        const h = Math.min(0.06, cw * 0.6);
        ms = [{ t: 'pline', p: rnd([[cx, cy - h], [cx + h, cy], [cx, cy + h], [cx - h, cy]]), closed: true, fill: rng.random() < 0.5 }];
      } else {
        const h = Math.min(0.07, cw * 0.6);
        ms = [{ t: 'tri', p: rnd([[cx, cy - h], [cx + h, cy + h * 0.8], [cx - h, cy + h * 0.8]]) }];
      }
      cv.add(ms, g, [], false, `${k} in a cell`);
    }
    // a crowning element on the axis
    if (mirrored && rng.random() < 0.6) {
      const h = rng.uniform(0.04, 0.1);
      if (cv.add([L([ax, ytop], [ax, ytop - h])], 'center', [[ax, ytop]])) {
        placeTerminal(cv, { p: [ax, ytop - h], u: [0, -1], group: 'center' }, ['cross', 'ring', 'tri']);
      }
    }
  }

  // spokes from a hub: an X (Decarabia, Haures), an X on an upright axis
  // (Murmur), eight rays (Volac), or a pentagram (Astaroth); sometimes framed (Oso)
  function gRadial(cv) {
    const rng = cv.rng, A = cv.A, ax = A / 2, cy = 0.5;
    const form = pick(rng, [['x', 0.35], ['x_axis', 0.25], ['star8', 0.2], ['star5', 0.2]]);
    const rr = rng.uniform(0.3, 0.4);
    const k1 = pick(rng, [['ring', 0.35], ['cross', 0.3], ['crescent', 0.2], ['tbar', 0.1], ['tri', 0.05]]);
    if (form === 'star5') {
      const R5 = rng.uniform(0.36, 0.44), cy5 = 0.52;
      const pts = Array.from({ length: 5 }, (_, i) => [ax + R5 * Math.cos((-90 + 144 * i) * RAD), cy5 + R5 * Math.sin((-90 + 144 * i) * RAD)]);
      cv.add([{ t: 'pline', p: rnd(pts), closed: true }], 'center', [], true, 'pentagram');
      const kt = pick(rng, [['ring', 0.6], ['cross', 0.25], ['dot', 0.15]]);
      for (const p of pts.slice(0, 3)) {   // the top point and the left two; the rest mirror
        if (p[0] > ax + 1e-6) continue;
        const u = [(p[0] - ax) / R5, (p[1] - cy5) / R5];
        cv.add(terminal(rng, p, u, kt, 0.8), Math.abs(p[0] - ax) < 1e-6 ? 'center' : sideGroup(cv), [p]);
      }
      if (cv.ax === null) {
        for (const p of pts) {
          if (p[0] > ax + 1e-6) cv.add(terminal(rng, p, [(p[0] - ax) / R5, (p[1] - cy5) / R5], kt, 0.8), 'center', [p]);
        }
      }
      cv.add([{ t: 'ring', c: rnd([ax, cy5]), r: rnd(rng.uniform(0.04, 0.07)) }], 'center', [], false, 'ring at the centre');
      return;
    }
    if (form === 'x' || form === 'x_axis' || form === 'star8') {
      const u = unit(180 + rng.uniform(35, 55));   // up-left
      const p = [ax + u[0] * rr, cy + u[1] * rr];
      let spoke = [L([ax, cy], p)].concat(terminal(rng, p, u, k1, 0.9));
      if (rng.random() < 0.5) {   // a bar across each spoke, with rings or small crosses
        const q = add([ax, cy], u, rr * rng.uniform(0.45, 0.65)), v = perp(u), h = rng.uniform(0.05, 0.08);
        const kb = pick(rng, [['ring', 0.6], ['none', 0.25], ['tri', 0.15]]);
        const a1 = add(q, v, h), a2 = add(q, v, -h);
        spoke = spoke.concat([L(a1, a2)], terminal(rng, a1, v, kb, 0.7), terminal(rng, a2, [-v[0], -v[1]], kb, 0.7));
      }
      if (cv.ax !== null) {
        cv.add([{ t: 'mirror', axis: 'y', at: cy, m: [{ t: 'mirror', axis: 'x', at: rnd(ax), m: spoke }] }], 'center', [], true, `X of four spokes with ${k1}`);
      } else {   // unmirrored: the right-hand arms end differently, as on Decarabia (crescents and crosses)
        const k1b = pick(rng, [['ring', 0.35], ['cross', 0.3], ['crescent', 0.2], ['tbar', 0.1], ['tri', 0.05]], [k1]);
        const ur = [-u[0], u[1]], pr = [ax + ur[0] * rr, cy + ur[1] * rr];
        cv.add([{ t: 'mirror', axis: 'y', at: cy, m: spoke.concat([L([ax, cy], pr)], terminal(rng, pr, ur, k1b, 0.9)) }], 'center', [], true,
               `X of four spokes with ${k1} and ${k1b}`);
      }
    }
    if (form === 'x_axis' || form === 'star8') {
      const k2 = pick(rng, [['ring', 0.3], ['cross', 0.35], ['tri', 0.15], ['tbar', 0.1], ['crescent', 0.1]]);
      const r2 = form === 'x_axis' ? rr * rng.uniform(0.95, 1.2) : rr * rng.uniform(0.85, 1);
      let m = [];
      for (const uu of [[0, -1], [0, 1]]) {
        const p = [ax, cy + uu[1] * r2];
        m = m.concat([L([ax, cy], p)], terminal(rng, p, uu, uu[1] < 0 || rng.random() < 0.6 ? k2 : 'ring', 0.9));
      }
      cv.add(m, 'center', [], true, `upright axis with ${k2}`);
      cv.posts.push([ax, cy - r2, cy + r2, 'center']);
      if (form === 'star8') {
        const pl = [ax - r2 * 0.95, cy];
        cv.add([{ t: 'mirror', axis: 'x', at: rnd(ax), m: [L([ax, cy], pl)].concat(terminal(rng, pl, [-1, 0], k2, 0.9)) }], 'center', [], true, 'level spokes');
        cv.rails.push([pl[0], 2 * ax - pl[0], cy, 'center']);
      }
    }
    const hub = pick(rng, [['ring', 0.35], ['cross', 0.2], ['square', 0.2], ['rings2', 0.1], ['none', 0.15]]);
    if (hub === 'ring') cv.add([{ t: 'ring', c: rnd([ax, cy]), r: rnd(rng.uniform(0.05, 0.09)) }], 'center', [], true, 'hub ring');
    else if (hub === 'rings2') {
      const r = rng.uniform(0.07, 0.1);
      cv.add([{ t: 'ring', c: rnd([ax, cy]), r: rnd(r) }, { t: 'ring', c: rnd([ax, cy]), r: rnd(r * 0.55) }], 'center', [], true, 'double hub ring');
    } else if (hub === 'cross') cv.add([{ t: 'cross', c: rnd([ax, cy]), s: rnd(rng.uniform(0.07, 0.11)), flared: true, rot: 0 }], 'center', [], true, 'hub cross');
    else if (hub === 'square') {
      const h = rng.uniform(0.06, 0.1);
      cv.add([{ t: 'pline', p: rnd([[ax - h, cy - h], [ax + h, cy - h], [ax + h, cy + h], [ax - h, cy + h]]), closed: true }], 'center', [], true, 'hub square');
    }
    if (form === 'x' && rng.random() < 0.35) {   // frame around the X, the spokes' tips on its corners
      const h = rr * 0.72;
      const fr = [[ax - h, cy - h], [ax + h, cy - h], [ax + h, cy + h], [ax - h, cy + h]];
      if (cv.add([{ t: 'pline', p: rnd(fr), closed: true }], 'center', fr, false, 'frame around the X')) {
        cv.rails.push([ax - h, ax + h, cy - h, 'center'], [ax - h, ax + h, cy + h, 'center']);
        cv.posts.push([ax - h, cy - h, cy + h, sideGroup(cv)]);
      }
    }
  }

  // an S-shaped stroke rising (or falling) from p, ending in a curl or a ring
  function sHook(cv, p, up) {
    const rng = cv.rng;
    const h = rng.uniform(0.18, 0.3) * (up ? -1 : 1), w = rng.uniform(0.08, 0.16) * rng.choice([1, -1]);
    const q = [p[0] + w, p[1] + h];
    const ms = [{ t: 'bez', p: rnd([p, [p[0], p[1] + h * 0.45], [q[0], p[1] + h * 0.55], q]) }]
      .concat(terminal(rng, q, [0, up ? -1 : 1], rng.choice(['spiral', 'spiral', 'ring', 'cross'])));
    return cv.add(ms, 'center', [p], false, 'S-hook');
  }

  function gCursive(cv) {
    const rng = cv.rng, A = cv.A;
    const main = pick(rng, [['zbend', 0.3], ['loop', 0.35], ['wave', 0.2], ['crook', 0.15]]);
    const y = rng.uniform(0.42, 0.58), x0 = rng.uniform(0.1, 0.18), x1 = A - rng.uniform(0.1, 0.18);
    if (main === 'zbend') {
      const ya = rng.uniform(0.2, 0.32), yb = rng.uniform(0.68, 0.8);
      const xa = x0 + rng.uniform(0, 0.15), xb = x1 - rng.uniform(0.15, 0.35);
      const xc = x0 + rng.uniform(0.15, 0.35), xd = x1 - rng.uniform(0, 0.15);
      cv.add([{ t: 'pline', p: rnd([[xa, ya], [xb, ya], [xc, yb], [xd, yb]]) }], 'center', [], true, 'Z-bend');
      cv.socket([xa, ya], [-1, 0], 'center'); cv.socket([xd, yb], [1, 0], 'center');
      cv.rails.push([xa, xb, ya, 'center'], [xc, xd, yb, 'center']);
    } else if (main === 'wave') {
      const amp = rng.uniform(0.1, 0.18) * rng.choice([1, -1]), w = x1 - x0;
      const p = [[x0, y], [x0 + w * 0.25, y - amp * 1.6], [x0 + w * 0.42, y - amp * 1.6], [x0 + w * 0.5, y],
                 [x0 + w * 0.58, y + amp * 1.6], [x0 + w * 0.75, y + amp * 1.6], [x1, y]];
      cv.add([{ t: 'bez', p: rnd(p) }], 'center', [], true, 'S-wave');
      cv.socket([x0, y], [-1, 0], 'center'); cv.socket([x1, y], [1, 0], 'center');
      const r = rng.uniform(0.12, 0.2), cx = x0 + w * rng.choice([0.25, 0.75]);
      cv.add([{ t: 'arc', c: rnd([cx, y - amp * 1.2 * (cx < x0 + w / 2 ? 1 : -1)]), r: rnd([r * 1.3, r]), a: [0, 360] }], 'center', [], false, 'loop on the wave');
    } else if (main === 'crook') {
      const xs = x0 + rng.uniform(0.15, 0.3);
      cv.add([L([x0, y], [x1, y]), L([xs, 0.85], [xs, 0.3])], 'center', [], true, 'rail and crook');
      const r0 = rng.uniform(0.09, 0.14);
      cv.add([{ t: 'spiral', c: rnd([xs + r0, 0.3]), r: rnd([r0, r0 * 0.25]), a: [180, 420] }], 'center', [], true);
      cv.socket([x0, y], [-1, 0], 'center'); cv.socket([x1, y], [1, 0], 'center'); cv.socket([xs, 0.85], [0, 1], 'center');
      cv.rails.push([x0, x1, y, 'center']); cv.posts.push([xs, 0.3, 0.85, 'center']);
    } else {
      cv.add([L([x0, y], [x1, y])], 'center', [], true, 'rail');
      const rx = rng.uniform(0.2, 0.32), ry = rng.uniform(0.12, 0.2), cxl = rng.uniform(x0 + rx, x1 - rx);
      cv.add([{ t: 'arc', c: rnd([cxl, y]), r: rnd([rx, ry]), a: [0, 360] }], 'center', [], true, 'elliptical loop on the rail');
      cv.socket([x0, y], [-1, 0], 'center'); cv.socket([x1, y], [1, 0], 'center');
      cv.rails.push([x0, x1, y, 'center']);
    }
    // curls at the ends are the cursive family's commonest terminal
    for (const s of cv.sockets.slice()) {
      if (rng.random() < 0.7) {
        cv.sockets.splice(cv.sockets.indexOf(s), 1);
        placeTerminal(cv, s, ['spiral', 'ring']);
      }
    }
    const nh = rng.choice([1, 2, 2, 3]);
    for (let i = 0; i < nh; i++) {
      if (cv.rails.length) {
        const [a, b, yy] = rng.choice(cv.rails);
        sHook(cv, [rng.uniform(a + 0.05, b - 0.05), yy], rng.random() < 0.6);
      }
    }
  }

  const GRAMMARS = { axial: gAxial, comb: gComb, bowl: gBowl, compartment: gCompartment, radial: gRadial, cursive: gCursive };
  // Share of the family's drawings on the sheet with sym_lr > 0.8 (axial 0.62,
  // comb 0.18, bowl 0.46, compartment 0.22, radial 0.5, cursive 0), raised a
  // little because half of the mirrored seals get one-sided extras.
  // Lowered by an eighth when the new symmetric parts (domes, rounded and nested
  // frames, forks) pushed sym_lr up by 0.24 to 0.64 sd in five samples of 72 visits.
  const MIRROR_P = { axial: 0.63, comb: 0.26, bowl: 0.53, compartment: 0.28, radial: 0.62, cursive: 0 };

  // ---------- normalisation to the encoding convention ----------

  function transform(m, k, dx, dy) {
    m = clone(m);
    const P = p => [rnd((p[0] + dx) * k), rnd((p[1] + dy) * k)];
    const t = m.t;
    if (t === 'line') m.p = P(m.p.slice(0, 2)).concat(P(m.p.slice(2)));
    else if (['pline', 'bez', 'tri', 'path'].includes(t)) m.p = m.p.map(P);
    else if (['arc', 'ring', 'dot', 'cross', 'spiral', 'crescent'].includes(t)) {
      m.c = P(m.c);
      if (m.r !== undefined) m.r = Array.isArray(m.r) ? m.r.map(x => rnd(x * k)) : rnd(m.r * k);
      if (m.ri !== undefined) m.ri = rnd(m.ri * k);
      if (m.s !== undefined) m.s = rnd(m.s * k);
    } else if (t === 'repeat') {
      m.d = [rnd(m.d[0] * k), rnd(m.d[1] * k)];
      m.m = m.m.map(x => transform(x, k, dx, dy));
    } else if (t === 'mirror') {
      m.at = rnd((m.at + (m.axis === 'x' ? dx : dy)) * k);
      m.m = m.m.map(x => transform(x, k, dx, dy));
    }
    if (m.w !== undefined) m.w = rnd(m.w * k);
    return m;
  }

  function normalise(enc, trace = null) {
    const big = 400, pad = 40;
    const W = Math.round(enc.aspect * big) + 2 * pad, H = big + 2 * pad;
    const pix = rasterize(expand(enc.members), W, H, big, pad, enc.stroke, true);
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const i of pix) {
      const x = i % W, y = (i - x) / W;
      if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    }
    const x0 = (xMin - pad) / big, x1 = (xMax + 1 - pad) / big, y0 = (yMin - pad) / big, y1 = (yMax + 1 - pad) / big;
    const k = 1 / (y1 - y0);
    enc.members = enc.members.map(m => transform(m, k, -x0, -y0));
    if (trace) for (const step of trace) step.prims = step.prims.map(m => transform(m, k, -x0, -y0));
    enc.aspect = rnd((x1 - x0) * k, 3);
    enc.stroke = rnd(clamp(enc.stroke * k, 0.026, 0.046), 4);   // encodings' q10..max
    return enc;
  }

  // ---------- novelty (tools/novelty.py) ----------
  // A seal is novel when its skeleton F-score against every one of the 80
  // drawings on the sheet (best over shifts and four flips) is at most the 95th
  // percentile of real seals' similarity to their nearest other seal. The
  // references are the Python skeletons; only the new seal is thinned here.
  // On 72 seals this score differs from tools/novelty.py by at most 0.0195, so
  // the browser rejects anything within NOVELTY_MARGIN of the threshold: every
  // seal it keeps also passes the Python test.
  const NOVELTY_MARGIN = 0.02;

  // Zhang-Suen thinning as scikit-image 0.26 does it (_fast_skeletonize): the
  // removal table below is copied from skimage/morphology/_skeletonize_various_cy.pyx;
  // 1 = removable in the first sub-pass, 2 = in the second, 3 = in both
  const THIN_LUT = [0, 0, 0, 1, 0, 0, 1, 3, 0, 0, 3, 1, 1, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 3, 0, 3, 3,
    0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 2, 2,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 2, 0,
    0, 0, 3, 1, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 3, 1, 3, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 1, 0, 0, 0, 0, 2, 2, 0, 0, 2, 0, 0, 0];

  function skeletonize(img, W, H) {
    let sk = img.slice(), removed = true;
    while (removed) {
      removed = false;
      for (let pass = 0; pass < 2; pass++) {
        const cleaned = sk.slice();
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            if (!sk[i]) continue;
            const n = THIN_LUT[sk[i - W - 1] + 2 * sk[i - W] + 4 * sk[i - W + 1] + 8 * sk[i + 1] +
                               16 * sk[i + W + 1] + 32 * sk[i + W] + 64 * sk[i + W - 1] + 128 * sk[i - 1]];
            if (n === 3 || (n === 1 && pass === 0) || (n === 2 && pass === 1)) { cleaned[i] = 0; removed = true; }
          }
        }
        sk = cleaned;
      }
    }
    img.set(sk);
    return img;
  }

  // area-average resampling (OpenCV INTER_AREA for a reduction)
  function areaResize(src, sw, sh, dw, dh) {
    const out = new Float64Array(dw * dh), fx = sw / dw, fy = sh / dh;
    for (let dy = 0; dy < dh; dy++) {
      const y0 = dy * fy, y1 = y0 + fy;
      for (let dx = 0; dx < dw; dx++) {
        const x0 = dx * fx, x1 = x0 + fx;
        let acc = 0;
        for (let iy = Math.floor(y0); iy < Math.min(sh, Math.ceil(y1)); iy++) {
          const wy = Math.min(y1, iy + 1) - Math.max(y0, iy);
          for (let ix = Math.floor(x0); ix < Math.min(sw, Math.ceil(x1)); ix++) {
            acc += src[iy * sw + ix] * wy * (Math.min(x1, ix + 1) - Math.max(x0, ix));
          }
        }
        out[dy * dw + dx] = acc / (fx * fy);
      }
    }
    return out;
  }

  // each reference under the four flips: its skeleton pixels and a map of the
  // pixels within tau of it. Skeletons lie inside the 96 px box and the padding
  // equals the largest shift, so shifted indices never leave the image (the
  // wrap-around of np.roll in tools/novelty.py never comes into play).
  let REFS = null;
  function flips(idx, near, side) {
    const out = [];
    for (const [flx, fly] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const map = i => { const x = i % side, y = (i - x) / side; return (fly ? side - 1 - y : y) * side + (flx ? side - 1 - x : x); };
      const fnear = new Uint8Array(side * side);
      for (let i = 0; i < side * side; i++) if (near[i]) fnear[map(i)] = 1;
      out.push({ idx: Int32Array.from(idx, map), near: fnear });
    }
    return out;
  }
  function nearMap(skIdx, side, tau) {
    const sk = new Uint8Array(side * side);
    for (const i of skIdx) sk[i] = 1;
    const dt = distanceTransform(sk.map(v => 1 - v), side, side), near = new Uint8Array(side * side);
    for (let i = 0; i < side * side; i++) near[i] = dt[i] <= tau ? 1 : 0;
    return near;
  }
  function novelRefs() {
    if (REFS) return REFS;
    const nv = D.novelty, side = nv.side;
    REFS = nv.refs.map(r => {
      const bin = atob(r.sk), idx = new Int32Array(bin.length / 2);
      for (let i = 0; i < idx.length; i++) idx[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      return { id: r.id, identity: r.identity, flips: flips(idx, nearMap(idx, side, nv.tau), side) };
    });
    return REFS;
  }

  // skeleton of a seal as tools/novelty.py makes it: rendered at 133 px, cropped,
  // scaled (aspect kept) into 96 x 96, thresholded, padded, thinned
  function sealSkeleton(enc) {
    const nv = D.novelty, N = nv.n, S = nv.shift, side = nv.side;
    // sigil.render(enc, 133, exact=True): whole-pixel strokes at 4x, 4 x 4 area average, grey < 128
    const W4 = Math.round(enc.aspect * 532) + 32, H4 = 532 + 32, W = Math.floor(W4 / 4), H = Math.floor(H4 / 4);
    const big = new Uint8Array(W4 * H4);
    for (const i of rasterize(expand(enc.members), W4, H4, 532, 16, enc.stroke, false, true)) big[i] = 1;
    const ink = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) n += big[(4 * y + dy) * W4 + 4 * x + dx];
        ink[y * W + x] = n >= 9 ? 255 : 0;   // cv2 stores the mean 127.5 (8 of 16) as 128: not ink
      }
    }
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, crop = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) crop[y * w + x] = ink[(y + y0) * W + x + x0];
    const k = N / Math.max(w, h), dw = Math.max(1, Math.floor(w * k)), dh = Math.max(1, Math.floor(h * k));
    const small = areaResize(crop, w, h, dw, dh);
    const img = new Uint8Array(side * side), oy = Math.floor((N - dh) / 2) + S, ox = Math.floor((N - dw) / 2) + S;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) if (small[y * dw + x] > 64) img[(y + oy) * side + x + ox] = 1;
    skeletonize(img, side, side);
    const idx = [];
    for (let i = 0; i < side * side; i++) if (img[i]) idx.push(i);
    return { idx: Int32Array.from(idx), near: nearMap(idx, side, nv.tau) };
  }

  // skeleton F-score of seal a against reference b, best over flips of b and shifts
  function similarity(a, b) {
    const nv = D.novelty, side = nv.side, S = nv.shift;
    let best = 0;
    for (const f of b.flips) {
      for (let dy = -S; dy <= S; dy += 2) {
        for (let dx = -S; dx <= S; dx += 2) {
          const off = dy * side + dx;
          let p = 0, r = 0;
          for (const i of f.idx) p += a.near[i + off];   // reference pixels near the seal
          for (const i of a.idx) r += f.near[i - off];   // seal pixels near the reference
          p /= f.idx.length; r /= a.idx.length;
          if (p + r > 0) best = Math.max(best, 2 * p * r / (p + r));
        }
      }
    }
    return best;
  }

  function novelty(enc) {
    const a = sealSkeleton(enc);
    let best = { sim: -1, nearest: null };
    for (const ref of novelRefs()) {
      const s = similarity(a, ref);
      if (s > best.sim) best = { sim: s, nearest: ref.id };
    }
    const threshold = D.novelty.threshold - NOVELTY_MARGIN;
    return { nearest: best.nearest, sim: rnd(best.sim, 4), threshold: rnd(threshold, 4), novel: best.sim <= threshold };
  }

  // ---------- one seal, a set of seals ----------

  // opts.trace: also return the construction, step by step (enc.trace)
  function generateSeal(seed, family, id, opts = {}) {
    const rng = makeRng(seed);
    const totals = D.per.filter(r => r.family === family).map(r => r.total);
    for (let attempt = 0; attempt < 20; attempt++) {
      const A = clamp(rng.choice(D.aspects[family]) * rng.uniform(0.88, 1), 0.85, 1.9);
      const stroke = clamp(rng.choice(D.per).stroke, 0.025, 0.045);
      const mirror = rng.random() < MIRROR_P[family];
      const cv = new Canvas(rng, A, stroke, mirror);
      GRAMMARS[family](cv);
      const target = rng.choice(totals.length ? totals : D.per.map(r => r.total)) * rng.uniform(0.95, 1.25);
      decorate(cv, target);
      if (cv.count < 12) continue;
      const enc = normalise({
        id, identity: null, variant: null, name: null, vocab: '1.0',
        aspect: A, stroke, family, generated: true, seed,
        members: cv.members(), escapes: [],
        notes: `${family}${mirror ? ' (mirrored)' : ''}: ${[...new Set(cv.log)].join('; ')}.`,
        target_primitives: Math.round(target),
      }, opts.trace ? cv.trace : null);
      if (opts.trace) enc.trace = cv.trace;
      return enc;
    }
    throw new Error('no seal after 20 attempts');
  }

  // a seal that passes the novelty test: a seal too close to one on the sheet
  // is discarded and the next seed in a fixed sequence is tried
  function generateNovelSeal(seed, family, id, opts = {}) {
    let s = seed >>> 0;
    const discarded = [];   // nearest drawing and similarity of each draw thrown away
    for (let rejected = 0; rejected < 10; rejected++) {
      const enc = generateSeal(s, family, id, opts);
      enc.novelty = novelty(enc);
      enc.novelty.rejected = rejected;
      enc.novelty.discarded = discarded.slice();
      if (enc.novelty.novel) return enc;
      discarded.push({ nearest: enc.novelty.nearest, sim: enc.novelty.sim });
      s = (Math.imul(s, 2654435761) + 0x9E3779B9) >>> 0;
    }
    throw new Error('no novel seal after 10 seeds');
  }

  // a primitive as polylines in seal units ({pts, closed}), for drawing its outline
  function outlines(m) {
    const t = m.t;
    if (t === 'line') return [{ pts: [m.p.slice(0, 2), m.p.slice(2)], closed: false }];
    if (t === 'pline') return [{ pts: m.p, closed: !!(m.closed || m.fill) }];
    if (t === 'tri') return [{ pts: m.p, closed: true }];
    if (t === 'bez' || t === 'path') return [{ pts: bezPoints(m.p), closed: false }];
    if (t === 'arc') return [{ pts: arcPoints(m.c, m.r, m.a[0], m.a[1]), closed: false }];
    if (t === 'ring' || t === 'dot') return [{ pts: arcPoints(m.c, m.r, 0, 360, 48), closed: true }];
    if (t === 'spiral') return [{ pts: spiralPoints(m.c, m.r[0], m.r[1], m.a[0], m.a[1]), closed: false }];
    if (t === 'crescent') return [{ pts: crescentPoly(m.c, m.r, m.k === undefined ? 0.35 : m.k, m.rot || 0, m.ri), closed: true }];
    if (t === 'cross') {
      const rot = m.rot || 0;
      if (m.flared === false) return [0, 1].map(j => { const u = unit(rot + 90 * j); return { pts: [add(m.c, u, -m.s), add(m.c, u, m.s)], closed: false }; });
      return crossPolys(m.c, m.s, rot).map(pts => ({ pts, closed: true }));
    }
    return [];
  }

  // ---------- names for the frame ----------
  // An order-2 letter model of the 72 spirit names on the sheet (first spelling
  // of each); a name is kept only if it is 5 to 9 letters long, at least two
  // edits away from every spelling on the sheet and contains none of them (of
  // four letters or more), so it is none of theirs and not two of them glued.

  let NAME_MODEL = null;
  function nameModel() {
    if (NAME_MODEL) return NAME_MODEL;
    const next = {};
    for (const n of D.names.train) {
      const s = '^^' + n + '$';
      for (let i = 2; i < s.length; i++) {
        const k = s.slice(i - 2, i);
        (next[k] = next[k] || {})[s[i]] = (next[k][s[i]] || 0) + 1;
      }
    }
    NAME_MODEL = next;
    return next;
  }

  function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      prev = cur;
    }
    return prev[b.length];
  }

  function nameForSeed(seed) {
    const rng = makeRng((seed ^ 0x4E414D45) >>> 0), model = nameModel();
    for (let tries = 0; tries < 500; tries++) {
      let s = '^^';
      while (s.length < 14) {
        const opts = Object.entries(model[s.slice(-2)]);
        let x = rng.random() * opts.reduce((a, [, c]) => a + c, 0), ch = opts[opts.length - 1][0];
        for (const [c, n] of opts) { x -= n; if (x <= 0) { ch = c; break; } }
        if (ch === '$') break;
        s += ch;
      }
      const name = s.slice(2);
      if (name.length >= 5 && name.length <= 9 && D.names.avoid.every(r => editDistance(name, r) >= 2 && !(r.length >= 4 && name.includes(r)))) return name;
    }
    return 'NOMEN';
  }

  // one novel seal for a seed, its family drawn in the sheet's proportions
  function sealForSeed(seed, opts = {}) {
    // the family from the golden-ratio sequence of the seed: a random seed gives a
    // uniform draw, consecutive seeds (a batch) follow the sheet's mix closely
    const rng = makeRng((seed ^ 0x51A15EA1) >>> 0);
    let x = ((seed * 0.6180339887498949) % 1) * 72, family = FAMILY_COUNTS[0][0];
    for (const [f, k] of FAMILY_COUNTS) { x -= k; if (x < 0) { family = f; break; } }
    return generateNovelSeal(Math.floor(rng.random() * 4294967296), family, String(seed), opts);
  }

  // the families and per-seal seeds of a set, in the sheet's proportions for n = 72
  function planSet(seed, n = 72) {
    const rng = makeRng(seed);
    let fams = [];
    for (const [f, k] of FAMILY_COUNTS) for (let i = 0; i < k; i++) fams.push(f);
    if (n !== 72) fams = Array.from({ length: n }, () => rng.choice(fams));
    rng.shuffle(fams);
    return fams.map((family, i) => ({ id: 'g' + String(i + 1).padStart(2, '0'), family, seed: Math.floor(rng.random() * 4294967296) }));
  }

  function generateSet(seed, n = 72) {
    return planSet(seed, n).map(s => generateNovelSeal(s.seed, s.family, s.id));
  }

  // ---------- SVG (tools/sigil.py to_svg, ink in currentColor) ----------

  function toSvg(enc, opts = {}) {
    const s = opts.scale || 100, k = opts.strokeK === undefined ? STROKE_K : opts.strokeK;
    const sw = enc.stroke * k * s, W = enc.aspect * s, H = s;
    const f = v => (v * s).toFixed(2);
    const d = (pts, close) => 'M ' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ') + (close ? ' Z' : '');
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(-sw).toFixed(1)} ${(-sw).toFixed(1)} ${(W + 2 * sw).toFixed(1)} ${(H + 2 * sw).toFixed(1)}"` +
                   (opts.size ? ` width="${(W + 2 * sw).toFixed(0)}" height="${(H + 2 * sw).toFixed(0)}"` : '') + '>',
                   `<g fill="none" stroke="currentColor" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">`];
    for (const m of expand(enc.members)) {
      const wa = m.w !== undefined ? ` stroke-width="${(m.w * k * s).toFixed(2)}"` : '';
      const t = m.t;
      if (t === 'line') parts.push(`<line x1="${f(m.p[0])}" y1="${f(m.p[1])}" x2="${f(m.p[2])}" y2="${f(m.p[3])}"${wa}/>`);
      else if (t === 'pline') parts.push(`<path d="${d(m.p, m.closed || m.fill)}"${wa}${m.fill ? ' fill="currentColor"' : ''}/>`);
      else if (t === 'tri') parts.push(`<path d="${d(m.p, true)}"${m.fill === false ? '' : ' fill="currentColor"'}/>`);
      else if (t === 'bez' || t === 'path') {
        let dd = `M ${f(m.p[0][0])} ${f(m.p[0][1])}`;
        for (let i = 1; i < m.p.length; i += 3) dd += ' C ' + m.p.slice(i, i + 3).map(([x, y]) => `${f(x)} ${f(y)}`).join(' ');
        parts.push(`<path d="${dd}"${wa}/>`);
      } else if (t === 'arc') parts.push(`<path d="${d(arcPoints(m.c, m.r, m.a[0], m.a[1]))}"${wa}/>`);
      else if (t === 'ring') parts.push(`<circle cx="${f(m.c[0])}" cy="${f(m.c[1])}" r="${f(m.r)}"${wa}/>`);
      else if (t === 'dot') parts.push(`<circle cx="${f(m.c[0])}" cy="${f(m.c[1])}" r="${f(m.r)}" fill="currentColor" stroke="none"/>`);
      else if (t === 'cross') {
        const rot = m.rot || 0;
        if (m.flared !== false) for (const poly of crossPolys(m.c, m.s, rot)) parts.push(`<path d="${d(poly, true)}" fill="currentColor"/>`);
        for (let j = 0; j < 2; j++) {
          const u = unit(rot + 90 * j);
          parts.push(`<line x1="${f(m.c[0] - u[0] * m.s)}" y1="${f(m.c[1] - u[1] * m.s)}" x2="${f(m.c[0] + u[0] * m.s)}" y2="${f(m.c[1] + u[1] * m.s)}"/>`);
        }
      } else if (t === 'spiral') parts.push(`<path d="${d(spiralPoints(m.c, m.r[0], m.r[1], m.a[0], m.a[1]))}"${wa}/>`);
      else if (t === 'crescent') parts.push(`<path d="${d(crescentPoly(m.c, m.r, m.k === undefined ? 0.35 : m.k, m.rot || 0, m.ri), true)}" fill="currentColor" stroke="none"/>`);
    }
    parts.push('</g></svg>');
    return parts.join('\n');
  }

  const api = { generateSeal, generateNovelSeal, sealForSeed, nameForSeed, novelty, planSet, generateSet, toSvg, expand, translate, outlines, rasterize, distanceTransform, makeRng,
                FAMILIES: FAMILY_COUNTS.map(([f]) => f), STROKE_K };
  root.Sigils = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
