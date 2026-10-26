/* The charge library. Every charge is drawn here, in a unit box (x right, y down,
   beasts facing dexter, i.e. the viewer's left); nothing is copied from Commons or
   WappenWiki, whose drawings are share-alike or non-commercial.

   A charge is { parts: [{path, role}], details: [{path, fill, w}] }:
   parts are filled shapes whose union is outlined (the renderer strokes all parts
   first, then fills them, so inner seams disappear); role is 'body' or a feature
   that can take its own tincture ('arms' claws and beak, 'tongue', 'crown');
   details are ink lines drawn on top (eyes, ribs, feathers, masonry).

   The beasts are built from a skeleton: joints per attitude, limbs as tapered
   capsules, so one construction gives lion, bear, boar, wolf, stag, horse and goat
   in rampant, passant and statant. */
(function (root) {
  'use strict';
  const H = root.Heraldry = root.Heraldry || {};
  const P = H.P;
  const C = {};

  const part = (path, role = 'body') => ({ path, role });
  const line = (pts, w = 1, closed = false) => ({ path: P.poly(pts, closed), fill: false, w });
  const curve = (pts, w = 1) => ({ path: P.smooth(pts, false), fill: false, w });
  const dot = (x, y, r) => ({ path: P.circle(x, y, r), fill: true, w: 0 });
  const star = (cx, cy, R, r, n, rot = -Math.PI / 2) => {
    const pts = [];
    for (let i = 0; i < 2 * n; i++) { const a = rot + Math.PI * i / n; const rr = i % 2 ? r : R; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    return pts;
  };
  const mirrorX = pts => pts.map(q => [1 - q[0], q[1]]);
  // polygon of circle A minus circle B (crescents)
  function circleMinus(ax, ay, ar, bx, by, br, n = 96) {
    const outA = [], inB = [];
    for (let i = 0; i < n; i++) {
      const t = 2 * Math.PI * i / n;
      const pa = [ax + ar * Math.cos(t), ay + ar * Math.sin(t)];
      if (Math.hypot(pa[0] - bx, pa[1] - by) > br) outA.push({ t, p: pa });
      const pb = [bx + br * Math.cos(t), by + br * Math.sin(t)];
      if (Math.hypot(pb[0] - ax, pb[1] - ay) < ar) inB.push({ t, p: pb });
    }
    // order A's arc continuously (it wraps), B's arc reversed
    const contig = arr => { let k = 0; for (let i = 1; i < arr.length; i++) if (arr[i].t - arr[i - 1].t > 1.5 * 2 * Math.PI / n) k = i; return arr.slice(k).concat(arr.slice(0, k)); };
    const A = contig(outA).map(o => o.p), B = contig(inB).map(o => o.p).reverse();
    return A.concat(B);
  }

  // ---------- geometric charges ----------
  C.roundel = () => ({ parts: [part(P.circle(0.5, 0.5, 0.5))] });
  C.annulet = () => ({ parts: [part(P.concat(P.circle(0.5, 0.5, 0.5), P.circle(0.5, 0.5, 0.31)))] });
  C.lozenge = () => ({ parts: [part(P.poly([[0.5, 0], [0.86, 0.5], [0.5, 1], [0.14, 0.5]]))] });
  C.fusil = () => ({ parts: [part(P.poly([[0.5, 0], [0.75, 0.5], [0.5, 1], [0.25, 0.5]]))] });
  C.mascle = () => ({ parts: [part(P.concat(P.poly([[0.5, 0], [0.86, 0.5], [0.5, 1], [0.14, 0.5]]), P.poly([[0.5, 0.24], [0.69, 0.5], [0.5, 0.76], [0.31, 0.5]])))] });
  C.billet = () => ({ parts: [part(P.poly([[0.22, 0], [0.78, 0], [0.78, 1], [0.22, 1]]))] });
  C.mullet = () => ({ parts: [part(P.poly(star(0.5, 0.53, 0.5, 0.2, 5)))] });
  C['mullet of six points'] = () => ({ parts: [part(P.poly(star(0.5, 0.5, 0.5, 0.25, 6)))] });
  C.estoile = () => {
    // six wavy rays
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10; const r = 0.08 + 0.42 * t; const wob = 0.11 * Math.sin(t * Math.PI * 2) * (1 - t);
        pts.push([0.5 + r * Math.cos(a + wob) + 0.0, 0.5 + r * Math.sin(a + wob)]);
      }
      for (let k = 10; k >= 0; k--) {
        const t = k / 10; const r = 0.08 + 0.42 * t; const wob = 0.11 * Math.sin(t * Math.PI * 2) * (1 - t);
        const w = 0.07 * (1 - t);
        pts.push([0.5 + r * Math.cos(a + wob + w / Math.max(r, 0.1)), 0.5 + r * Math.sin(a + wob + w / Math.max(r, 0.1))]);
      }
    }
    return { parts: [part(P.poly(pts))] };
  };
  C.crescent = () => ({ parts: [part(P.poly(circleMinus(0.5, 0.56, 0.44, 0.5, 0.36, 0.36)))] });
  C.heart = () => ({ parts: [part([['M', 0.5, 0.97], ['C', 0.22, 0.74, 0.02, 0.52, 0.04, 0.3], ['C', 0.06, 0.08, 0.36, 0.0, 0.5, 0.22], ['C', 0.64, 0.0, 0.94, 0.08, 0.96, 0.3], ['C', 0.98, 0.52, 0.78, 0.74, 0.5, 0.97], ['Z']])] });
  C.cross = () => ({ parts: [part(P.poly([[0.38, 0], [0.62, 0], [0.62, 0.38], [1, 0.38], [1, 0.62], [0.62, 0.62], [0.62, 1], [0.38, 1], [0.38, 0.62], [0, 0.62], [0, 0.38], [0.38, 0.38]]))] });
  C['cross crosslet'] = (o = {}) => {
    const w = 0.09, c = 0.5, fitchy = o.fitchy;
    const bars = [];
    const rect = (x0, y0, x1, y1) => bars.push(part(P.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])));
    rect(c - w, 0.02, c + w, fitchy ? 0.78 : 0.98);             // upright
    rect(0.02, 0.36 - w, 0.98, 0.36 + w);                       // traverse
    rect(c - 0.2, 0.12 - w * 0.8, c + 0.2, 0.12 + w * 0.8);     // crosslets
    rect(0.12 - w * 0.8, 0.16, 0.12 + w * 0.8, 0.56);
    rect(0.88 - w * 0.8, 0.16, 0.88 + w * 0.8, 0.56);
    if (fitchy) bars.push(part(P.poly([[c - w, 0.76], [c + w, 0.76], [c, 1.0]])));
    else rect(c - 0.2, 0.84 - w * 0.8, c + 0.2, 0.84 + w * 0.8);
    return { parts: bars };
  };
  C['cross patty'] = () => {
    const k = 0.13, e = 0.33;
    const arm = (a) => {
      const pts = [[0.5 - k * 0.5, 0.5 - k * 0.5], [0.5 - e, 0.02], [0.5 + e, 0.02], [0.5 + k * 0.5, 0.5 - k * 0.5]];
      const m = P.mat.mul(P.mat.tr(0.5, 0.5), P.mat.mul(P.mat.rot(a), P.mat.tr(-0.5, -0.5)));
      return part([['M', ...P.mapPt(pts[0], m)], ['C', ...P.mapPt([0.5 - 0.1, 0.25], m), ...P.mapPt([0.5 - e + 0.02, 0.1], m), ...P.mapPt(pts[1], m)], ['L', ...P.mapPt(pts[2], m)],
        ['C', ...P.mapPt([0.5 + e - 0.02, 0.1], m), ...P.mapPt([0.5 + 0.1, 0.25], m), ...P.mapPt(pts[3], m)], ['Z']]);
    };
    return { parts: [0, 1, 2, 3].map(i => arm(i * Math.PI / 2)).concat([part(P.circle(0.5, 0.5, 0.1))]) };
  };
  C['fleur-de-lis'] = () => {
    const centre = [['M', 0.44, 0.63], ['C', 0.33, 0.47, 0.37, 0.22, 0.5, 0.0], ['C', 0.63, 0.22, 0.67, 0.47, 0.56, 0.63], ['Z']];
    const sideL = [[0.43, 0.6], [0.33, 0.47], [0.2, 0.36], [0.08, 0.37], [0.02, 0.48], [0.07, 0.6], [0.11, 0.56], [0.12, 0.49], [0.2, 0.47], [0.3, 0.55], [0.38, 0.64]];
    const footL = [[0.45, 0.68], [0.37, 0.77], [0.29, 0.84], [0.21, 0.83], [0.22, 0.76], [0.29, 0.75], [0.36, 0.71]];
    return {
      parts: [part(centre), part(P.smooth(sideL)), part(P.smooth(mirrorX(sideL))), part(P.smooth(footL)), part(P.smooth(mirrorX(footL))),
        part(P.poly([[0.45, 0.66], [0.55, 0.66], [0.5, 0.96]])), part(P.poly([[0.3, 0.6], [0.7, 0.6], [0.7, 0.69], [0.3, 0.69]]))],
      details: [],
    };
  };
  C.rose = () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      parts.push(part(P.circle(0.5 + 0.25 * Math.cos(a), 0.5 + 0.25 * Math.sin(a), 0.22)));
      const b = a + Math.PI / 5;   // barbs between the petals
      parts.push(part(P.poly([[0.5 + 0.28 * Math.cos(b - 0.22), 0.5 + 0.28 * Math.sin(b - 0.22)], [0.5 + 0.5 * Math.cos(b), 0.5 + 0.5 * Math.sin(b)], [0.5 + 0.28 * Math.cos(b + 0.22), 0.5 + 0.28 * Math.sin(b + 0.22)]]), 'barb'));
    }
    const details = [{ path: P.circle(0.5, 0.5, 0.12), fill: false, w: 1 }];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; details.push(dot(0.5 + 0.06 * Math.cos(a), 0.5 + 0.06 * Math.sin(a), 0.014)); }
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5 + Math.PI / 5; details.push(line([[0.5 + 0.13 * Math.cos(a), 0.5 + 0.13 * Math.sin(a)], [0.5 + 0.27 * Math.cos(a), 0.5 + 0.27 * Math.sin(a)]], 0.8)); }
    return { parts, details };
  };
  C.cinquefoil = () => {
    const parts = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; parts.push(part(P.circle(0.5 + 0.27 * Math.cos(a), 0.5 + 0.27 * Math.sin(a), 0.2))); }
    parts.push(part(P.circle(0.5, 0.5, 0.18)));
    return { parts, details: [{ path: P.circle(0.5, 0.5, 0.07), fill: false, w: 1 }] };
  };
  C.trefoil = () => {
    const parts = [part(P.circle(0.5, 0.25, 0.2)), part(P.circle(0.27, 0.5, 0.2)), part(P.circle(0.73, 0.5, 0.2)), part(P.circle(0.5, 0.47, 0.14)),
      part(P.ribbon(P.curvePts([[0.5, 0.55], [0.52, 0.75], [0.6, 0.98]]), 0.035))];
    return { parts };
  };
  C.escallop = () => {
    const pts = [[0.5, 0.15]];
    pts.push([0.3, 0.2], [0.13, 0.33], [0.04, 0.55]);
    const n = 9;
    for (let i = 0; i <= n * 6; i++) {
      const t = i / (n * 6); const a = Math.PI * (1.0 - t) + 0.0;
      const bump = 1 + 0.045 * Math.abs(Math.sin(t * n * Math.PI));
      pts.push([0.5 + 0.46 * Math.cos(a) * bump, 0.56 + 0.42 * Math.sin(a) * bump]);
    }
    pts.push([0.87, 0.33], [0.7, 0.2]);
    const details = [];
    for (let i = 1; i < n; i++) {
      const t = i / n; const a = Math.PI * (1 - t);
      details.push(curve([[0.5, 0.2], [0.5 + 0.25 * Math.cos(a), 0.4 + 0.22 * Math.sin(a)], [0.5 + 0.43 * Math.cos(a), 0.56 + 0.39 * Math.sin(a)]], 0.8));
    }
    return { parts: [part(P.poly(pts)), part(P.poly([[0.3, 0.06], [0.5, 0.1], [0.5, 0.2], [0.33, 0.22], [0.26, 0.14]])), part(P.poly([[0.7, 0.06], [0.5, 0.1], [0.5, 0.2], [0.67, 0.22], [0.74, 0.14]]))], details };
  };
  C.escutcheon = () => ({ parts: [part(P.map(H.shield('heater').path, [0.0084, 0, 0, 0.0084, 0.08, 0]))] });
  C.billet = C.billet;
  C.trimount = () => {
    // three hills, the middle one higher, on a level base; contour lines as an engraver would cut them
    const base = 1;
    const dome = (x0, x1, top) => {
      const w = x1 - x0, h = base - top, xm = (x0 + x1) / 2;
      return [['M', x0, base], ['C', x0 + 0.1 * w, base - 0.62 * h, xm - 0.3 * w, top, xm, top], ['C', xm + 0.3 * w, top, x1 - 0.1 * w, base - 0.62 * h, x1, base], ['Z']];
    };
    const hills = [[-0.02, 0.44, 0.64], [0.18, 0.82, 0.42], [0.56, 1.02, 0.64]];
    const parts = hills.map(([x0, x1, top]) => part(dome(x0, x1, top)));
    const details = [];
    for (const [x0, x1, top] of hills) {
      const w = x1 - x0, h = base - top, xm = (x0 + x1) / 2;
      for (const f of [0.22, 0.42]) {
        const y = top + h * f, half = w * (0.18 + 0.32 * f);
        details.push(curve([[xm - half, y + h * 0.1], [xm, y], [xm + half, y + h * 0.1]], 0.7));
      }
    }
    return { parts, details };
  };
  C.tower = () => {
    const parts = [part(P.poly([[0.18, 0.22], [0.82, 0.22], [0.82, 1], [0.18, 1]]))];
    const merl = [];
    for (let i = 0; i < 4; i++) { const x0 = 0.12 + i * 0.22; merl.push(part(P.poly([[x0, 0.02], [x0 + 0.14, 0.02], [x0 + 0.14, 0.24], [x0, 0.24]]))); }
    parts.push(part(P.poly([[0.12, 0.16], [0.88, 0.16], [0.88, 0.26], [0.12, 0.26]])));
    const details = [
      { path: P.concat(P.poly([[0.4, 1], [0.4, 0.74], [0.6, 0.74], [0.6, 1]], false)), fill: false, w: 1 },
      { path: [['M', 0.4, 0.75], ['C', 0.4, 0.66, 0.6, 0.66, 0.6, 0.75]], fill: false, w: 1 },
      { path: P.poly([[0.45, 0.76], [0.55, 0.76], [0.55, 1], [0.45, 1]]), fill: true, w: 0 },
      { path: P.poly([[0.46, 0.38], [0.54, 0.38], [0.54, 0.52], [0.46, 0.52]]), fill: true, w: 0 },
    ];
    for (const y of [0.34, 0.5, 0.66, 0.82]) details.push(line([[0.18, y], [0.82, y]], 0.5));
    return { parts: parts.concat(merl), details };
  };
  C.castle = () => {
    const parts = [part(P.poly([[0.12, 0.42], [0.88, 0.42], [0.88, 1], [0.12, 1]]))];
    const tower = (x0, x1, top) => {
      parts.push(part(P.poly([[x0, top + 0.1], [x1, top + 0.1], [x1, 1], [x0, 1]])));
      const n = 3, w = (x1 - x0 + 0.04) / (2 * n - 1);
      for (let i = 0; i < n; i++) parts.push(part(P.poly([[x0 - 0.02 + 2 * i * w, top], [x0 - 0.02 + (2 * i + 1) * w, top], [x0 - 0.02 + (2 * i + 1) * w, top + 0.12], [x0 - 0.02 + 2 * i * w, top + 0.12]])));
    };
    tower(0.02, 0.3, 0.12); tower(0.36, 0.64, 0.0); tower(0.7, 0.98, 0.12);
    for (let i = 0; i < 4; i++) parts.push(part(P.poly([[0.3 + i * 0.1, 0.34], [0.35 + i * 0.1, 0.34], [0.35 + i * 0.1, 0.44], [0.3 + i * 0.1, 0.44]])));
    const details = [
      { path: [['M', 0.4, 1], ['L', 0.4, 0.78], ['C', 0.4, 0.68, 0.6, 0.68, 0.6, 0.78], ['L', 0.6, 1]], fill: false, w: 1 },
      { path: P.poly([[0.44, 0.8], [0.56, 0.8], [0.56, 1], [0.44, 1]]), fill: true, w: 0 },
      { path: P.poly([[0.13, 0.36], [0.19, 0.36], [0.19, 0.48], [0.13, 0.48]]), fill: true, w: 0 },
      { path: P.poly([[0.81, 0.36], [0.87, 0.36], [0.87, 0.48], [0.81, 0.48]]), fill: true, w: 0 },
      { path: P.poly([[0.47, 0.24], [0.53, 0.24], [0.53, 0.36], [0.47, 0.36]]), fill: true, w: 0 },
    ];
    return { parts, details };
  };
  C.key = () => {
    const parts = [part(P.concat(P.circle(0.5, 0.16, 0.15), P.circle(0.5, 0.16, 0.08))),
      part(P.poly([[0.46, 0.29], [0.54, 0.29], [0.54, 1], [0.46, 1]])),
      part(P.poly([[0.54, 0.74], [0.72, 0.74], [0.72, 0.8], [0.64, 0.8], [0.64, 0.86], [0.72, 0.86], [0.72, 0.98], [0.54, 0.98]])),
      part(P.poly([[0.42, 0.33], [0.58, 0.33], [0.58, 0.37], [0.42, 0.37]]))];
    return { parts };
  };
  C.crown = () => {
    const parts = [part(P.poly([[0.08, 0.62], [0.92, 0.62], [0.88, 0.9], [0.12, 0.9]]))];
    for (const [x, h] of [[0.12, 0.32], [0.5, 0.18], [0.88, 0.32]]) {
      parts.push(part(P.poly([[x - 0.1, 0.64], [x, h + 0.12], [x + 0.1, 0.64]])));
      parts.push(part(P.circle(x, h + 0.06, 0.07)));
    }
    for (const x of [0.31, 0.69]) { parts.push(part(P.poly([[x - 0.06, 0.64], [x, 0.44], [x + 0.06, 0.64]]))); parts.push(part(P.circle(x, 0.42, 0.045))); }
    const details = [line([[0.1, 0.7], [0.9, 0.7]], 0.7), line([[0.11, 0.82], [0.89, 0.82]], 0.7)];
    for (const x of [0.25, 0.5, 0.75]) details.push(dot(x, 0.76, 0.025));
    return { parts, details };
  };
  C.wheel = () => {
    const parts = [part(P.concat(P.circle(0.5, 0.5, 0.5), P.circle(0.5, 0.5, 0.39))), part(P.circle(0.5, 0.5, 0.11))];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; parts.push(part(P.capsule([0.5, 0.5], 0.035, [0.5 + 0.42 * Math.cos(a), 0.5 + 0.42 * Math.sin(a)], 0.028, 4))); }
    return { parts, details: [dot(0.5, 0.5, 0.035)] };
  };
  C.horseshoe = () => {
    const outer = [], inner = [];
    for (let k = 0; k <= 30; k++) { const a = Math.PI * (-0.15 + 1.3 * k / 30); outer.push([0.5 + 0.46 * Math.cos(a), 0.45 - 0.5 * Math.sin(a)]); inner.push([0.5 + 0.3 * Math.cos(a), 0.45 - 0.34 * Math.sin(a)]); }
    // opening downward: flip y
    const flip = q => [q[0], 0.95 - q[1]];
    const poly = outer.map(flip).concat(inner.reverse().map(flip));
    const details = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI * (0.02 + 0.96 * k / 5); details.push(dot(0.5 + 0.38 * Math.cos(a), 0.95 - (0.45 - 0.42 * Math.sin(a)), 0.025)); }
    return { parts: [part(P.poly(poly))], details };
  };
  C['bugle horn'] = () => {
    // a curved horn, mouth to the dexter, with bands and a hanging string
    const spine = P.curvePts([[0.12, 0.52], [0.3, 0.68], [0.55, 0.7], [0.78, 0.55], [0.9, 0.36]], 10);
    const horn = P.ribbon(spine, t => 0.16 * (1 - t) + 0.035 * t);
    const parts = [part(horn), part(P.capsule([0.9, 0.36], 0.035, [0.95, 0.27], 0.03, 5))];
    const details = [];
    for (const t of [0.35, 0.62]) {
      const i = Math.round(t * (spine.length - 1)); const a = spine[i], b = spine[i + 1];
      const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny); const w = 0.16 * (1 - t) + 0.035 * t;
      details.push(line([[a[0] + nx / L * w, a[1] + ny / L * w], [a[0] - nx / L * w, a[1] - ny / L * w]], 1.4));
    }
    details.push(curve([[0.36, 0.56], [0.42, 0.25], [0.58, 0.12], [0.7, 0.24], [0.74, 0.5]], 1.2));
    return { parts, details };
  };
  C.sword = () => ({
    parts: [part(P.poly([[0.46, 0.3], [0.46, 0.92], [0.5, 1], [0.54, 0.92], [0.54, 0.3]])), part(P.poly([[0.28, 0.24], [0.72, 0.24], [0.72, 0.3], [0.28, 0.3]])),
      part(P.poly([[0.47, 0.08], [0.53, 0.08], [0.53, 0.24], [0.47, 0.24]])), part(P.circle(0.5, 0.06, 0.05))],
    details: [line([[0.5, 0.32], [0.5, 0.9]], 0.6)],
  });
  C.arrow = () => ({
    parts: [part(P.poly([[0.48, 0.12], [0.52, 0.12], [0.52, 0.94], [0.48, 0.94]])), part(P.poly([[0.4, 0.18], [0.5, 0], [0.6, 0.18], [0.5, 0.14]])),
      part(P.poly([[0.48, 0.8], [0.38, 0.98], [0.38, 0.86], [0.48, 0.7]])), part(P.poly([[0.52, 0.8], [0.62, 0.98], [0.62, 0.86], [0.52, 0.7]]))],
  });
  C.axe = () => ({
    parts: [part(P.poly([[0.5, 0.06], [0.56, 0.06], [0.56, 1], [0.5, 1]])),
      part([['M', 0.5, 0.12], ['C', 0.36, 0.12, 0.2, 0.06, 0.12, 0.02], ['C', 0.04, 0.2, 0.04, 0.38, 0.12, 0.52], ['C', 0.22, 0.44, 0.36, 0.36, 0.5, 0.36], ['Z']])],
  });
  C.buckle = () => ({
    parts: [part(P.concat(P.circle(0.5, 0.5, 0.48), P.circle(0.5, 0.5, 0.36))), part(P.poly([[0.47, 0.06], [0.53, 0.06], [0.53, 0.62], [0.47, 0.62]])),
      part(P.poly([[0.42, 0.56], [0.58, 0.56], [0.5, 0.72]]))],
  });
  C['chess rook'] = () => ({
    parts: [part([['M', 0.1, 0.05], ['C', 0.1, 0.3, 0.3, 0.4, 0.38, 0.42], ['L', 0.38, 0.86], ['L', 0.18, 0.86], ['L', 0.18, 0.98], ['L', 0.82, 0.98], ['L', 0.82, 0.86], ['L', 0.62, 0.86], ['L', 0.62, 0.42],
      ['C', 0.7, 0.4, 0.9, 0.3, 0.9, 0.05], ['C', 0.78, 0.1, 0.7, 0.3, 0.5, 0.3], ['C', 0.3, 0.3, 0.22, 0.1, 0.1, 0.05], ['Z']])],
  });
  C['ermine spot'] = () => ({
    parts: [part(P.poly([[0.5, 0.36], [0.3, 1], [0.5, 0.82], [0.7, 1]])), part(P.circle(0.5, 0.12, 0.11)), part(P.circle(0.3, 0.3, 0.1)), part(P.circle(0.7, 0.3, 0.1))],
  });

  // ---------- plants ----------
  C.tree = () => {
    const parts = [part(P.poly([[0.44, 0.55], [0.56, 0.55], [0.6, 0.92], [0.4, 0.92]])), part(P.poly([[0.28, 0.98], [0.4, 0.88], [0.6, 0.88], [0.72, 0.98]]))];
    const blobs = [[0.5, 0.18, 0.18], [0.3, 0.3, 0.17], [0.7, 0.3, 0.17], [0.2, 0.46, 0.14], [0.8, 0.46, 0.14], [0.4, 0.44, 0.17], [0.6, 0.44, 0.17], [0.5, 0.34, 0.16]];
    for (const [x, y, r] of blobs) parts.push(part(P.circle(x, y, r)));
    const details = [];
    for (const [x, y, r] of blobs.slice(0, 5)) details.push(curve([[x - r * 0.5, y + r * 0.2], [x, y - r * 0.15], [x + r * 0.5, y + r * 0.2]], 0.6));
    return { parts, details };
  };
  C.antler = () => {
    // a stag's attire: a curved beam with tines on its inner side
    const beam = P.curvePts([[0.62, 1.0], [0.68, 0.78], [0.6, 0.52], [0.66, 0.26], [0.84, 0.04]], 8);
    const parts = [part(P.ribbon(beam, t => 0.07 * (1 - t) + 0.035 * t))];
    const tines = [[0.18, 0.36, 0.22], [0.42, 0.3, 0.2], [0.64, 0.26, 0.17], [0.82, 0.2, 0.13]];
    for (const [t, len, ang0] of tines) {
      const i = Math.round(t * (beam.length - 1)); const p = beam[i];
      const tip = [p[0] - len, p[1] - len * 0.55];
      parts.push(part(P.ribbon(P.curvePts([p, [p[0] - len * 0.55, p[1] - len * 0.05], tip], 6), u => 0.04 * (1 - u) + 0.012 * u)));
      void ang0;
    }
    return { parts };
  };

  // ---------- birds and fish ----------
  function wing(shoulder, dir, span, nFeathers = 7, elevated = true) {
    // an eagle's wing: an arm rising from the shoulder to the wrist, the feathers hanging
    // from it and turning outward toward the tip, with gaps between their ends
    const sx = shoulder[0], sy = shoulder[1];
    const arm = P.curvePts([[sx, sy], [sx + dir * span * 0.3, sy - span * (elevated ? 0.32 : 0.1)], [sx + dir * span * 0.68, sy - span * (elevated ? 0.62 : 0.22)], [sx + dir * span, sy - span * (elevated ? 0.74 : 0.3)]], 8);
    const parts = [part(P.ribbon(arm, t => 0.06 * (1 - t) + 0.03 * t))];
    // the coverts: a solid web between the arm and the feather roots
    const web = [];
    for (let i = 0; i < nFeathers; i++) {
      const t = 0.08 + 0.92 * i / (nFeathers - 1);
      const p = arm[Math.round(t * (arm.length - 1))];
      const len = span * (0.38 + 0.34 * t);
      const ang = Math.PI / 2 - dir * (0.12 + 1.32 * t);   // hanging down by the body, outward at the tip
      const tip = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
      parts.push(part(P.capsule(p, 0.05, tip, 0.016, 6)));
      web.push([p[0] + Math.cos(ang) * len * 0.45, p[1] + Math.sin(ang) * len * 0.45]);
    }
    parts.push(part(P.poly([arm[0]].concat(web, [arm[arm.length - 1]], arm.slice().reverse()))));
    return parts;
  }
  C.wing = () => {
    const parts = wing([0.86, 0.9], -1, 0.8, 10, true);
    return { parts };
  };
  C.eagle = (o = {}) => {
    const two = !!o.doubleheaded;
    const parts = [];
    parts.push(part(P.ellipse(0.5, 0.52, 0.1, 0.18)));                    // body
    parts.push(...wing([0.45, 0.42], -1, 0.42, 7), ...wing([0.55, 0.42], 1, 0.42, 7));
    const head = (cx, dir) => {
      parts.push(part(P.capsule([0.5, 0.42], 0.06, [cx, 0.22], 0.045, 6)));
      parts.push(part(P.circle(cx, 0.19, 0.055)));
      parts.push(part(P.poly([[cx + dir * 0.04, 0.16], [cx + dir * 0.115, 0.18], [cx + dir * 0.1, 0.235], [cx + dir * 0.04, 0.22]]), 'arms'));
      parts.push(part(P.ribbon(P.curvePts([[cx + dir * 0.09, 0.215], [cx + dir * 0.13, 0.24], [cx + dir * 0.15, 0.21]], 4), 0.008), 'tongue'));
      if (o.crowned) parts.push(part(P.poly([[cx - 0.05, 0.13], [cx - 0.055, 0.06], [cx - 0.02, 0.1], [cx, 0.05], [cx + 0.02, 0.1], [cx + 0.055, 0.06], [cx + 0.05, 0.13]]), 'crown'));
      return dir;
    };
    if (two) { head(0.4, -1); head(0.6, 1); } else head(0.45, -1);
    // tail: a fan of feathers
    for (const dx of [-0.07, -0.035, 0, 0.035, 0.07]) parts.push(part(P.capsule([0.5, 0.66], 0.035, [0.5 + dx * 1.6, 0.93], 0.022, 5)));
    // legs and talons
    for (const dir of [-1, 1]) {
      const hip = [0.5 + dir * 0.05, 0.64], foot = [0.5 + dir * 0.17, 0.79];
      parts.push(part(P.capsule(hip, 0.035, foot, 0.022, 5)));
      for (const a of [-0.6, 0, 0.6]) {
        const ang = Math.PI / 2 + dir * 0.6 + a; const tip = [foot[0] + 0.07 * Math.cos(ang), foot[1] + 0.07 * Math.sin(ang)];
        parts.push(part(P.capsule(foot, 0.014, tip, 0.004, 3), 'arms'));
      }
    }
    const details = [];
    const eye = (cx) => details.push(dot(cx, 0.18, 0.012));
    if (two) { eye(0.39); eye(0.61); } else eye(0.44);
    for (const dy of [0.46, 0.53, 0.6]) details.push(curve([[0.45, dy], [0.5, dy + 0.025], [0.55, dy]], 0.6));
    return { parts, details };
  };
  C.martlet = () => {
    // a bird close, facing dexter (the martlet is legless; here with short legs as in German rolls)
    const body = P.smooth([[0.14, 0.34], [0.28, 0.26], [0.48, 0.34], [0.72, 0.42], [0.98, 0.5], [0.72, 0.58], [0.46, 0.68], [0.26, 0.6], [0.16, 0.46]]);
    const parts = [part(body), part(P.circle(0.2, 0.3, 0.1)), part(P.poly([[0.12, 0.27], [0.0, 0.31], [0.12, 0.34]]), 'arms')];
    parts.push(part(P.smooth([[0.34, 0.4], [0.56, 0.36], [0.8, 0.44], [0.6, 0.52], [0.4, 0.5]])));
    parts.push(part(P.capsule([0.38, 0.62], 0.025, [0.34, 0.8], 0.015, 4), 'arms'), part(P.capsule([0.46, 0.64], 0.025, [0.48, 0.8], 0.015, 4), 'arms'));
    const details = [dot(0.19, 0.28, 0.018), curve([[0.36, 0.44], [0.56, 0.42], [0.76, 0.47]], 0.7)];
    return { parts, details };
  };
  C.fish = (o = {}) => {
    // a barbel, naiant (horizontal), head to dexter; embowed when bent
    const bend = o.embowed ? 0.18 : 0;
    const spine = P.curvePts([[0.04, 0.5], [0.3, 0.5 - bend], [0.62, 0.5 - bend * 0.6], [0.86, 0.5]], 10);
    const w = t => 0.13 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) + 0.02;
    const parts = [part(P.ribbon(spine, w))];
    const end = spine[spine.length - 1];
    parts.push(part(P.poly([[end[0] - 0.03, end[1]], [1.0, end[1] - 0.16], [0.95, end[1]], [1.0, end[1] + 0.16]])));
    const mid = spine[Math.round(spine.length * 0.45)];
    parts.push(part(P.poly([[mid[0] - 0.12, mid[1] - 0.1], [mid[0] - 0.02, mid[1] - 0.22], [mid[0] + 0.1, mid[1] - 0.08]])));
    parts.push(part(P.poly([[mid[0] + 0.06, mid[1] + 0.1], [mid[0] + 0.12, mid[1] + 0.2], [mid[0] + 0.18, mid[1] + 0.08]])));
    const h = spine[2];
    const details = [dot(h[0] + 0.02, h[1] - 0.03, 0.015), curve([[h[0] + 0.06, h[1] - 0.09], [h[0] + 0.1, h[1]], [h[0] + 0.06, h[1] + 0.09]], 0.8),
      curve([[h[0] - 0.02, h[1] + 0.04], [h[0] - 0.06, h[1] + 0.1], [h[0] - 0.02, h[1] + 0.15]], 0.7)];
    for (let i = 3; i < spine.length - 4; i += 3) details.push(curve([[spine[i][0] + 0.02, spine[i][1] - 0.04], [spine[i][0] + 0.04, spine[i][1]], [spine[i][0] + 0.02, spine[i][1] + 0.04]], 0.4));
    return { parts, details };
  };

  // ---------- beasts on a skeleton ----------
  // Joints in the unit box per attitude (beast facing dexter). 'near' limbs are drawn last
  // (in front); 'back' is the unit normal pointing from belly to back.
  const POSES = {
    rampant: {
      head: [0.24, 0.16], headAng: Math.PI + 0.3, neck: [0.34, 0.25], sh: [0.42, 0.35], hip: [0.6, 0.66], back: [0.84, -0.54], k: 1.0,
      fore: { near: [[0.37, 0.35], [0.26, 0.29], [0.13, 0.12]], far: [[0.42, 0.42], [0.3, 0.5], [0.14, 0.47]] },
      hind: { near: [[0.56, 0.69], [0.44, 0.73], [0.3, 0.85]], far: [[0.63, 0.7], [0.71, 0.83], [0.6, 0.97]] },
      tail: [[0.68, 0.64], [0.78, 0.6], [0.83, 0.47], [0.79, 0.33], [0.84, 0.19], [0.92, 0.1]],
    },
    passant: {
      head: [0.13, 0.27], headAng: Math.PI + 0.1, neck: [0.22, 0.35], sh: [0.31, 0.45], hip: [0.72, 0.45], back: [0, -1], k: 1.15,
      fore: { near: [[0.28, 0.54], [0.2, 0.68], [0.09, 0.68]], far: [[0.34, 0.56], [0.33, 0.76], [0.3, 0.95]] },
      hind: { near: [[0.68, 0.54], [0.62, 0.75], [0.64, 0.95]], far: [[0.75, 0.53], [0.82, 0.74], [0.8, 0.95]] },
      tail: [[0.8, 0.42], [0.89, 0.34], [0.9, 0.2], [0.84, 0.11], [0.77, 0.09]],
    },
    statant: {
      head: [0.13, 0.27], headAng: Math.PI + 0.1, neck: [0.22, 0.35], sh: [0.31, 0.45], hip: [0.72, 0.45], back: [0, -1], k: 1.15,
      fore: { near: [[0.28, 0.54], [0.26, 0.75], [0.23, 0.95]], far: [[0.34, 0.56], [0.36, 0.76], [0.34, 0.95]] },
      hind: { near: [[0.68, 0.54], [0.63, 0.75], [0.64, 0.95]], far: [[0.75, 0.53], [0.81, 0.74], [0.79, 0.95]] },
      tail: [[0.81, 0.42], [0.88, 0.5], [0.91, 0.64], [0.88, 0.78], [0.92, 0.88]],
    },
  };
  const SPECIES = {
    lion: { body: 1, limb: 1, paws: 4, mane: 'lion', tail: 'tuft', head: 'lion' },
    bear: { body: 1.3, limb: 1.25, legLen: 0.8, headDrop: 0.04, paws: 4, tail: 'stub', head: 'bear' },
    boar: { body: 1.35, limb: 0.9, legLen: 0.72, headDrop: 0.08, hoof: true, crest: true, tail: 'curl', head: 'boar' },
    wolf: { body: 0.95, limb: 0.9, paws: 3, tail: 'brush', head: 'wolf' },
    talbot: { body: 1.0, limb: 0.95, paws: 3, tail: 'whip', head: 'talbot' },
    stag: { body: 1.05, limb: 0.78, hoof: true, tail: 'stub', head: 'stag' },
    horse: { body: 1.15, limb: 0.92, hoof: true, tail: 'long', head: 'horse', mane: 'horse' },
    goat: { body: 1.05, limb: 0.82, hoof: true, tail: 'stub', head: 'goat' },
    bull: { body: 1.35, limb: 1.0, legLen: 0.85, hoof: true, tail: 'whip', head: 'bull' },
    unicorn: { body: 1.1, limb: 0.92, hoof: true, tail: 'tuft', head: 'unicorn', mane: 'horse' },
    griffin: { body: 1.0, limb: 1.0, paws: 4, tail: 'tuft', head: 'griffin', wing: true },
  };
  function beast(species, attitude, o = {}) {
    const S = SPECIES[species], J0 = POSES[attitude];
    // shorter legs for heavy beasts: each limb shrinks toward its root; a lower head for boar and bear
    const ll = (S.legLen || 1) * (attitude === 'rampant' ? 1 : 0.88);
    const shrink = pts => pts.map((q, i) => i === 0 ? q : [pts[0][0] + (q[0] - pts[0][0]) * ll, pts[0][1] + (q[1] - pts[0][1]) * ll]);
    const drop = S.headDrop && attitude !== 'rampant' ? S.headDrop : 0;
    const J = Object.assign({}, J0, {
      fore: { near: shrink(J0.fore.near), far: shrink(J0.fore.far) }, hind: { near: shrink(J0.hind.near), far: shrink(J0.hind.far) },
      head: [J0.head[0], J0.head[1] + drop], neck: [J0.neck[0], J0.neck[1] + drop * 0.6],
    });
    const parts = [], details = [];
    const k = S.body * (J.k || 1), kl = S.limb;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
    const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const u = unit(sub(J.hip, J.sh)), n = J.back, L = Math.hypot(J.hip[0] - J.sh[0], J.hip[1] - J.sh[1]);
    const T = (base, a, b) => add(base, add(mul(u, a * L), mul(n, b * L * k)));
    // limbs behind the body first
    const limb = (pts, fore, far) => {
      const s = far ? 0.88 : 1;
      const r0 = (fore ? 0.07 : 0.095) * kl * s, r1 = 0.044 * kl * s, r2 = 0.033 * kl * s;
      parts.push(part(P.capsule(pts[0], r0, pts[1], r1, 8)));
      parts.push(part(P.capsule(pts[1], r1, pts[2], r2, 8)));
      const d = unit(sub(pts[2], pts[1]));
      if (S.hoof) {
        const side = [-d[1], d[0]];
        const a = add(pts[2], mul(side, r2 * 1.1)), b = add(pts[2], mul(side, -r2 * 1.1));
        parts.push(part(P.poly([a, b, add(b, mul(d, 0.05)), add(a, mul(d, 0.06))]), 'arms'));
      } else {
        parts.push(part(P.ellipse(pts[2][0] + d[0] * 0.012, pts[2][1] + d[1] * 0.012, r2 * 1.45, r2 * 1.2, Math.atan2(d[1], d[0]))));
        const base = Math.atan2(d[1], d[0]);
        for (let c = 0; c < S.paws; c++) {
          const a = base + (c - (S.paws - 1) / 2) * 0.42;
          const p0 = [pts[2][0] + Math.cos(a) * r2 * 1.3, pts[2][1] + Math.sin(a) * r2 * 1.3];
          const mid = [p0[0] + Math.cos(a) * 0.03, p0[1] + Math.sin(a) * 0.03];
          const tip = [mid[0] + Math.cos(a + 0.9) * 0.025, mid[1] + Math.sin(a + 0.9) * 0.025];
          parts.push(part(P.ribbon([p0, mid, tip], t => 0.011 * (1 - t) + 0.001), 'arms'));
        }
      }
    };
    limb(J.fore.far, true, true); limb(J.hind.far, false, true);
    // tail (behind the haunch)
    const tp = P.curvePts(J.tail, 8);
    if (S.tail === 'tuft' || S.tail === 'whip') {
      parts.push(part(P.ribbon(tp, t => 0.024 * (1 - t) + 0.012 * t)));
      if (S.tail === 'tuft') {
        // a flame-like tuft: three locks leaving the tail's end and all curling the same way
        const e = tp[tp.length - 1], p = tp[tp.length - 6]; const a = Math.atan2(e[1] - p[1], e[0] - p[0]);
        for (const [da, len] of [[-0.75, 0.07], [0, 0.1], [0.75, 0.075]]) {
          const pts = [];
          for (let s = 0; s <= 6; s++) { const f = s / 6; const ang = a + da + 1.2 * f * f; pts.push([e[0] + Math.cos(ang) * len * f, e[1] + Math.sin(ang) * len * f]); }
          parts.push(part(P.ribbon(pts, t => 0.026 * (1 - t) + 0.002)));
        }
      }
    } else if (S.tail === 'long') {
      const t2 = P.curvePts([J.tail[0], add(J.tail[0], [0.07, 0.08]), add(J.tail[0], [0.09, 0.24]), add(J.tail[0], [0.05, 0.4])], 8);
      parts.push(part(P.ribbon(t2, t => 0.025 + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.2)))));
    } else if (S.tail === 'brush') {
      const t2 = P.curvePts([J.tail[0], add(J.tail[0], [0.08, 0.06]), add(J.tail[0], [0.12, 0.2]), add(J.tail[0], [0.1, 0.32])], 8);
      parts.push(part(P.ribbon(t2, t => 0.02 + 0.035 * Math.sin(Math.PI * t * 0.9))));
    } else if (S.tail === 'curl') {
      const b = J.tail[0];
      parts.push(part(P.ribbon(P.curvePts([b, add(b, [0.06, -0.03]), add(b, [0.08, -0.09]), add(b, [0.04, -0.1]), add(b, [0.04, -0.06])], 6), t => 0.018 * (1 - t) + 0.006)));
    } else {
      parts.push(part(P.capsule(J.tail[0], 0.03, add(J.tail[0], [0.05, 0.04]), 0.018, 5)));
    }
    // body: a closed curve round chest, belly, waist, haunch and back
    const bodyPts = [
      T(J.sh, -0.24, -0.02), T(J.sh, -0.04, -0.36), T(J.sh, 0.3, -0.26), T(J.sh, 0.62, -0.15), T(J.hip, 0.0, -0.21),
      T(J.hip, 0.22, -0.07), T(J.hip, 0.23, 0.15), T(J.hip, 0.0, 0.25), T(J.sh, 0.66, 0.12), T(J.sh, 0.32, 0.22), T(J.sh, 0.0, 0.3), T(J.sh, -0.2, 0.2),
    ];
    parts.push(part(P.smooth(bodyPts)));
    // neck
    parts.push(part(P.capsule(J.neck, 0.075 * k, J.sh, 0.11 * k, 8)));
    // head
    const hc = J.head, fwd = [Math.cos(J.headAng), Math.sin(J.headAng)], up = [fwd[1], -fwd[0]];
    const H2 = (a, b) => add(hc, add(mul(fwd, a), mul(up, b)));
    const r = S.head === 'bear' ? 0.08 : S.head === 'lion' ? 0.072 : 0.065;
    parts.push(part(P.circle(hc[0], hc[1], r)));
    if (S.head === 'lion' || S.head === 'bear' || S.head === 'wolf' || S.head === 'talbot') {
      const sn = { lion: 0.09, bear: 0.085, wolf: 0.12, talbot: 0.11 }[S.head];
      parts.push(part(P.capsule(H2(0.0, 0.01), r * 0.85, H2(sn, 0.012), 0.034, 7)));                 // upper jaw
      if (S.head !== 'bear') {
        parts.push(part(P.capsule(H2(0.0, -0.04), 0.032, H2(sn - 0.015, -0.075), 0.016, 6)));       // lower jaw, the mouth open
        parts.push(part(P.ribbon(P.curvePts([H2(sn - 0.03, -0.03), H2(sn + 0.03, -0.045), H2(sn + 0.065, -0.02), H2(sn + 0.06, 0.005)], 4), t => 0.012 * (1 - t) + 0.004), 'tongue'));
        details.push(line([H2(0.03, -0.028), H2(sn + 0.01, -0.03)], 0.7));
      }
      if (S.head === 'talbot') parts.push(part(P.ribbon(P.curvePts([H2(-0.02, 0.05), H2(-0.07, 0.02), H2(-0.07, -0.07)], 5), t => 0.032 * (1 - t) + 0.016)));
      else if (S.head === 'bear') parts.push(part(P.circle(...H2(-0.03, 0.07), 0.028)));
      else parts.push(part(P.poly([H2(-0.04, 0.05), H2(-0.015, 0.13), H2(0.02, 0.06)])));
      details.push(dot(...H2(0.025, 0.028), 0.011));
      details.push(dot(...H2(sn + 0.02, 0.012), 0.008));
    } else if (S.head === 'griffin') {
      parts.push(part(P.poly([H2(0.04, 0.03), H2(0.13, 0.0), H2(0.12, -0.05), H2(0.05, -0.035)]), 'arms'));
      parts.push(part(P.ribbon(P.curvePts([H2(0.1, -0.03), H2(0.15, -0.05), H2(0.17, -0.02)], 4), 0.008), 'tongue'));
      parts.push(part(P.poly([H2(-0.04, 0.04), H2(-0.06, 0.12), H2(0.0, 0.07)])));
      details.push(dot(...H2(0.02, 0.02), 0.011));
    } else if (S.head === 'boar') {
      parts.push(part(P.capsule(H2(0, 0), r, H2(0.14, -0.01), 0.04, 7)));
      parts.push(part(P.poly([H2(0.1, -0.03), H2(0.05, -0.1), H2(0.07, -0.025)]), 'arms'));
      parts.push(part(P.poly([H2(-0.04, 0.05), H2(-0.01, 0.13), H2(0.02, 0.06)])));
      details.push(dot(...H2(0.035, 0.025), 0.011));
    } else {
      // stag, goat, horse: a long head
      parts.push(part(P.capsule(H2(0, 0), r * 0.9, H2(0.13, -0.025), 0.034, 7)));
      details.push(dot(...H2(0.025, 0.02), 0.011));
      if (S.head === 'stag') {
        for (const s of [1, -1]) {
          const b0 = H2(-0.02, 0.05), beamPts = P.curvePts([b0, add(b0, [0.03 * s + 0.02, -0.12]), add(b0, [0.08 * s + 0.06, -0.24])], 5);
          parts.push(part(P.ribbon(beamPts, t => 0.016 * (1 - t) + 0.007), 'arms'));
          for (const t of [0.35, 0.7]) { const q = beamPts[Math.round(t * (beamPts.length - 1))]; parts.push(part(P.capsule(q, 0.01, [q[0] - 0.055, q[1] - 0.035], 0.003, 3), 'arms')); }
        }
      } else if (S.head === 'bull') {
        for (const s of [1, -1]) {
          const b0 = H2(-0.03, 0.04 + 0.01 * s);
          parts.push(part(P.ribbon(P.curvePts([b0, add(b0, [0.03 * s, -0.06]), add(b0, [0.08 * s + 0.02, -0.1])], 5), t => 0.018 * (1 - t) + 0.004), 'arms'));
        }
      } else if (S.head === 'unicorn') {
        parts.push(part(P.ribbon([H2(0.0, 0.06), H2(0.12, 0.17)], t => 0.012 * (1 - t) + 0.002), 'arms'));
        parts.push(part(P.poly([H2(0.1, -0.035), H2(0.075, -0.1), H2(0.05, -0.04)])));
        parts.push(part(P.poly([H2(-0.03, 0.05), H2(-0.01, 0.11), H2(0.025, 0.055)])));
      } else if (S.head === 'goat') {
        const b0 = H2(-0.02, 0.05);
        parts.push(part(P.ribbon(P.curvePts([b0, add(b0, [0.05, -0.09]), add(b0, [0.14, -0.07]), add(b0, [0.17, -0.02])], 5), t => 0.02 * (1 - t) + 0.005), 'arms'));
        parts.push(part(P.poly([H2(0.1, -0.035), H2(0.075, -0.11), H2(0.05, -0.04)])));
      } else {
        parts.push(part(P.poly([H2(-0.03, 0.05), H2(-0.01, 0.11), H2(0.025, 0.055)])));
      }
    }
    // mane
    if (S.mane === 'lion') {
      // locks rooted along the crown of the head and the neck, blowing back toward the tail,
      // each curling at its end; two rows so the neck is covered
      const inner = add(mul(hc, 0.55), mul(J.sh, 0.45));
      const roots = P.curvePts([H2(0.01, 0.07), H2(-0.05, 0.06), H2(-0.08, 0.0), add(J.neck, mul(n, 0.06)), add(J.sh, add(mul(n, 0.1), mul(u, -0.02))), add(J.sh, add(mul(n, 0.04), mul(u, 0.06)))], 3);
      roots.forEach((b, i) => {
        if (i % 1) return;
        const out = unit(sub(b, inner));
        const dir = unit(add(mul(out, 0.75), mul(u, 0.65)));
        const len = 0.085 + 0.035 * Math.sin(Math.PI * i / (roots.length - 1)) + (i % 2 ? 0.0 : 0.015);
        const side = [-dir[1], dir[0]];
        const tip = add(b, mul(dir, len)), curl = add(tip, add(mul(side, 0.03), mul(dir, -0.012)));
        parts.push(part(P.ribbon(P.curvePts([add(b, mul(dir, -0.03)), add(b, mul(dir, len * 0.5)), tip, curl], 4), t2 => 0.034 * (1 - t2) + 0.003)));
      });
      // the beard under the jaw
      for (const da of [0, 0.045, 0.09]) parts.push(part(P.ribbon(P.curvePts([H2(-0.005 - da, -0.05), H2(-0.03 - da, -0.1), H2(-0.07 - da, -0.115)], 4), t2 => 0.022 * (1 - t2) + 0.002)));
      details.push(curve([add(J.sh, mul(n, -0.02)), add(J.sh, add(mul(u, 0.1), mul(n, -0.06))), add(J.sh, add(mul(u, 0.18), mul(n, -0.12)))], 0.6));
    } else if (S.mane === 'horse') {
      for (let i = 0; i < 6; i++) { const t = i / 5; const base = add(add(mul(hc, 1 - t), mul(J.sh, t)), mul(n, 0.05)); parts.push(part(P.capsule(base, 0.022, add(base, add(mul(n, 0.04), mul(u, 0.05))), 0.004, 3))); }
    }
    if (S.crest) {
      for (let i = 0; i < 9; i++) { const t = i / 8; const b = add(add(mul(J.sh, 1 - t), mul(J.hip, t)), mul(n, (0.27 - 0.06 * Math.abs(t - 0.4)) * L * k)); const tip = add(b, add(mul(n, 0.05), mul(u, 0.02))); parts.push(part(P.poly([add(b, mul(u, -0.025)), tip, add(b, mul(u, 0.025))]))); }
    }
    if (S.wing) {
      // a griffin's wing rises from the shoulder behind the head
      const base = add(J.sh, mul(n, 0.06));
      const dir = n[0] >= 0 ? 1 : -1;
      parts.push(...wing(base, dir, 0.36, 7, true));
    }
    // near limbs in front
    limb(J.hind.near, false, false); limb(J.fore.near, true, false);
    if (o.crowned) {
      const c = H2(-0.01, 0.085);
      parts.push(part(P.poly([[c[0] - 0.05, c[1] + 0.03], [c[0] - 0.055, c[1] - 0.045], [c[0] - 0.025, c[1] - 0.005], [c[0], c[1] - 0.055], [c[0] + 0.025, c[1] - 0.005], [c[0] + 0.055, c[1] - 0.045], [c[0] + 0.05, c[1] + 0.03]]), 'crown'));
    }
    if (o.collared) {
      const a = add(J.neck, mul(n, 0.07)), b = add(J.neck, mul(n, -0.08));
      parts.push(part(P.ribbon([a, b], 0.018), 'crown'));
    }
    // a little modelling: the line of the haunch
    details.push(curve([T(J.hip, -0.05, 0.15), T(J.hip, 0.05, 0.02), T(J.hip, 0.0, -0.15)], 0.6));
    return { parts, details };
  }
  for (const sp of Object.keys(SPECIES)) for (const at of Object.keys(POSES)) C[`${sp} ${at}`] = (o) => beast(sp, at, o);
  C["boar's head"] = () => {
    const hc = [0.55, 0.5];
    const parts = [part(P.capsule([0.62, 0.5], 0.28, [0.22, 0.56], 0.13, 10)), part(P.poly([[0.86, 0.22], [0.98, 0.5], [0.86, 0.82], [0.7, 0.86], [0.66, 0.2]])),
      part(P.poly([[0.62, 0.26], [0.72, 0.02], [0.78, 0.28]])), part(P.poly([[0.2, 0.62], [0.32, 0.36], [0.3, 0.64]]), 'arms')];
    const details = [dot(0.48, 0.42, 0.025), line([[0.08, 0.56], [0.22, 0.6]], 0.8)];
    for (let i = 0; i < 5; i++) { const x = 0.42 + i * 0.08; details.push(line([[x, 0.28 + i * 0.01], [x + 0.03, 0.2 + i * 0.015]], 0.6)); }
    void hc;
    return { parts, details };
  };
  C["lion's head"] = () => {
    const parts = [part(P.circle(0.5, 0.42, 0.24)), part(P.capsule([0.5, 0.42], 0.18, [0.24, 0.52], 0.12, 8)),
      part(P.capsule([0.42, 0.64], 0.08, [0.24, 0.66], 0.05, 6)), part(P.ribbon(P.curvePts([[0.26, 0.6], [0.12, 0.64], [0.06, 0.58]], 5), 0.025), 'tongue')];
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.6 + i * Math.PI * 1.1 / 8; const b = [0.56 + 0.24 * Math.cos(a), 0.46 + 0.3 * Math.sin(a)]; parts.push(part(P.capsule(b, 0.09, [b[0] + 0.2 * Math.cos(a + 0.4), b[1] + 0.2 * Math.sin(a + 0.4)], 0.01, 4))); }
    parts.push(part(P.poly([[0.46, 0.2], [0.52, 0.04], [0.6, 0.22]])));
    return { parts, details: [dot(0.38, 0.38, 0.025)] };
  };

  // ---------- more charges, added for the corpus' commonest gaps (STUDY.md 4.3) ----------
  C.sun = () => {
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 16; const r = i % 2 ? 0.27 : (i % 4 === 0 ? 0.5 : 0.42);
      pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
    }
    return { parts: [part(P.poly(pts)), part(P.circle(0.5, 0.5, 0.27))], details: [{ path: P.circle(0.5, 0.5, 0.25), fill: false, w: 0.8 }] };
  };
  C.gonfanon = () => {
    // a church banner: a cloth with three tails hanging from a bar with rings
    const cloth = [[0.08, 0.14], [0.92, 0.14], [0.92, 0.7], [0.84, 0.98], [0.72, 0.7], [0.58, 0.98], [0.5, 0.7], [0.42, 0.98], [0.28, 0.7], [0.16, 0.98], [0.08, 0.7]];
    const parts = [part(P.poly(cloth))];
    for (const x of [0.2, 0.5, 0.8]) parts.push(part(P.concat(P.circle(x, 0.08, 0.06), P.circle(x, 0.08, 0.03))));
    return { parts, details: [line([[0.08, 0.68], [0.92, 0.68]], 0.7)] };
  };
  C['mill-rind'] = () => ({
    parts: [part([['M', 0.36, 0.38], ['C', 0.2, 0.1, 0.02, 0.18, 0.04, 0.42], ['C', 0.14, 0.32, 0.22, 0.4, 0.26, 0.5], ['C', 0.22, 0.6, 0.14, 0.68, 0.04, 0.58], ['C', 0.02, 0.82, 0.2, 0.9, 0.36, 0.62], ['L', 0.64, 0.62],
      ['C', 0.8, 0.9, 0.98, 0.82, 0.96, 0.58], ['C', 0.86, 0.68, 0.78, 0.6, 0.74, 0.5], ['C', 0.78, 0.4, 0.86, 0.32, 0.96, 0.42], ['C', 0.98, 0.18, 0.8, 0.1, 0.64, 0.38], ['Z']]),
      part(P.concat(P.poly([[0.38, 0.32], [0.62, 0.32], [0.62, 0.68], [0.38, 0.68]]), P.poly([[0.45, 0.44], [0.55, 0.44], [0.55, 0.56], [0.45, 0.56]])))],
  });
  C.leaf = () => {
    // a linden leaf, stalk down
    const blade = [['M', 0.5, 0.02], ['C', 0.72, 0.16, 0.98, 0.3, 0.9, 0.56], ['C', 0.84, 0.72, 0.64, 0.74, 0.5, 0.68], ['C', 0.36, 0.74, 0.16, 0.72, 0.1, 0.56], ['C', 0.02, 0.3, 0.28, 0.16, 0.5, 0.02], ['Z']];
    const parts = [part(blade), part(P.ribbon(P.curvePts([[0.5, 0.64], [0.52, 0.82], [0.58, 0.98]], 4), 0.03))];
    const details = [line([[0.5, 0.1], [0.5, 0.66]], 0.7)];
    for (const [y, dx] of [[0.26, 0.2], [0.4, 0.26], [0.54, 0.24]]) { details.push(line([[0.5, y + 0.06], [0.5 - dx, y - 0.02]], 0.5)); details.push(line([[0.5, y + 0.06], [0.5 + dx, y - 0.02]], 0.5)); }
    return { parts, details };
  };
  C.anchor = () => ({
    parts: [part(P.concat(P.circle(0.5, 0.08, 0.07), P.circle(0.5, 0.08, 0.035))), part(P.poly([[0.46, 0.14], [0.54, 0.14], [0.54, 0.86], [0.46, 0.86]])), part(P.poly([[0.3, 0.24], [0.7, 0.24], [0.7, 0.3], [0.3, 0.3]])),
      part(P.ribbon(P.curvePts([[0.12, 0.6], [0.2, 0.84], [0.5, 0.94], [0.8, 0.84], [0.88, 0.6]], 8), 0.035)), part(P.poly([[0.06, 0.66], [0.12, 0.52], [0.2, 0.64]])), part(P.poly([[0.94, 0.66], [0.88, 0.52], [0.8, 0.64]]))],
  });
  C.mallet = () => ({ parts: [part(P.poly([[0.14, 0.06], [0.86, 0.06], [0.86, 0.36], [0.14, 0.36]])), part(P.poly([[0.45, 0.36], [0.55, 0.36], [0.55, 0.98], [0.45, 0.98]]))] });
  C.spearhead = () => ({
    parts: [part([['M', 0.5, 0.0], ['C', 0.68, 0.24, 0.72, 0.5, 0.58, 0.7], ['L', 0.58, 0.98], ['L', 0.42, 0.98], ['L', 0.42, 0.7], ['C', 0.28, 0.5, 0.32, 0.24, 0.5, 0.0], ['Z']])],
    details: [line([[0.5, 0.06], [0.5, 0.66]], 0.6), line([[0.42, 0.78], [0.58, 0.78]], 0.6)],
  });
  C["bull's head"] = () => {
    // caboshed: the face seen from the front, with horns
    const face = P.smooth([[0.5, 0.26], [0.66, 0.3], [0.68, 0.5], [0.62, 0.76], [0.6, 0.94], [0.5, 0.98], [0.4, 0.94], [0.38, 0.76], [0.32, 0.5], [0.34, 0.3]]);
    const parts = [part(face)];
    for (const s of [-1, 1]) {
      parts.push(part(P.ribbon(P.curvePts([[0.5 + s * 0.12, 0.3], [0.5 + s * 0.3, 0.26], [0.5 + s * 0.4, 0.12], [0.5 + s * 0.36, 0.0]], 6), t => 0.045 * (1 - t) + 0.006), 'arms'));
      parts.push(part(P.ellipse(0.5 + s * 0.22, 0.38, 0.1, 0.05, s * 0.4)));
    }
    const details = [dot(0.42, 0.5, 0.022), dot(0.58, 0.5, 0.022), dot(0.46, 0.88, 0.016), dot(0.54, 0.88, 0.016), curve([[0.42, 0.8], [0.5, 0.78], [0.58, 0.8]], 0.6)];
    return { parts, details };
  };
  C['saltire couped'] = () => ({
    parts: [part(P.poly([[0.06, 0.18], [0.18, 0.06], [0.94, 0.82], [0.82, 0.94]])), part(P.poly([[0.82, 0.06], [0.94, 0.18], [0.18, 0.94], [0.06, 0.82]]))],
  });
  C['cross potenty'] = () => {
    const w = 0.1, parts = [];
    const r = (x0, y0, x1, y1) => parts.push(part(P.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])));
    r(0.5 - w, 0.06, 0.5 + w, 0.94); r(0.06, 0.5 - w, 0.94, 0.5 + w);
    r(0.28, 0.0, 0.72, 0.13); r(0.28, 0.87, 0.72, 1.0); r(0.0, 0.28, 0.13, 0.72); r(0.87, 0.28, 1.0, 0.72);
    return { parts };
  };
  C['cross moline'] = () => {
    const parts = [part(P.poly([[0.42, 0.24], [0.58, 0.24], [0.58, 0.76], [0.42, 0.76]])), part(P.poly([[0.24, 0.42], [0.76, 0.42], [0.76, 0.58], [0.24, 0.58]]))];
    for (let k = 0; k < 4; k++) {
      const m = P.mat.mul(P.mat.tr(0.5, 0.5), P.mat.mul(P.mat.rot(k * Math.PI / 2), P.mat.tr(-0.5, -0.5)));
      const arm = [['M', 0.42, 0.26], ['C', 0.42, 0.14, 0.32, 0.06, 0.2, 0.08], ['C', 0.28, 0.12, 0.34, 0.2, 0.36, 0.3], ['L', 0.64, 0.3], ['C', 0.66, 0.2, 0.72, 0.12, 0.8, 0.08], ['C', 0.68, 0.06, 0.58, 0.14, 0.58, 0.26], ['Z']];
      parts.push(part(P.map(arm, m)));
    }
    return { parts };
  };

  // ---------- registry: blazon nouns, plurals, classes ----------
  const REG = {
    roundel: ['roundels', 'geometric'], annulet: ['annulets', 'geometric'], lozenge: ['lozenges', 'geometric'], fusil: ['fusils', 'geometric'], mascle: ['mascles', 'geometric'],
    billet: ['billets', 'geometric'], mullet: ['mullets', 'star'], 'mullet of six points': ['mullets of six points', 'star'], estoile: ['estoiles', 'star'], crescent: ['crescents', 'star'],
    heart: ['hearts', 'object'], cross: ['crosses couped', 'cross'], 'cross crosslet': ['crosses crosslet', 'cross'], 'cross patty': ['crosses patty', 'cross'],
    'fleur-de-lis': ['fleurs-de-lis', 'flower'], rose: ['roses', 'flower'], cinquefoil: ['cinquefoils', 'flower'], trefoil: ['trefoils', 'flower'], escallop: ['escallops', 'object'],
    escutcheon: ['escutcheons', 'geometric'], trimount: ['trimounts', 'object'], tower: ['towers', 'object'], castle: ['castles', 'object'], key: ['keys', 'object'], crown: ['crowns', 'object'],
    wheel: ['wheels', 'object'], horseshoe: ['horseshoes', 'object'], 'bugle horn': ['bugle horns', 'antler_horn'], sword: ['swords', 'object'], arrow: ['arrows', 'object'], axe: ['axes', 'object'],
    buckle: ['buckles', 'object'], 'chess rook': ['chess rooks', 'object'], tree: ['trees', 'plant'], antler: ["stag's attires", 'antler_horn'], wing: ['wings', 'bird'],
    eagle: ['eagles', 'eagle'], martlet: ['martlets', 'bird'], fish: ['barbels', 'fish'], "boar's head": ["boars' heads", 'beast'], "lion's head": ["lions' heads", 'lion'],
  };
  Object.assign(REG, {
    sun: ['suns', 'star'], gonfanon: ['gonfanons', 'object'], 'mill-rind': ['mill-rinds', 'object'], leaf: ['leaves', 'plant'], anchor: ['anchors', 'object'], mallet: ['mallets', 'object'],
    spearhead: ['spearheads', 'object'], "bull's head": ["bulls' heads", 'beast'], 'saltire couped': ['saltires couped', 'cross'], 'cross potenty': ['crosses potenty', 'cross'], 'cross moline': ['crosses moline', 'cross'],
  });
  for (const sp of Object.keys(SPECIES)) for (const at of Object.keys(POSES)) {
    const plural = { lion: 'lions', bear: 'bears', boar: 'boars', wolf: 'wolves', talbot: 'talbots', stag: 'stags', horse: 'horses', goat: 'goats', bull: 'bulls', unicorn: 'unicorns', griffin: 'griffins' }[sp];
    REG[`${sp} ${at}`] = [`${plural} ${at}`, sp === 'lion' ? 'lion' : 'beast'];
  }
  // charges that only the imported art draws (charges-art.js); the drawn fallback is the nearest drawn charge
  C.swan = (o) => C.martlet(o);
  C.dolphin = (o) => C.fish(Object.assign({ embowed: true }, o));
  Object.assign(REG, { swan: ['swans', 'bird'], dolphin: ['dolphins', 'fish'] });
  // the heraldic words for what the drawings show
  const SING = {
    'stag passant': 'stag trippant', 'griffin rampant': 'griffin segreant', "lion's head": "lion's head erased", "boar's head": "boar's head erased",
    "bull's head": "bull's head caboshed", tree: 'oak tree fructed and eradicated', fish: 'barbel naiant', dolphin: 'dolphin embowed',
    swan: 'swan rousant',
  };
  const PLUR = {
    'stag passant': 'stags trippant', 'griffin rampant': 'griffins segreant', "lion's head": "lions' heads erased", "boar's head": "boars' heads erased",
    "bull's head": "bulls' heads caboshed", tree: 'oak trees fructed and eradicated', fish: 'barbels naiant', dolphin: 'dolphins embowed',
    swan: 'swans rousant',
  };
  H.CHARGES = C;
  H.CHARGE_INFO = Object.fromEntries(Object.entries(REG).map(([k, v]) => [k, { plural: PLUR[k] || v[0], cls: v[1], sing: SING[k] || k }]));
})(typeof self !== 'undefined' ? self : globalThis);
