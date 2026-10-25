/* A seal as it stands on the 1904 plates: in a double ring with a name
   lettered round it, printed in solid ink, white on black here.

   The measurements come from good scans of the plates (tools/plate_ink.py,
   data/plate_ink.json, copied into SIGIL_DATA.plate), all as fractions of the
   outer ring's radius R: the three rings' radii and line widths, how much a
   line's width swells and thins along it and over what length, how far a line
   wanders from its course, how ragged an edge is, how far the plates are out of
   round, how far the figure reaches toward the inner ring, the letters' height
   and position. Lettering: capitals spaced evenly round the band from the top,
   each with its foot toward the centre, as on the plates.

   Ink: the ideal drawing, drawn at 2x and averaged down, is resampled through a
   slow displacement field (the wander). Each pixel's signed distance to the ink
   edge is then shifted by a field correlated over the measured length (half the
   width swelling on each side of a line) plus a fine one (the raggedness), and
   the ink is wherever the shifted distance is positive, anti-aliased over one
   pixel: solid ink, crisp edges, and narrow gaps such as the one between the
   two outer rings stay open. tools/plate_ink.py measures rendered plates to
   check the result (GENERATOR.md).

   Pure JavaScript except the lettering, which needs a canvas (page only). */
(function (root) {
  'use strict';

  const STROKE_REF = 0.031;   // median stroke of the hand encodings (encodings/)
  // Calibration: the two edge fields and the pixel grid each add to both the
  // measured width variation and the raggedness, so the fields are scaled until
  // tools/plate_ink.py reads the plates' values on rendered plates (R = 290 px).
  // tools/plate_check.py, six seeds: width CV 0.141 (plates 0.140), raggedness
  // 0.00179 R (0.00173), wander 0.00247 R (0.00254), line width 0.0242 R
  // (0.0239). With both edge fields off it reads 0.020 and 0.00034.
  const CAL = { figStroke: 0.029, width: 0.75, rag: 0.4, wobble: 1.15 };

  function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.random());
  }

  function blur(src, W, H, sigma) {
    const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += (k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2));
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) { const xx = x + i; a += k[i + r] * src[row + (xx < 0 ? 0 : xx >= W ? W - 1 : xx)]; }
        tmp[row + x] = a;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) { const yy = y + i; a += k[i + r] * tmp[(yy < 0 ? 0 : yy >= H ? H - 1 : yy) * W + x]; }
        out[y * W + x] = a;
      }
    }
    return out;
  }

  // noise with unit standard deviation, correlated over sigma px; large sigmas
  // are made on a coarse grid and interpolated
  function noise(W, H, sigma, rng) {
    const step = sigma > 6 ? Math.floor(sigma / 3) : 1;
    const w = Math.ceil(W / step) + 2, h = Math.ceil(H / step) + 2;
    const n = new Float32Array(w * h);
    for (let i = 0; i < n.length; i++) n[i] = gaussian(rng);
    const b = blur(n, w, h, sigma / step);
    let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    const sd = Math.sqrt(s / b.length) || 1;
    if (step === 1 && w === W) { for (let i = 0; i < b.length; i++) b[i] /= sd; return b; }
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const fy = y / step, y0 = Math.floor(fy), ty = fy - y0;
      for (let x = 0; x < W; x++) {
        const fx = x / step, x0 = Math.floor(fx), tx = fx - x0, i = y0 * w + x0;
        out[y * W + x] = ((b[i] * (1 - tx) + b[i + 1] * tx) * (1 - ty) + (b[i + w] * (1 - tx) + b[i + w + 1] * tx) * ty) / sd;
      }
    }
    return out;
  }

  // the letters as coverage, drawn with the browser's serif capitals
  function lettering(W, H, letters, capPx) {
    let cnv = null;
    if (typeof OffscreenCanvas !== 'undefined') cnv = new OffscreenCanvas(W, H);
    else if (typeof document !== 'undefined') { cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H; }
    if (!cnv) return null;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${(capPx / 0.66).toFixed(1)}px "Times New Roman", Times, "Liberation Serif", Georgia, serif`;
    for (const L of letters) {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.angle + Math.PI / 2);   // foot toward the centre
      ctx.fillText(L.ch, 0, capPx / 2);
      ctx.restore();
    }
    const d = ctx.getImageData(0, 0, W, H).data, out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = d[4 * i + 3] / 255;
    return out;
  }

  function renderPlate(enc, name, seed, opts = {}) {
    const S = root.Sigils, P = root.SIGIL_DATA.plate;
    const rng = S.makeRng((seed ^ 0x9A7E1904) >>> 0);
    const R = opts.R || P.R_px;
    const W = Math.ceil(2.14 * R), H = W, c = W / 2;

    // the figure: centred, scaled so its ink reaches toward the inner ring as on the plates
    const k0 = 300, probe = S.rasterize(S.expand(enc.members), Math.ceil(enc.aspect * k0) + 40, k0 + 40, k0, 20, enc.stroke * S.STROKE_K, true);
    const pw = Math.ceil(enc.aspect * k0) + 40;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const i of probe) { const x = i % pw, y = (i - x) / pw; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bx = ((x0 + x1) / 2 - 20) / k0, by = ((y0 + y1) / 2 - 20) / k0;
    let reach = 0;
    for (const i of probe) { const x = i % pw, y = (i - x) / pw; reach = Math.max(reach, Math.hypot((x - 20) / k0 - bx, (y - 20) / k0 - by)); }
    const k = (P.figure_reach - 0.02) * R / reach;                       // px per seal unit
    const strokePx = CAL.figStroke * R * (enc.stroke / STROKE_REF);
    const wScale = strokePx / k / enc.stroke;
    const figure = S.expand(enc.members).map(m => S.translate(m.w === undefined ? m : Object.assign({}, m, { w: m.w * wScale }), -bx, -by));
    // the frame: two close rings outside, one inside the lettering
    const rings = P.rings.map(r => ({ t: 'ring', c: [0, 0], r: r.radius, w: r.width }));
    // both drawn at 2x and averaged down, so edges fall between pixels
    const W2 = 2 * W, hi = new Uint8Array(W2 * W2);
    for (const i of S.rasterize(figure, W2, W2, 2 * k, 2 * c, enc.stroke * wScale, true)) hi[i] = 1;
    for (const i of S.rasterize(rings, W2, W2, 2 * R, 2 * c, 0.02, true)) hi[i] = 1;
    const A = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = 2 * y * W2 + 2 * x;
        A[y * W + x] = (hi[j] + hi[j + 1] + hi[j + W2] + hi[j + W2 + 1]) / 4;
      }
    }

    // the name, evenly round the band from the top, clockwise
    const letters = [...name].map((ch, i) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * i / name.length;
      return { ch, angle, x: c + P.letter_radius * R * Math.cos(angle), y: c + P.letter_radius * R * Math.sin(angle) };
    });
    const text = opts.letters === false ? null : lettering(W, H, letters, P.letter_height * R);
    if (text) for (let i = 0; i < W * H; i++) A[i] = Math.max(A[i], text[i]);

    // a few specks of ink
    const nSpecks = Math.floor(rng.random() * 6);
    for (let n = 0; n < nSpecks; n++) {
      const a = rng.random() * 2 * Math.PI, rr = Math.sqrt(rng.random()) * 1.03 * R, r = (0.003 + 0.004 * rng.random()) * R;
      const sx = c + rr * Math.cos(a), sy = c + rr * Math.sin(a);
      for (let y = Math.max(0, Math.floor(sy - r)); y <= Math.min(H - 1, Math.ceil(sy + r)); y++) {
        for (let x = Math.max(0, Math.floor(sx - r)); x <= Math.min(W - 1, Math.ceil(sx + r)); x++) {
          if (Math.hypot(x - sx, y - sy) <= r) A[y * W + x] = 1;
        }
      }
    }

    // resample: out of round by the plates' ellipticity, and the slow wander of the lines
    const e = 2 * P.ellipticity * rng.random(), ea = rng.random() * Math.PI, ca = Math.cos(ea), sa = Math.sin(ea);
    const dCorr = P.wobble_corr * R / 2, dAmp = P.wobble_rms * R * CAL.wobble;
    const dx = noise(W, H, dCorr, rng), dy = noise(W, H, dCorr, rng);
    const Aw = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let u = x - c, v = y - c;
        const p = u * ca + v * sa, q = -u * sa + v * ca;                 // into the ellipse's axes
        const p2 = p / (1 + e / 2), q2 = q / (1 - e / 2);
        const sx = c + p2 * ca - q2 * sa + dAmp * dx[i], sy = c + p2 * sa + q2 * ca + dAmp * dy[i];
        const xi = Math.floor(sx), yi = Math.floor(sy), tx = sx - xi, ty = sy - yi;
        if (xi < 0 || yi < 0 || xi >= W - 1 || yi >= H - 1) continue;
        const j = yi * W + xi;
        Aw[i] = (A[j] * (1 - tx) + A[j + 1] * tx) * (1 - ty) + (A[j + W] * (1 - tx) + A[j + W + 1] * tx) * ty;
      }
    }

    // solid ink: signed distance to the edge (px, positive in the ink), the edge
    // shifted by the measured swelling and raggedness, one-pixel anti-aliasing
    const inside = new Uint8Array(W * H), outside = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { inside[i] = Aw[i] >= 0.5 ? 1 : 0; outside[i] = 1 - inside[i]; }
    const din = S.distanceTransform(inside, W, H), dout = S.distanceTransform(outside, W, H);
    const wRef = P.rings[1].width * R;                                    // a typical line width, px
    const nw = noise(W, H, Math.max(0.7, P.width_corr * R / 2), rng), nf = noise(W, H, 0.7, rng);
    const sw = CAL.width * P.width_cv * wRef / 2, sf = CAL.rag * P.edge_rag * R;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      // at the edge the coverage itself gives the sub-pixel distance
      const a0 = Aw[i];
      const sd = a0 > 0.02 && a0 < 0.98 ? a0 - 0.5 : inside[i] ? din[i] - 0.5 : 0.5 - dout[i];
      const a = Math.min(1, Math.max(0, sd + sw * nw[i] + sf * nf[i] + 0.5));
      const v = 255 * a;
      data[4 * i] = v; data[4 * i + 1] = v; data[4 * i + 2] = v; data[4 * i + 3] = 255;
    }
    return { width: W, height: H, data, name };
  }

  root.Sigils.renderPlate = renderPlate;
  root.Sigils.PLATE_CAL = CAL;
  if (typeof module !== 'undefined' && module.exports) module.exports = renderPlate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
