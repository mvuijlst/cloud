/* A seal as it would look scanned from a printed book.

   Every number comes from data/print_texture.json (tools/print_texture.py),
   measured on two leaves of the 1916 De Laurence printing of the Goetia
   scanned at 500 ppi, copied into SIGIL_DATA.scan by tools/build_web_data.py:
   paper colour and grain at three scales, the light falling off across a page,
   ink colour (it varies with the inking of each page) and mottle, the blur of
   an inked edge, dust specks, and how far the scan is skewed. The same
   measurement says what not to add: printed edges are smooth (0.16 px at the
   finest scale) and the drawn lines of the 1904 plates are straight and even
   (bending 0.0005 of the height, width varying 4%), so there is no wobble or
   raggedness here.

   The result is an RGBA image at 500 ppi with the seal 18 mm tall, about the
   size of the figures on the 1904 plates. Pure JavaScript: it runs in the
   page and under Node, which is how its output is checked against the same
   measurement (GENERATOR.md). */
(function (root) {
  'use strict';

  const SS = 3;   // supersampling of the ink coverage
  // edge softness of the renderer before any blur, in px at 500 ppi: with the
  // pages' 1.236 px applied, tools/scan_check.py read 1.52-1.53 px on six
  // scans, so the renderer itself contributes sqrt(1.525^2 - 1.236^2)
  const EDGE_SELF = 0.89;

  function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.random());
  }

  // separable Gaussian blur of a W x H float image, edges clamped
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
        for (let i = -r; i <= r; i++) a += k[i + r] * src[row + Math.min(W - 1, Math.max(0, x + i))];
        tmp[row + x] = a;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) a += k[i + r] * tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x];
        out[y * W + x] = a;
      }
    }
    return out;
  }

  // band-limited noise: white noise blurred by sigma, scaled to unit standard deviation
  function noise(W, H, sigma, rng) {
    const n = new Float32Array(W * H);
    for (let i = 0; i < n.length; i++) n[i] = gaussian(rng);
    const b = blur(n, W, H, sigma);
    let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    const sd = Math.sqrt(s / b.length) || 1;
    for (let i = 0; i < b.length; i++) b[i] /= sd;
    return b;
  }

  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  function renderScan(enc, seed, opts = {}) {
    const S = root.Sigils, P = root.SIGIL_DATA.scan;
    const rng = S.makeRng((seed ^ 0x5CA77ED) >>> 0);
    const sealPx = (opts.sealMM || 18) / 25.4 * P.ppi;
    const m = 0.3 * sealPx;                                   // paper round the figure
    const W = Math.round(enc.aspect * sealPx + 2 * m), H = Math.round(sealPx + 2 * m);

    // ink coverage at SS x, drawn width (encodings store the measured width)
    const Ws = W * SS, Hs = H * SS, k = S.STROKE_K;
    const members = S.expand(enc.members).map(x => (x.w === undefined ? x : Object.assign({}, x, { w: x.w * k })));
    const hi = new Uint8Array(Ws * Hs);
    for (const i of S.rasterize(members, Ws, Hs, sealPx * SS, m * SS, enc.stroke * k, true)) hi[i] = 1;

    // resample to 500 ppi with the scan's skew and a slight offset
    const theta = (rng.random() * 2 - 1) * P.skew_deg * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
    const ox = (rng.random() * 2 - 1) * 0.03 * sealPx, oy = (rng.random() * 2 - 1) * 0.03 * sealPx;
    const A = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let j = 0; j < SS; j++) {
          for (let i = 0; i < SS; i++) {
            const px = x + (i + 0.5) / SS - W / 2, py = y + (j + 0.5) / SS - H / 2;
            const qx = (c * px + s * py + W / 2 - ox) * SS, qy = (-s * px + c * py + H / 2 - oy) * SS;
            const xi = Math.floor(qx), yi = Math.floor(qy);
            if (xi >= 0 && xi < Ws && yi >= 0 && yi < Hs) a += hi[yi * Ws + xi];
          }
        }
        A[y * W + x] = a / (SS * SS);
      }
    }

    // dust: specks per square centimetre of the measured size
    const cm2 = W * H / (P.ppi / 2.54) ** 2;
    let specks = 0;
    for (let L = Math.exp(-P.specks_per_cm2 * cm2), p = rng.random(); p > L; p *= rng.random()) specks++;   // Poisson
    for (let n = 0; n < specks; n++) {
      const cx = rng.random() * W, cy = rng.random() * H;
      const r = Math.sqrt(P.speck_area / Math.PI) * (0.7 + 0.7 * rng.random()), d = 0.5 + 0.5 * rng.random();
      for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r + 1)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x++) {
          const v = d * Math.min(1, Math.max(0, r + 0.5 - Math.hypot(x - cx, y - cy)));
          A[y * W + x] = Math.max(A[y * W + x], v);
        }
      }
    }

    // inked edges as scanned: a Gaussian-blurred step. Supersampling and the
    // skewed resampling already soften an edge by EDGE_SELF, so the blur added
    // is what makes the same measurement read the pages' sigma (scan_check.json)
    const ink = blur(A, W, H, Math.sqrt(Math.max(0.09, P.edge_sigma ** 2 - EDGE_SELF ** 2)));

    // paper and ink of this page; ink colour varies with each page's inking
    const paper = lerp(P.paper_rgb[0], P.paper_rgb[1], rng.random());
    const inkRgb = lerp(P.ink_rgb[0], P.ink_rgb[1], rng.random());
    const g1 = noise(W, H, 0.7, rng), g2 = noise(W, H, 4, rng), g3 = noise(W, H, 16, rng);
    const m1 = noise(W, H, 0.6, rng), m2 = noise(W, H, 1.6, rng);
    // mottle as measured deep inside strokes (nearer the edge it is the edge blur):
    // a fine part and the rest at 1-3 px, adding up to the total
    const ma = P.mottle_fine, mb = Math.sqrt(Math.max(0, P.mottle_total ** 2 - ma * ma));
    // light falling off across the page, at the page's gradient
    const phi = rng.random() * 2 * Math.PI, slope = P.light_range / P.page_height_px * (0.5 + rng.random());
    const lx = Math.cos(phi) * slope, ly = Math.sin(phi) * slope;

    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, a = Math.min(1, ink[i]);
        const pg = P.grain.fine * g1[i] + P.grain.mid * g2[i] + P.grain.coarse * g3[i] + lx * (x - W / 2) + ly * (y - H / 2);
        const ig = ma * m1[i] + mb * m2[i];
        for (let ch = 0; ch < 3; ch++) data[4 * i + ch] = (paper[ch] + pg) * (1 - a) + (inkRgb[ch] + ig) * a;
        data[4 * i + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  root.Sigils.renderScan = renderScan;
  if (typeof module !== 'undefined' && module.exports) module.exports = renderScan;
})(typeof globalThis !== 'undefined' ? globalThis : this);
