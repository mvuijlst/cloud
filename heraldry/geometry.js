/* Geometry for the arms generator: paths, affine maps, shields, partition lines,
   field divisions and ordinaries. Everything is in shield units: the shield is
   100 wide and 120 high, origin at the top left (dexter chief), y down.

   Paths are arrays of segments ['M',x,y] ['L',x,y] ['C',x1,y1,x2,y2,x,y] ['Z'],
   so they can be mapped by an affine transform point by point; hatching then
   stays in the shield's frame whatever the charge's scale or rotation
   (Fox-Davies 1909, p. 76: hatchings follow the shield, not the charge).

   Works in the browser and under Node (no dependencies). */
(function (root) {
  'use strict';
  const H = root.Heraldry = root.Heraldry || {};
  const SW = 100, SH = 120;

  // ---------- paths ----------
  const P = {};
  P.poly = (pts, closed = true) => {
    const p = pts.map((q, i) => [i ? 'L' : 'M', q[0], q[1]]);
    if (closed) p.push(['Z']);
    return p;
  };
  // circle and ellipse as four cubic arcs
  P.ellipse = (cx, cy, rx, ry, rot = 0) => {
    const k = 0.5522847498;
    const c = Math.cos(rot), s = Math.sin(rot);
    const T = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
    const pts = [[rx, 0], [rx, ry * k], [rx * k, ry], [0, ry], [-rx * k, ry], [-rx, ry * k], [-rx, 0], [-rx, -ry * k], [-rx * k, -ry], [0, -ry], [rx * k, -ry], [rx, -ry * k], [rx, 0]];
    const q = pts.map(p => T(p[0], p[1]));
    const out = [['M', ...q[0]]];
    for (let i = 1; i < q.length; i += 3) out.push(['C', ...q[i], ...q[i + 1], ...q[i + 2]]);
    out.push(['Z']);
    return out;
  };
  P.circle = (cx, cy, r) => P.ellipse(cx, cy, r, r);
  P.concat = (...ps) => [].concat(...ps);
  // affine m = [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f
  P.map = (path, m) => path.map(sg => {
    if (sg[0] === 'Z') return sg;
    const o = [sg[0]];
    for (let i = 1; i < sg.length; i += 2) o.push(m[0] * sg[i] + m[2] * sg[i + 1] + m[4], m[1] * sg[i] + m[3] * sg[i + 1] + m[5]);
    return o;
  });
  P.mapPt = (q, m) => [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]];
  P.mat = {
    id: () => [1, 0, 0, 1, 0, 0],
    mul: (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
    tr: (x, y) => [1, 0, 0, 1, x, y],
    sc: (sx, sy = sx) => [sx, 0, 0, sy, 0, 0],
    rot: a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0],
    flipX: () => [-1, 0, 0, 1, 0, 0],
  };
  P.toD = (path, prec = 2) => {
    const f = v => (Math.round(v * 10 ** prec) / 10 ** prec).toString();
    return path.map(sg => sg[0] === 'Z' ? 'Z' : sg[0] + sg.slice(1).map(f).join(' ')).join('');
  };
  // flatten to polygons (one per subpath), for tests and bounds
  P.flatten = (path, n = 8) => {
    const polys = []; let cur = null, last = null, start = null;
    for (const sg of path) {
      if (sg[0] === 'M') { cur = [[sg[1], sg[2]]]; polys.push(cur); last = start = [sg[1], sg[2]]; }
      else if (sg[0] === 'L') { cur.push([sg[1], sg[2]]); last = [sg[1], sg[2]]; }
      else if (sg[0] === 'C') {
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          cur.push([u * u * u * last[0] + 3 * u * u * t * sg[1] + 3 * u * t * t * sg[3] + t * t * t * sg[5],
            u * u * u * last[1] + 3 * u * u * t * sg[2] + 3 * u * t * t * sg[4] + t * t * t * sg[6]]);
        }
        last = [sg[5], sg[6]];
      } else if (sg[0] === 'Z') { last = start; }
    }
    return polys;
  };
  P.bounds = path => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of P.flatten(path, 6)) for (const q of poly) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    }
    return [x0, y0, x1, y1];
  };
  // smooth closed (or open) curve through points, Catmull-Rom as cubic Beziers
  P.smooth = (pts, closed = true, tension = 1) => {
    const n = pts.length; const out = [['M', ...pts[0]]];
    const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const k = tension / 6;
      out.push(['C', p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]]);
    }
    if (closed) out.push(['Z']);
    return out;
  };
  // tapered capsule: the hull of two circles (limbs, feathers, tines)
  P.capsule = (a, ra, b, rb, n = 9) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / L, uy = dy / L;
    const s = Math.max(-0.999, Math.min(0.999, (ra - rb) / L));
    const ang = Math.acos(s);
    const base = Math.atan2(uy, ux);
    const pts = [];
    const arc = (c, r, t0, t1) => { for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); } };
    arc(b, rb, base - ang, base + ang);                  // round the far side of b
    arc(a, ra, base + ang, base - ang + 2 * Math.PI);    // round the far side of a
    return P.poly(pts);
  };
  // a stroke along a polyline with varying half-width (for tails, beams, tines): w(t), t in [0,1]
  P.ribbon = (pts, w, cap = true) => {
    const n = pts.length; if (n < 2) return [];
    const L = [0]; for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[n - 1] || 1; const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const hw = typeof w === 'function' ? w(L[i] / tot) : w;
      left.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]); right.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
    }
    return P.poly(left.concat(right.reverse()));
  };
  // sample a smooth open curve through control points into a dense polyline
  P.curvePts = (ctrl, per = 8) => {
    const out = []; const n = ctrl.length;
    const at = i => ctrl[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(ctrl[n - 1].slice());
    return out;
  };
  H.P = P;

  // ---------- point in polygon ----------
  function inPoly(q, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  H.inPoly = inPoly;

  // ---------- shields ----------
  // heater: the Commons template (sides straight to 40%, a pointed base);
  // french: Rolland's plates (straight sides, rounded corners, a small point);
  // round: the user's Italian page (straight sides to about half height, a round base).
  const SHIELDS = {
    heater: [['M', 0, 0], ['L', 100, 0], ['L', 100, 48], ['C', 100, 86, 78, 107, 50, 120], ['C', 22, 107, 0, 86, 0, 48], ['Z']],
    french: [['M', 0, 0], ['L', 100, 0], ['L', 100, 90], ['C', 100, 105, 84, 109, 66, 109], ['C', 57, 109, 52, 113, 50, 120], ['C', 48, 113, 43, 109, 34, 109], ['C', 16, 109, 0, 105, 0, 90], ['Z']],
    round: [['M', 0, 0], ['L', 100, 0], ['L', 100, 62], ['C', 100, 95, 78, 120, 50, 120], ['C', 22, 120, 0, 95, 0, 62], ['Z']],
    rect: [['M', 0, 0], ['L', 100, 0], ['L', 100, 120], ['L', 0, 120], ['Z']],   // a quarter
  };
  const shieldCache = {};
  function shield(kind) {
    if (shieldCache[kind]) return shieldCache[kind];
    const path = SHIELDS[kind];
    const poly = P.flatten(path, 24)[0];
    // area centroid: the fess point is the centre of the field as drawn
    let A = 0, cx = 0, cy = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const cr = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
      A += cr; cx += (poly[j][0] + poly[i][0]) * cr; cy += (poly[j][1] + poly[i][1]) * cr;
    }
    A /= 2; cx /= 6 * A; cy /= 6 * A;
    // half width of the shield at height y
    const halfAt = y => {
      let xs = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      if (xs.length < 2) return 0;
      return (Math.max(...xs) - Math.min(...xs)) / 2;
    };
    return (shieldCache[kind] = { kind, path, poly, fess: [50, cy], area: Math.abs(A), halfAt, H: kind.startsWith('rect:') ? +kind.slice(5) : SH });
  }
  H.shield = shield;
  // a quarter: a rectangle 100 wide and h high, so a sub-coat fills its quarter exactly
  H.rectShield = h => {
    const k = 'rect:' + (Math.round(h * 100) / 100);
    if (!SHIELDS[k]) SHIELDS[k] = [['M', 0, 0], ['L', 100, 0], ['L', 100, +k.slice(5)], ['L', 0, +k.slice(5)], ['Z']];
    return shield(k);
  };
  H.SW = SW; H.SH = SH;

  // inward offset of a polygon (smooth convex shields), for the bordure's inner edge
  function inset(poly, d) {
    const n = poly.length; const out = [];
    let area = 0; for (let i = 0, j = n - 1; i < n; j = i++) area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
      const n1 = norm([-(b[1] - a[1]) * sgn, (b[0] - a[0]) * sgn]), n2 = norm([-(c[1] - b[1]) * sgn, (c[0] - b[0]) * sgn]);
      let m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
      const cosh = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
      out.push([b[0] + m[0] * d / cosh, b[1] + m[1] * d / cosh]);
    }
    return out;
  }
  function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
  H.inset = inset;

  // ---------- partition lines ----------
  // A line from p to q drawn plain or with a pattern on its normal side.
  // side = +1 puts the teeth toward the left of the direction of travel.
  const LINE = {
    plain: { period: 1, amp: 0 },
    indented: { period: 7, amp: 2.6 },
    dancetty: { period: 34, amp: 7 },
    wavy: { period: 22, amp: 3.2 },
    embattled: { period: 16, amp: 4.2 },
    engrailed: { period: 12, amp: 3.2 },
    invected: { period: 12, amp: 3.2 },
    nebuly: { period: 16, amp: 4 },
  };
  H.LINE = LINE;
  function linePts(p, q, type = 'plain', side = 1, phase = 0) {
    if (!type || type === 'plain') return [p.slice(), q.slice()];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
    const nx = -uy * side, ny = ux * side;
    const { period, amp } = LINE[type];
    const at = (s, h) => [p[0] + ux * s + nx * h, p[1] + uy * s + ny * h];
    const out = [];
    const s0 = -((phase % period) + period) % period;
    if (type === 'indented' || type === 'dancetty') {
      for (let s = s0; s <= L + period; s += period / 2) {
        const k = Math.round((s - s0) / (period / 2));
        out.push(at(s, k % 2 ? amp : -amp));
      }
    } else if (type === 'wavy') {
      for (let s = s0; s <= L + period; s += period / 16) out.push(at(s, amp * Math.sin(2 * Math.PI * (s - s0) / period)));
    } else if (type === 'embattled') {
      for (let s = s0; s <= L + period; s += period / 2) {
        const k = Math.round((s - s0) / (period / 2)); const h = k % 2 ? amp : -amp;
        out.push(at(s, h)); out.push(at(s + period / 2, h));
      }
    } else if (type === 'engrailed' || type === 'invected') {
      const dir = type === 'engrailed' ? -1 : 1;
      for (let s = s0; s <= L + period; s += period) {
        for (let k = 0; k <= 8; k++) {
          const t = k / 8; const a = Math.PI * t;
          out.push(at(s + period * t, dir * amp * Math.sin(a) - dir * amp * 0.5));
        }
      }
    } else if (type === 'nebuly') {
      // alternate bulbous lobes on narrow necks, the necks of neighbouring lobes sharing a wall
      const n = period / 4, R = n * 1.3, beta = Math.acos(n / R), hc = R * Math.sin(beta) + n * 0.45;
      for (let s = s0, k = 0; s <= L + period; s += period / 2, k++) {
        const sg = k % 2 ? -1 : 1, cx = s + n;
        out.push(at(s, 0));
        for (let i = 0; i <= 18; i++) {
          const th = Math.PI + beta - (Math.PI + 2 * beta) * i / 18;
          out.push(at(cx + R * Math.cos(th), sg * (hc + R * Math.sin(th))));
        }
      }
    }
    // trim to the segment's extent (keep a little beyond; the shield clip hides the rest)
    return out.filter(r => { const s = (r[0] - p[0]) * ux + (r[1] - p[1]) * uy; return s >= -period && s <= L + period; });
  }
  H.linePts = linePts;
  // the two edges of a band of width w centred on the segment p-q, in drawing order for a closed polygon
  function bandEdges(p, q, w, lt) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L; const nx = -uy, ny = ux;
    const off = (r, d) => [r[0] + nx * d, r[1] + ny * d];
    const parallel = lt === 'wavy' || lt === 'dancetty' || lt === 'nebuly';
    const a = linePts(off(p, w / 2), off(q, w / 2), lt, 1);
    const b = parallel ? a.map(r => off(r, -w)) : linePts(off(p, -w / 2), off(q, -w / 2), lt, -1);
    return { a, b, poly: a.concat(b.slice().reverse()) };
  }
  H.bandEdges = bandEdges;

  // ---------- divisions of the field ----------
  // Each division returns regions [{poly, t: index of tincture (0 or 1)}] over a margin box, and the
  // dividing lines [{pts}] to be inked. Region 0 is painted as the background.
  const M = 8; // margin beyond the shield
  const box = [[-M, -M], [SW + M, -M], [SW + M, SH + M], [-M, SH + M]];
  function division(kind, sh, opt = {}) {
    const SH = sh.H || 120;
    const box = [[-M, -M], [SW + M, -M], [SW + M, SH + M], [-M, SH + M]];
    const lt = opt.line || 'plain';
    const [fx, fy] = sh.fess;
    const out = { regions: [], lines: [] };
    const add = (poly, t) => out.regions.push({ poly, t });
    const ink = pts => out.lines.push(pts);
    if (kind === 'per pale') {
      const l = linePts([fx, -M], [fx, SH + M], lt, 1);
      add([[-M, -M]].concat(l, [[-M, SH + M]]), 0); add(l.concat([[SW + M, SH + M], [SW + M, -M]]).reverse(), 1); ink(l);
      out.regions[0].poly = box; // background
    } else if (kind === 'per fess') {
      const l = linePts([-M, fy], [SW + M, fy], lt, -1);
      add(box, 0); add(l.concat([[SW + M, SH + M], [-M, SH + M]]), 1); ink(l);
    } else if (kind === 'per bend' || kind === 'per bend sinister') {
      const sin = kind === 'per bend sinister';
      const p = sin ? [SW + M, -M + (fy - 50) * 0] : [-M, -M], q = sin ? [-M, SW + 2 * M] : [SW + M, SW + 2 * M];
      const l = linePts(p, q, lt, sin ? 1 : -1);
      add(box, 0); add(l.concat(sin ? [[-M, SH + M]] : [[SW + M, SH + M]], sin ? [] : []).concat(sin ? [] : []), 1);
      // the lower region is the one below the line: close along the bottom
      out.regions[1].poly = sin ? l.concat([[-M, SH + 3 * M], [SW + M, SH + 3 * M]]) : l.concat([[SW + M, SH + 3 * M], [-M, SH + 3 * M]]);
      ink(l);
    } else if (kind === 'per chevron') {
      const apex = [fx, fy - 12];
      const a = linePts([-M, apex[1] + (fx + M) * 1.05], apex, lt, 1), b = linePts(apex, [SW + M, apex[1] + (fx + M) * 1.05], lt, 1);
      add(box, 0); add(a.concat(b, [[SW + M, SH + 3 * M], [-M, SH + 3 * M]]), 1); ink(a.concat(b));
    } else if (kind === 'quarterly') {
      add(box, 0);
      add([[fx, -M], [SW + M, -M], [SW + M, fy], [fx, fy]], 1);
      add([[-M, fy], [fx, fy], [fx, SH + M], [-M, SH + M]], 1);
      ink([[fx, -M], [fx, SH + M]]); ink([[-M, fy], [SW + M, fy]]);
    } else if (kind === 'per saltire') {
      add(box, 0);
      const c = [fx, fy];
      add([[-M, -M * 0 - fy - M], c, [-M, fy + fx + M]], 1); // dexter flank
      add([[SW + M, fy - (SW - fx) - M], c, [SW + M, fy + (SW - fx) + M]], 1); // sinister flank
      ink([[-M, fy - fx - M], [SW + M, fy + (SW - fx) + M]]); ink([[SW + M, fy - (SW - fx) - M], [-M, fy + fx + M]]);
    } else if (kind === 'gyronny') {
      add(box, 0);
      const c = [fx, fy]; const R = 200;
      for (let k = 0; k < 8; k += 2) {
        const a0 = -Math.PI / 2 + k * Math.PI / 4, a1 = a0 + Math.PI / 4;
        add([c, [c[0] + R * Math.cos(a0), c[1] + R * Math.sin(a0)], [c[0] + R * Math.cos(a1), c[1] + R * Math.sin(a1)]], 1);
      }
      for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + k * Math.PI / 4; ink([[c[0] - R * Math.cos(a), c[1] - R * Math.sin(a)], [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]]); }
    } else if (kind === 'barry' || kind === 'paly') {
      // n bands; each odd band is bounded by its two partition lines, drawn with the same phase so the
      // band keeps its width (wavy, nebuly, indented and dancetty lines run in parallel)
      const n = opt.n || 6; add(box, 0);
      const across = kind === 'barry' ? SH : SW, w = across / n;
      const edge = (c) => kind === 'barry' ? linePts([-M, c], [SW + M, c], lt, 1, 0) : linePts([c, -M], [c, SH + M], lt, -1, 0);
      const lines = []; for (let i = 1; i < n; i++) lines.push(edge(i * w));
      for (let i = 1; i < n; i += 2) {
        const top = lines[i - 1], bot = i < n - 1 ? lines[i] : null;
        const far = kind === 'barry' ? [[SW + M, SH + M + 20], [-M, SH + M + 20]] : [[SW + M + 20, SH + M], [SW + M + 20, -M]];
        add(top.concat(bot ? bot.slice().reverse() : far), 1);
      }
      for (const l of lines) ink(l);
    } else if (kind === 'bendy' || kind === 'bendy sinister') {
      // bands between the lines x - y = c, spread evenly over the shield's own extent of x - y
      const n = opt.n || 6; add(box, 0);
      const sin = kind === 'bendy sinister';
      const cs = sh.poly.map(q => (sin ? SW - q[0] : q[0]) - q[1]);
      const c0 = Math.min(...cs), c1 = Math.max(...cs), step = (c1 - c0) / n;
      const fl = q => sin ? [SW - q[0], q[1]] : q;
      const lineAt = c => linePts([c - M, -M], [c + SH + M, SH + M], lt, -1, 0).map(fl);
      const lines = []; for (let i = 1; i < n; i++) lines.push(lineAt(c0 + i * step));
      for (let i = 1; i < n; i += 2) {
        const a = lines[i - 1], bb = i < n - 1 ? lines[i] : [[c1 + SH + 3 * M, SH + M], [c1 - 3 * M, -M]].map(fl);
        add(a.concat(i < n - 1 ? bb.slice().reverse() : bb), 1);
      }
      for (const l of lines) ink(l);
    } else if (kind === 'tierced per fess') {
      const h = SH / 3; add(box, 0);
      const l1 = linePts([-M, h], [SW + M, h], lt, 1, 0), l2 = linePts([-M, 2 * h], [SW + M, 2 * h], lt, 1, 0);
      add(l1.concat(l2.slice().reverse()), 1); add(l2.concat([[SW + M, SH + M + 20], [-M, SH + M + 20]]), 2);
      ink(l1); ink(l2);
    } else if (kind === 'tierced per pale') {
      const w = SW / 3; add(box, 0);
      add([[w, -M], [2 * w, -M], [2 * w, SH + M], [w, SH + M]], 1); add([[2 * w, -M], [SW + M, -M], [SW + M, SH + M], [2 * w, SH + M]], 2);
      ink([[w, -M], [w, SH + M]]); ink([[2 * w, -M], [2 * w, SH + M]]);
    } else if (kind === 'chevronny') {
      const n = opt.n || 6; const step = (SH + 40) / n; add(box, 0);
      for (let i = 0; i < n + 2; i += 2) {
        const y0 = -30 + i * step, y1 = y0 + step; const yAt = (x, y) => y + Math.abs(x - fx);
        add([[-M, yAt(-M, y0)], [fx, y0], [SW + M, yAt(SW + M, y0)], [SW + M, yAt(SW + M, y1)], [fx, y1], [-M, yAt(-M, y1)]], 1);
      }
      for (let i = 0; i < n + 2; i++) { const y = -30 + i * step; ink([[-M, y + fx + M], [fx, y], [SW + M, y + SW + M - fx]]); }
    } else if (kind === 'chequy') {
      const n = opt.n || 6; const s = SW / n; add(box, 0);
      for (let i = 0; i < n; i++) for (let j = 0; j < Math.ceil(SH / s) + 1; j++) if ((i + j) % 2) add([[i * s, j * s], [(i + 1) * s, j * s], [(i + 1) * s, (j + 1) * s], [i * s, (j + 1) * s]], 1);
      for (let i = 1; i < n; i++) ink([[i * s, -M], [i * s, SH + M]]);
      for (let j = 1; j * s < SH; j++) ink([[-M, j * s], [SW + M, j * s]]);
    } else if (kind === 'lozengy') {
      const n = opt.n || 5; const w = SW / n, h = w * 1.35; add(box, 0);
      for (let i = -1; i <= n + 1; i++) for (let j = -1; j * h / 2 < SH + h; j++) {
        if (j % 2) continue;
        const cx = i * w + (j / 2 % 2 ? w / 2 : 0) * 0 + w / 2, cy = j * h / 2;
        add([[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]], 1);
      }
      for (let k = -n * 3; k <= n * 3; k++) { ink([[k * w, 0], [k * w + 2 * SH * w / h, 2 * SH]]); ink([[k * w, 0], [k * w - 2 * SH * w / h, 2 * SH]]); }
    } else {
      add(box, 0);
    }
    return out;
  }
  H.division = division;

  // ---------- ordinaries ----------
  // Each returns {poly (or path), axis: points for charges laid on it, n: normal for counting}.
  function ordinary(kind, sh, opt = {}) {
    const SH = sh.H || 120;
    const lt = opt.line || 'plain';
    const [fx, fy] = sh.fess;
    const o = { kind };
    if (kind === 'fess') {
      const h = 28; const e = bandEdges([-M, fy], [SW + M, fy], h, lt);
      o.poly = e.poly; o.lines = [e.a, e.b];
      o.slots = (n) => row(n, 0, SW, fy, h * 0.78, sh);
      o.zone = [0, fy - h / 2, SW, fy + h / 2];
    } else if (kind === 'bars') {
      const n = opt.n || 2; const h = 13; const ys = n === 2 ? [fy - 15, fy + 15] : [fy - 26, fy, fy + 26];
      o.polys = ys.map(y => [[-M, y - h / 2], [SW + M, y - h / 2], [SW + M, y + h / 2], [-M, y + h / 2]]);
      o.lines = ys.flatMap(y => [[[-M, y - h / 2], [SW + M, y - h / 2]], [[-M, y + h / 2], [SW + M, y + h / 2]]]);
      o.zone = [0, ys[0] - h / 2, SW, ys[ys.length - 1] + h / 2];
    } else if (kind === 'pale') {
      const w = 28; const e = bandEdges([fx, -M], [fx, SH + M], w, lt);
      o.poly = e.poly; o.lines = [e.a, e.b];
      o.slots = (n) => col(n, fx, 6, sh.halfAt ? SH - 14 : SH, w * 0.78, sh);
      o.zone = [fx - w / 2, 0, fx + w / 2, SH];
    } else if (kind === 'bend' || kind === 'bend sinister') {
      const w = 24; const sin = kind === 'bend sinister';
      // centre line through the fess point at 45 degrees
      const d = Math.SQRT1_2; const L = 120;
      const p = [fx - L * d, fy - L * d], q = [fx + L * d, fy + L * d];
      const nrm = [-d, d];
      void nrm;
      const e = bandEdges(p, q, w, lt);
      const fl = r => sin ? [SW - r[0], r[1]] : r;
      o.poly = e.poly.map(fl); o.lines = [e.a.map(fl), e.b.map(fl)];
      o.angle = sin ? -Math.PI / 4 : Math.PI / 4;
      o.slots = (n) => {
        // spread the charges over the stretch of the bend that lies inside the shield, a charge's width from its ends
        let size = w * 0.74;
        // the charge's square, turned with the bend, must lie wholly inside the shield
        const okAt = tt => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1]].every(([a, b]) => {
          const along = tt + a * size * 0.55, across = b * size * 0.55;
          return inPoly(fl([fx + along * d - across * d, fy + along * d + across * d]), sh.poly);
        });
        let t0 = 0, t1 = 0;
        while (t0 > -140 && okAt(t0 - 1)) t0 -= 1;
        while (t1 < 140 && okAt(t1 + 1)) t1 += 1;
        const room = t1 - t0; if (n > 1) size = Math.min(size, room / (n - 1) * 0.86);
        const out = [];
        for (let i = 0; i < n; i++) { const tt = n === 1 ? (t0 + t1) / 2 : t0 + room * i / (n - 1); out.push({ c: fl([fx + tt * d, fy + tt * d]), s: size, rot: o.angle }); }
        return out;
      };
      o.sin = sin;
    } else if (kind === 'chevron') {
      const w = 22; const apexY = fy - 16; const slope = 1.0; // rise per run
      const ax = fx; const xL = -M, xR = SW + M;
      const yAt = x => apexY + Math.abs(x - ax) * slope;
      const upper = [[xL, yAt(xL)], [ax, apexY], [xR, yAt(xR)]];
      const lower = [[xR, yAt(xR) + w * 1.41], [ax, apexY + w * 1.41], [xL, yAt(xL) + w * 1.41]];
      o.poly = upper.concat(lower); o.lines = [upper, lower];
      o.slots = (n) => {
        const out = []; const size = w * 0.78; const off = w * 0.71;
        if (n === 1) return [{ c: [ax, apexY + off], s: size }];
        for (let i = 0; i < n; i++) {
          const t = (i / (n - 1)) * 2 - 1; const x = ax + t * 34; out.push({ c: [x, yAt(x) + off], s: size, rot: Math.sign(t) * Math.PI / 4 * 0 });
        }
        return out;
      };
      o.apex = [ax, apexY];
    } else if (kind === 'chief') {
      const h = 34; const l = linePts([SW + M, h], [-M, h], lt, 1);
      o.poly = [[-M, -M], [SW + M, -M]].concat(l); o.lines = [l];
      o.slots = (n) => row(n, 4, SW - 4, h / 2, h * 0.7, sh);
      o.zone = [0, 0, SW, h]; o.h = h;
    } else if (kind === 'cross') {
      const w = 24, cy = fy - 6;
      o.polys = [[[fx - w / 2, -M], [fx + w / 2, -M], [fx + w / 2, SH + M], [fx - w / 2, SH + M]], [[-M, cy - w / 2], [SW + M, cy - w / 2], [SW + M, cy + w / 2], [-M, cy + w / 2]]];
      o.lines = [[[fx - w / 2, -M], [fx - w / 2, cy - w / 2], [-M, cy - w / 2]], [[fx + w / 2, -M], [fx + w / 2, cy - w / 2], [SW + M, cy - w / 2]],
        [[-M, cy + w / 2], [fx - w / 2, cy + w / 2], [fx - w / 2, SH + M]], [[SW + M, cy + w / 2], [fx + w / 2, cy + w / 2], [fx + w / 2, SH + M]]];
      o.slots = (n) => [{ c: [fx, cy], s: w * 0.78 }, { c: [fx, cy - 30], s: w * 0.7 }, { c: [fx - 32, cy], s: w * 0.7 }, { c: [fx + 32, cy], s: w * 0.7 }, { c: [fx, cy + 34], s: w * 0.7 }].slice(0, n);
      o.centre = [fx, cy]; o.w = w;
    } else if (kind === 'saltire') {
      const w = 20; const c = [fx, fy]; const d = Math.SQRT1_2; const L = 140;
      const band = (s) => { const u = [d * s, d], nn = [-d, d * s]; return [[c[0] - u[0] * L + nn[0] * w / 2, c[1] - u[1] * L + nn[1] * w / 2], [c[0] + u[0] * L + nn[0] * w / 2, c[1] + u[1] * L + nn[1] * w / 2], [c[0] + u[0] * L - nn[0] * w / 2, c[1] + u[1] * L - nn[1] * w / 2], [c[0] - u[0] * L - nn[0] * w / 2, c[1] - u[1] * L - nn[1] * w / 2]]; };
      o.polys = [band(1), band(-1)];
      o.lines = o.polys.map(p => p.concat([p[0]]));
      o.slots = (n) => [{ c, s: w * 0.75 }, { c: [c[0] - 22, c[1] - 22], s: w * 0.62 }, { c: [c[0] + 22, c[1] - 22], s: w * 0.62 }, { c: [c[0] - 22, c[1] + 22], s: w * 0.62 }, { c: [c[0] + 22, c[1] + 22], s: w * 0.62 }].slice(0, n);
      o.centre = c;
    } else if (kind === 'pile') {
      o.poly = [[fx - 26, -M], [fx + 26, -M], [fx, SH * 0.82]]; o.lines = [[[fx - 26, -M], [fx, SH * 0.82], [fx + 26, -M]]];
      o.slots = (n) => [{ c: [fx, 26], s: 20 }, { c: [fx, 52], s: 14 }, { c: [fx, 70], s: 10 }].slice(0, n);
    } else if (kind === 'canton') {
      // with a chief, the canton stands below it (opt.top): it is drawn first and the chief covers its top
      const s = 36, y0 = opt.top || 0; o.poly = [[-M, -M], [s, -M], [s, y0 + s], [-M, y0 + s]]; o.lines = [[[s, -M], [s, y0 + s], [-M, y0 + s]]];
      o.slots = () => [{ c: [s / 2, y0 + s / 2], s: s * 0.7 }];
      o.zone = [0, y0, s, y0 + s];
    } else if (kind === 'bordure') {
      // the inner edge: the shield's own outline shrunk about its top centre, a little more at the base
      // than at the flanks so the bordure keeps its width round the point (an offset curve would loop there)
      const w = 11;
      const inner = P.flatten(P.map(sh.path, [(SW - 2 * w) / SW, 0, 0, (SH - 2.35 * w) / SH, w, w]), 24)[0];
      o.path = P.concat(P.poly(sh.poly.map(q => q.slice())), P.poly(inner.slice().reverse()));
      o.lines = [inner.concat([inner[0]])];
      o.inner = inner;
      o.slots = (n) => {
        // charges round the bordure: evenly spaced along its middle line
        const mid = P.flatten(P.map(sh.path, [(SW - w) / SW, 0, 0, (SH - 1.18 * w) / SH, w / 2, w / 2]), 24)[0]; const L = [0];
        for (let i = 1; i < mid.length; i++) L.push(L[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
        const tot = L[L.length - 1]; const out = [];
        for (let k = 0; k < n; k++) { const s = (k + 0.5) / n * tot; let i = 1; while (i < L.length - 1 && L[i] < s) i++; out.push({ c: mid[i], s: w * 0.75 }); }
        return out;
      };
    } else if (kind === 'pales') {
      const n = opt.n || 3, w = 11; const step = SW / (n + 1) * (n === 2 ? 1 : 1);
      const xs = Array.from({ length: n }, (_, i) => (i + 1) * SW / (n + 1));
      o.polys = xs.map(x => [[x - w / 2, -M], [x + w / 2, -M], [x + w / 2, SH + M], [x - w / 2, SH + M]]);
      o.lines = xs.flatMap(x => [[[x - w / 2, -M], [x - w / 2, SH + M]], [[x + w / 2, -M], [x + w / 2, SH + M]]]);
      void step;
    } else if (kind === 'bends' || kind === 'bends sinister') {
      const n = opt.n || 2, w = 10, gap = 21; const sin = kind === 'bends sinister'; const d = Math.SQRT1_2; const L = 150;
      const fl = r => sin ? [SW - r[0], r[1]] : r;
      o.polys = []; o.lines = [];
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * gap; const c = [fx + -d * off, fy + d * off];
        const a = [c[0] - L * d, c[1] - L * d], b = [c[0] + L * d, c[1] + L * d], nn = [-d, d];
        const poly = [[a[0] + nn[0] * w / 2, a[1] + nn[1] * w / 2], [b[0] + nn[0] * w / 2, b[1] + nn[1] * w / 2], [b[0] - nn[0] * w / 2, b[1] - nn[1] * w / 2], [a[0] - nn[0] * w / 2, a[1] - nn[1] * w / 2]].map(fl);
        o.polys.push(poly); o.lines.push([poly[0], poly[1]], [poly[2], poly[3]]);
      }
    } else if (kind === 'chevrons') {
      const n = opt.n || 2, w = 11, gap = 21;
      o.polys = []; o.lines = [];
      for (let i = 0; i < n; i++) {
        const apexY = fy - 26 + i * gap - (n - 2) * 8; const yAt = x => apexY + Math.abs(x - fx);
        const up = [[-M, yAt(-M)], [fx, apexY], [SW + M, yAt(SW + M)]], lo = [[SW + M, yAt(SW + M) + w * 1.41], [fx, apexY + w * 1.41], [-M, yAt(-M) + w * 1.41]];
        o.polys.push(up.concat(lo)); o.lines.push(up, lo);
      }
    } else if (kind === 'canton sinister') {
      const s = 36; o.poly = [[SW + M, -M], [SW - s, -M], [SW - s, s], [SW + M, s]]; o.lines = [[[SW - s, -M], [SW - s, s], [SW + M, s]]];
      o.slots = () => [{ c: [SW - s / 2, s / 2], s: s * 0.7 }];
      o.zone = [SW - s, 0, SW, s];
    } else if (kind === 'label') {
      const y = 10, h = 5.5, x0 = 18, x1 = 82;
      const parts = [[[x0, y], [x1, y], [x1, y + h], [x0, y + h]]];
      for (const x of [31, 50, 69]) parts.push([[x - 4, y + h], [x + 4, y + h], [x + 6, y + h + 14], [x - 6, y + h + 14]]);
      o.polys = parts; o.lines = parts.map(p => p.concat([p[0]]));
    }
    return o;
  }
  H.ordinary = ordinary;
  // squares along an ordinary's axis (compony: one row; checky: two or three rows), for patterned ordinaries
  function ordinaryChecks(kind, sh, rows = 2) {
    const SH = sh.H || 120; void SH;
    const [fx, fy] = sh.fess; const out = [];
    // keep the part of a polygon on one side of the pale line x = 50 (side -1 dexter, +1 sinister)
    const half = (poly, side) => {
      const inside = q => side * (q[0] - 50) >= 0, res = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        if (inside(a)) res.push(a);
        if (inside(a) !== inside(b)) { const f = (50 - a[0]) / (b[0] - a[0]); res.push([50, a[1] + f * (b[1] - a[1])]); }
      }
      return res.length >= 3 ? res : null;
    };
    // squares of side w/rows along a band of width w through c in direction ang, alternate ones kept;
    // with an arm (side), the squares start at -w/2 along it and stop at the pale line
    const grid = (c, ang, w, len, side) => {
      const s = w / rows; const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const i0 = side ? 0 : -Math.ceil(len / s), start = side ? -w / 2 : 0;
      for (let i = i0; i <= Math.ceil(len / s); i++) for (let j = 0; j < rows; j++) {
        if (((i + j) % 2 + 2) % 2 === 0) continue;
        const a0 = start + i * s, b0 = -w / 2 + j * s;
        let P4 = [[a0, b0], [a0 + s, b0], [a0 + s, b0 + s], [a0, b0 + s]].map(q => [c[0] + ux * q[0] + nx * q[1], c[1] + uy * q[0] + ny * q[1]]);
        if (side) P4 = half(P4, side);
        if (P4) out.push(P4);
      }
    };
    if (kind === 'fess') grid([fx, fy], 0, 28, 70);
    else if (kind === 'pale') grid([fx, 60], Math.PI / 2, 28, 80);
    else if (kind === 'bend') grid([fx, fy], Math.PI / 4, 24, 100);
    else if (kind === 'bend sinister') grid([SW - fx, fy], 3 * Math.PI / 4, 24, 100);
    else if (kind === 'chief') grid([50, 17], 0, 34, 70);
    else if (kind === 'cross') { grid([fx, 60], Math.PI / 2, 24, 80); grid([fx, fy - 6], 0, 24, 70); }
    else if (kind === 'chevron') {
      // the chevron's band is 22 wide across each arm; its centre line meets itself w/sqrt2 below the top.
      // Along each arm the pieces start half a width above that point, so the first piece of the two arms,
      // mitred on the pale line, is a whole chevron-shaped piece from the top to the inner corner
      const apex = [fx, fy - 16 + 22 * Math.SQRT1_2];
      grid(apex, 3 * Math.PI / 4, 22, 90, -1); grid(apex, Math.PI / 4, 22, 90, 1);
    }
    return out;
  }
  H.ordinaryChecks = ordinaryChecks;

  // charge slots in a horizontal row within [x0,x1] at y, fitted to the shield's width there
  function row(n, x0, x1, y, size, sh) {
    const half = Math.min((x1 - x0) / 2, sh.halfAt(y) - 2);
    const cx = (x0 + x1) / 2; const span = 2 * half; const step = span / n;
    const s = Math.min(size, step * 0.86);
    return Array.from({ length: n }, (_, i) => ({ c: [cx - half + step * (i + 0.5), y], s }));
  }
  function col(n, x, y0, y1, size, sh) {
    const step = (y1 - y0) / n; const s = Math.min(size, step * 0.86);
    return Array.from({ length: n }, (_, i) => ({ c: [x, y0 + step * (i + 0.5)], s }));
  }

  // ---------- arrangements of charges on the field ----------
  // Slots for n charges on the field, given what the field already holds (ordinary, chief).
  // Returns [{c:[x,y], s:size, rot}] ; size is the side of the square the charge is fitted into.
  // Charges set between an ordinary stand near the edges: each box is shrunk, and drawn a little toward the
  // fess point, until it lies inside the field, inside a bordure (11 wide) when there is one.
  function arrangement(n, sh, ctx = {}) {
    const out = arrangement0(n, sh, ctx);
    if (!ctx.ord || ctx.ord.kind === 'canton') return out;
    const SH = sh.H || 120, [fx, fy] = sh.fess, b = ctx.bordure;
    const halfIn = y => b ? 0.78 * sh.halfAt(Math.min(SH, Math.max(0, (y - 11) / 0.785))) - 1.5 : sh.halfAt(Math.min(SH, y)) - 2;
    const top = (ctx.chief ? 34 : 0) + (b ? 12.5 : 2);
    return out.map(sl => {
      let [x, y] = sl.c, s = sl.s;
      for (let k = 0; k < 24; k++) {
        if (y - s / 2 >= top && Math.abs(x - 50) + s / 2 <= halfIn(y + s / 2) && Math.abs(x - 50) + s / 2 <= halfIn(y - s / 2)) break;
        s *= 0.96; x += (fx - x) * 0.03; y += (fy - y) * 0.03;
      }
      return Object.assign({}, sl, { c: [x, y], s });
    });
  }
  function arrangement0(n, sh, ctx = {}) {
    const SH = sh.H || 120;
    const [fx, fy] = sh.fess;
    const top = ctx.chief ? 34 : 0; // a chief takes the top
    const ord = ctx.ord;
    const cy = ctx.chief ? (top + (fy + 30)) / 2 + 6 : fy;
    // pull a slot toward the pale line, shrinking it, until its box lies inside the shield
    const fitIn = (x, y, s) => {
      for (let k = 0; k < 16; k++) {
        const half = sh.halfAt(Math.min(SH - 2, y + s / 2));
        if (Math.abs(x - 50) + s / 2 <= half - 2 && y - s / 2 >= top + 2) break;
        s *= 0.93; x = 50 + (x - 50) * 0.97;
      }
      return { c: [x, y], s };
    };
    if (ord && ord.kind === 'fess') {
      const z = ord.zone; const up = (top + z[1]) / 2 + 1, dn = (z[3] + SH * 0.86) / 2;
      if (n === 1) return [{ c: [fx, up], s: 26 }];
      if (n === 2) return [{ c: [fx, up], s: 24 }, { c: [fx, dn], s: 22 }];
      if (n === 3) return [{ c: [fx - 24, up], s: 22 }, { c: [fx + 24, up], s: 22 }, { c: [fx, dn], s: 22 }];
      if (n === 6) return [-30, 0, 30].map(x => ({ c: [fx + x, up], s: 16 })).concat([-18, 18].map(x => ({ c: [fx + x, dn - 3], s: 15 })), [{ c: [fx, dn + 13], s: 13 }]);
      if (n === 4) return [-22, 22].map(x => fitIn(fx + x, up, 20)).concat([-15, 15].map(x => fitIn(fx + x, dn, 17)));
      return [-30, 0, 30].map(x => fitIn(fx + x, up, 16)).concat([-15, 15].map(x => fitIn(fx + x, dn, 16))).slice(0, n);
    }
    if (ord && ord.kind === 'bars') {
      if (n === 3) return [{ c: [fx - 24, ord.zone[1] - 12], s: 18 }, { c: [fx + 24, ord.zone[1] - 12], s: 18 }, { c: [fx, ord.zone[3] + 16], s: 18 }];
      if (n === 2) return [fitIn(fx, ord.zone[1] - 12, 18), fitIn(fx, ord.zone[3] + 16, 18)];
      if (n > 3) return [-28, 0, 28].map(x => fitIn(fx + x, ord.zone[1] - 12, 15)).concat([-14, 14, 0].map(x => fitIn(fx + x, ord.zone[3] + 14, 14))).slice(0, n);
      return [{ c: [fx, ord.zone[1] - 12], s: 18 }];
    }
    if (ord && (ord.kind === 'bend' || ord.kind === 'bend sinister')) {
      // above the bend (towards sinister chief) and below it (towards dexter base)
      const sgn = ord.sin ? -1 : 1;
      const up = [[22, -30], [38, -12], [6, -46]], dn = [[-24, 30], [-38, 12], [-8, 44]];
      const split = { 1: [1, 0], 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3] }[Math.min(n, 6)] || [1, 1];
      const size = n <= 2 ? 24 : n <= 4 ? 19 : 15;
      const fit = (o, s) => {
        let x = fx + sgn * o[0], y = fy + o[1];
        for (let k = 0; k < 16; k++) {
          const half = sh.halfAt(Math.min(SH - 2, y + s / 2));
          if (Math.abs(x - 50) + s / 2 <= half - 2 && y - s / 2 >= 3) break;
          s *= 0.93; x = 50 + (x - 50) * 0.97;
        }
        return { c: [x, y], s };
      };
      return up.slice(0, split[0]).concat(dn.slice(0, split[1])).map(o => fit(o, size));
    }
    if (ord && ord.kind === 'chevron') {
      const a = ord.apex;
      // the one in base clears the chevron's inner edges (lines at 45 degrees through the inner corner, 22 * sqrt2
      // below the top): a charge of size s centred on the pale line does so s / sqrt2 below that corner
      const inner = a[1] + 22 * Math.SQRT2, inBase = (s) => fitIn(a[0], inner + s * Math.SQRT1_2 + 3, s);
      if (n === 3) return [{ c: [a[0] - 28, a[1] - 4], s: 22 }, { c: [a[0] + 28, a[1] - 4], s: 22 }, inBase(24)];
      if (n === 2) return [{ c: [a[0] - 28, a[1] - 4], s: 22 }, { c: [a[0] + 28, a[1] - 4], s: 22 }];
      if (n === 4) return [fitIn(a[0] - 28, a[1] - 4, 20), fitIn(a[0] + 28, a[1] - 4, 20), fitIn(a[0] - 12, a[1] + 56, 15), fitIn(a[0] + 12, a[1] + 56, 15)];
      if (n >= 5) {
        // two above each arm, and one or two in base
        const above = [[-34, -10], [-16, -24], [16, -24], [34, -10]].map(o => fitIn(a[0] + o[0], a[1] + o[1], 15));
        const base = n === 5 ? [fitIn(a[0], a[1] + 54, 18)] : [fitIn(a[0] - 11, a[1] + 56, 14), fitIn(a[0] + 11, a[1] + 56, 14)];
        return above.concat(base).slice(0, n);
      }
      return [inBase(26)];
    }
    if (ord && ord.kind === 'pale') {
      if (n === 1) return [{ c: [fx - 31, fy], s: 22 }];
      if (n === 2) return [{ c: [fx - 31, fy], s: 22 }, { c: [fx + 31, fy], s: 22 }];
      if (n === 4) return [[-31, -22], [31, -22], [-31, 24], [31, 24]].map(o => ({ c: [fx + o[0], fy + o[1]], s: 18 }));
      if (n === 3) return [[-31, -22], [-31, 24], [31, 0]].map(o => fitIn(fx + o[0], fy + o[1], 18));
      // five or six: in pale on either side
      return [[-31, -32], [31, -32], [-31, 0], [31, 0], [-31, 32], [31, 32]].map(o => fitIn(fx + o[0], fy + o[1], 16)).slice(0, n);
    }
    if (ord && ord.kind === 'cross') {
      const c = ord.centre, w = ord.w;
      return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(o => ({ c: [c[0] + o[0] * (w / 2 + 16), c[1] + o[1] * (w / 2 + 16) + (o[1] > 0 ? 4 : 0)], s: 19 })).slice(0, n);
    }
    if (ord && ord.kind === 'saltire') {
      const c = ord.centre;
      return [[0, -34], [-34, 2], [34, 2], [0, 40]].map(o => ({ c: [c[0] + o[0], c[1] + o[1]], s: 18 })).slice(0, n);
    }
    if (ord && ord.kind === 'canton') {
      return arrangement0(n, sh, Object.assign({}, ctx, { ord: null }));
    }
    // a divided field with no chief: two or three charges stand clear of the partition line, one in each part
    // (per pale side by side; per fess and per chevron two above, one below)
    const dv = !ctx.chief && !ctx.inPale && !ctx.inFess ? ctx.div : null;
    if (dv && n >= 2 && n <= 3) {
      const k = ctx.bordure ? 0.86 : 1;
      if (dv === 'per pale' && n === 2) return [{ c: [28, fy], s: 36 * k }, { c: [72, fy], s: 36 * k }];
      if (dv === 'per fess' && n === 2) return [{ c: [50, 28], s: 34 * k }, { c: [50, 82], s: 32 * k }];
      if (dv === 'per fess') return [{ c: [27, 30], s: 28 * k }, { c: [73, 30], s: 28 * k }, { c: [50, 83], s: 30 * k }];
      if (dv === 'per chevron' && n === 2) return [{ c: [50, 21], s: 26 * k }, { c: [50, 88], s: 28 * k }];
      if (dv === 'per chevron') return [{ c: [24, 26], s: 28 * k }, { c: [76, 26], s: 28 * k }, { c: [50, 88], s: 28 * k }];
    }
    // plain field (possibly under a chief, or inside a bordure)
    const shrink = ctx.bordure ? 0.84 : 1;
    const midY = ctx.chief ? cy + 2 : fy;
    if (n === 1) return [{ c: [fx, midY], s: (ctx.chief ? 62 : 80) * shrink }];
    if (n === 2) return ctx.inFess ? [{ c: [fx - 23, midY], s: 40 * shrink }, { c: [fx + 23, midY], s: 40 * shrink }] : [{ c: [fx, midY - 22], s: 40 * shrink }, { c: [fx, midY + 24], s: 36 * shrink }];
    if (n === 3) {
      if (ctx.inPale) return [-30, 0, 30].map(d => ({ c: [fx, midY + d], s: 26 * shrink }));
      if (ctx.inFess) return [-30, 0, 30].map(d => ({ c: [fx + d, midY], s: 27 * shrink }));
      const dy = ctx.chief ? 15 : 19;
      return [{ c: [fx - 24, midY - dy], s: 36 * shrink }, { c: [fx + 24, midY - dy], s: 36 * shrink }, { c: [fx, midY + dy + 4], s: 36 * shrink }];
    }
    if (n === 4) return [[-22, -20], [22, -20], [-22, 22], [22, 22]].map(o => ({ c: [fx + o[0], midY + o[1]], s: 27 * shrink }));
    if (n === 5) return [[-24, -24], [24, -24], [0, 0], [-24, 24], [24, 24]].map(o => ({ c: [fx + o[0], midY + o[1]], s: 22 * shrink }));
    if (n === 6) return [[-28, -26], [0, -26], [28, -26], [-15, 2], [15, 2], [0, 29]].map(o => ({ c: [fx + o[0], midY + o[1]], s: 21 * shrink }));
    return [{ c: [fx, midY], s: 60 * shrink }];
  }
  H.arrangement = arrangement;

  // A principal charge (or group) with accompanying charges and no ordinary between them: the principal
  // group is shrunk toward the fess point and the accompanying ones take the space it gives up, where the
  // blazon puts them (in chief, in base, dexter or sinister chief) or round about it.
  function flankLayout(sh, gMain, gAr, ctx = {}) {
    const SH = sh.H || 120; const [fx, fy] = sh.fess;
    const top = ctx.chief ? 36 : 4; const na = gAr.n || 1; const inset = ctx.bordure ? 10 : 3;
    const where = gAr.where || 'betw';
    let f = 0.68, dx = 0, dy = 0, around = [];
    const inside = (x, y, s) => {
      // pull a slot inward until its box lies inside the shield
      for (let k = 0; k < 20; k++) {
        const half = sh.halfAt(Math.min(SH - 2, y + s / 2));
        if (Math.abs(x - 50) + s / 2 <= half - inset && y - s / 2 >= top && y + s / 2 <= SH - inset - 6) break;
        s *= 0.92; x = 50 + (x - 50) * 0.96;
      }
      return { c: [x, y], s };
    };
    if (where === 'in chf' || where === 'in base') {
      const s = Math.min(22, 80 / Math.max(na, 1)); const y = where === 'in chf' ? top + 12 + (ctx.bordure ? 4 : 0) : fy + (ctx.bordure ? 34 : 40);
      around = Array.from({ length: na }, (_, i) => inside(50 + (i - (na - 1) / 2) * (s + 6), y, s));
      f = 0.72; dy = where === 'in chf' ? 10 : -10;
    } else if (where === 'dx' || where === 'sn' || na === 1) {
      const x = where === 'sn' ? 82 : 18;
      around = [inside(x, top + 13, 20)];
      f = 0.8; dx = where === 'sn' ? -5 : 5; dy = 5;
    } else if (na === 2) {
      around = [inside(14, fy, 18), inside(86, fy, 18)]; f = 0.66;
    } else if (na === 3) {
      around = [inside(17, top + 14, 18), inside(83, top + 14, 18), inside(50, fy + 42, 18)]; f = 0.66; dy = 2;
    } else if (na === 4) {
      around = [inside(17, top + 14, 17), inside(83, top + 14, 17), inside(17, fy + 22, 15), inside(83, fy + 22, 15)]; f = 0.64;
    } else {
      // an orle of small charges round the edge
      const mid = P.flatten(P.map(sh.path, [0.82, 0, 0, 0.82, 9, 9]), 24)[0]; const L = [0];
      for (let i = 1; i < mid.length; i++) L.push(L[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
      const tot = L[L.length - 1];
      for (let k = 0; k < na; k++) { const s = (k + 0.5) / na * tot; let i = 1; while (i < L.length - 1 && L[i] < s) i++; around.push({ c: mid[i], s: 11 }); }
      f = 0.6;
    }
    // a label hangs in chief: the principal charge is not raised into it
    if (ctx.label) dy = Math.max(dy, 2);
    const base = arrangement(gMain.n, sh, { chief: ctx.chief, bordure: ctx.bordure, inPale: gMain.inPale, inFess: gMain.inFess, div: ctx.div });
    // on a divided field each charge keeps its part, shrinking about its own centre
    const own = /^per (pale|fess|chevron)$/.test(ctx.div || '') && gMain.n >= 2 && gMain.n <= 3;
    const main = base.map(sl => own ? { c: sl.c.slice(), s: sl.s * f, rot: sl.rot } : { c: [fx + (sl.c[0] - fx) * f + dx, fy + (sl.c[1] - fy) * f + dy], s: sl.s * f, rot: sl.rot });
    return { main, around };
  }
  H.flankLayout = flankLayout;

  // semy: a staggered lattice of small charges over the whole field
  function semy(sh, size = 11) {
    const SH = sh.H || 120;
    const out = []; const dx = size * 1.75, dy = size * 1.55;
    for (let j = 0, y = size * 0.75; y < SH; j++, y += dy) for (let x = (j % 2 ? dx / 2 : 0) + size * 0.7; x < SW; x += dx) out.push({ c: [x, y], s: size });
    return out;
  }
  H.semy = semy;
})(typeof self !== 'undefined' ? self : globalThis);
