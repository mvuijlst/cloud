// Wavy filled layers — plain Canvas 2D, no p5.js dependency.
// Smooth curves via Catmull-Rom → cubic Bézier conversion.
// Multi-layer stacked shadow to simulate soft blur.

let canvas, ctx;
let edge, basePts, extraPts, palette, lastNumLines;

// ---------- params ----------
function getParams() {
  const v = id => parseFloat(document.getElementById(id).value);
  const n        = v('numPoints') | 0;
  const baseDist = v('baseDist')  | 0;
  const amplitude = v('amplitude');
  const extraAmp  = v('extraAmp');
  const speedMult = v('speedMult');
  const shadow    = v('thickness');
  const numLines  = v('numLines') | 0;
  const spacing   = v('spacing');
  const spacingFalloff = v('spacingFalloff');
  return {
    n, baseDist,
    amplitude: Math.min(amplitude, baseDist - 1),
    extraAmp, speedMult, shadow,
    numLines, spacing, spacingFalloff
  };
}

// ---------- control points ----------
function makePts(n) {
  return Array.from({ length: n }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 0.0006 + Math.random() * 0.0014
  }));
}

function resizePts(arr, n) {
  while (arr.length < n)
    arr.push({ angle: Math.random() * Math.PI * 2, speed: 0.0006 + Math.random() * 0.0014 });
  arr.length = n;
}

// ---------- palette ----------
function lerpN(a, b, t) { return a + (b - a) * t; }

function hsbToHex(h, s, b) {
  s /= 100; b /= 100;
  const c = b * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = b - c;
  let r, g, bv;
  if      (h < 60)  { r=c; g=x; bv=0; }
  else if (h < 120) { r=x; g=c; bv=0; }
  else if (h < 180) { r=0; g=c; bv=x; }
  else if (h < 240) { r=0; g=x; bv=c; }
  else if (h < 300) { r=x; g=0; bv=c; }
  else              { r=c; g=0; bv=x; }
  const to2 = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(bv)}`;
}

function generatePalette(numBands) {
  const h       = Math.random() * 360;
  const variant = Math.floor(Math.random() * 3);
  const h2      = variant === 2 ? (h + 25 + Math.random() * 30) % 360 : h;
  return Array.from({ length: numBands }, (_, i) => {
    const t = numBands > 1 ? i / (numBands - 1) : 0.5;
    if      (variant === 0) return hsbToHex(h,               lerpN(20, 88, t), lerpN(92, 28, t));
    else if (variant === 1) return hsbToHex(h,               lerpN(88, 20, t), lerpN(28, 92, t));
    else                    return hsbToHex(lerpN(h, h2, t), lerpN(55, 90, t), lerpN(90, 28, t));
  });
}

// ---------- smooth path via Catmull-Rom → cubic Bézier ----------
// Convert an array of 1-D offset values (indexed 0..n-1) to canvas path.
// The parallel axis coordinate is computed from the 'along' function.
// Uses Catmull-Rom → cubic Bézier: CP1 = P1 + (P2-P0)/6, CP2 = P2 - (P3-P1)/6
function buildSmoothPath(offsets, dx, dy, ox, oy) {
  // offsets: perpendicular distances from edge
  // For each point i: along = i/(n-1), perp = offsets[i]
  // dx/dy: direction along the edge (unit vector)
  // ox/oy: origin corner
  const n  = offsets.length;
  const W  = canvas.width, H = canvas.height;

  // Build (x,y) arrays for the wave points
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    px[i] = ox + dx * t + offsets[i] * (-dy);  // perpendicular = rotate dx/dy by 90°
    py[i] = oy + dy * t + offsets[i] * dx;
  }

  ctx.beginPath();
  // Start at the screen-edge corner behind p[0]
  ctx.moveTo(ox - dx * 0.01 * W - dy * 2, oy - dy * 0.01 * H + dx * 2);
  // Wave using Catmull-Rom → Bézier
  ctx.lineTo(px[0], py[0]);
  for (let i = 0; i < n - 1; i++) {
    const p0x = px[Math.max(i - 1, 0)], p0y = py[Math.max(i - 1, 0)];
    const p1x = px[i],                  p1y = py[i];
    const p2x = px[i + 1],              p2y = py[i + 1];
    const p3x = px[Math.min(i + 2, n - 1)], p3y = py[Math.min(i + 2, n - 1)];
    const cp1x = p1x + (p2x - p0x) / 6;
    const cp1y = p1y + (p2y - p0y) / 6;
    const cp2x = p2x - (p3x - p1x) / 6;
    const cp2y = p2y - (p3y - p1y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
  }
  // Close back via the screen-edge corners
  ctx.lineTo(ox + dx + offsets[n-1] * (-dy) + dx * 0.01 * W, oy + dy + offsets[n-1] * dx + dy * 0.01 * H);
  // Snap to off-screen corners
  if (edge === 'bottom')      { ctx.lineTo(W + 2, H + 2); ctx.lineTo(-2, H + 2); }
  else if (edge === 'top')    { ctx.lineTo(W + 2, -2);    ctx.lineTo(-2, -2); }
  else if (edge === 'left')   { ctx.lineTo(-2, H + 2);    ctx.lineTo(-2, -2); }
  else                        { ctx.lineTo(W + 2, H + 2); ctx.lineTo(W + 2, -2); }
  ctx.closePath();
}

// Returns the origin corner and along-edge direction for the current edge
function edgeGeom() {
  const W = canvas.width, H = canvas.height;
  if (edge === 'bottom') return { ox: -2, oy: H,     dx: W + 4, dy: 0 };
  if (edge === 'top')    return { ox: -2, oy: 0,      dx: W + 4, dy: 0 };
  if (edge === 'left')   return { ox: 0,  oy: -2,     dx: 0,     dy: H + 4 };
  /* right */            return { ox: W,  oy: -2,     dx: 0,     dy: H + 4 };
}

// Returns the unit perpendicular pointing INTO the screen for the current edge
function edgeInward() {
  if (edge === 'bottom') return [0, -1];
  if (edge === 'top')    return [0,  1];
  if (edge === 'left')   return [1,  0];
  /* right */            return [-1, 0];
}

function buildPath(offsets) {
  const g  = edgeGeom();
  const [ix, iy] = edgeInward();
  const n  = offsets.length;
  const W  = canvas.width, H = canvas.height;

  // Compute wave (x,y) — origin + along-fraction + inward*offset
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t  = i / (n - 1);
    px[i] = g.ox + g.dx * t + ix * offsets[i];
    py[i] = g.oy + g.dy * t + iy * offsets[i];
  }

  ctx.beginPath();
  // off-screen start corner
  if (edge === 'bottom')      ctx.moveTo(-2, H + 2);
  else if (edge === 'top')    ctx.moveTo(-2, -2);
  else if (edge === 'left')   ctx.moveTo(-2, -2);
  else                        ctx.moveTo(W + 2, -2);

  // wave via Catmull-Rom → cubic Bézier
  ctx.lineTo(px[0], py[0]);
  for (let i = 0; i < n - 1; i++) {
    const p0x = px[Math.max(i - 1, 0)],     p0y = py[Math.max(i - 1, 0)];
    const p1x = px[i],                       p1y = py[i];
    const p2x = px[i + 1],                   p2y = py[i + 1];
    const p3x = px[Math.min(i+2, n-1)],     p3y = py[Math.min(i+2, n-1)];
    ctx.bezierCurveTo(
      p1x + (p2x - p0x) / 6, p1y + (p2y - p0y) / 6,
      p2x - (p3x - p1x) / 6, p2y - (p3y - p1y) / 6,
      p2x, p2y
    );
  }

  // off-screen end corner + close via screen edge
  if (edge === 'bottom')      { ctx.lineTo(W + 2, H + 2); }
  else if (edge === 'top')    { ctx.lineTo(W + 2, -2); }
  else if (edge === 'left')   { ctx.lineTo(-2, H + 2); }
  else                        { ctx.lineTo(W + 2, H + 2); }
  ctx.closePath();
}

// ---------- shadow (6 stacked layers) ----------
const SHADOW_LAYERS = [
  { frac: 0.15, alpha: 0.22 },
  { frac: 0.35, alpha: 0.19 },
  { frac: 0.58, alpha: 0.15 },
  { frac: 0.82, alpha: 0.11 },
  { frac: 1.10, alpha: 0.07 },
  { frac: 1.45, alpha: 0.04 },
];

function shadowDir() {
  if (edge === 'bottom') return [0, -1];
  if (edge === 'top')    return [0,  1];
  if (edge === 'left')   return [1,  0];
  /* right */            return [-1, 0];
}

function drawWithShadow(offsets, fillColor, shadow) {
  if (shadow > 0.3) {
    const maxOffset = shadow * 6;
    const [sdx, sdy] = shadowDir();
    for (const { frac, alpha } of SHADOW_LAYERS) {
      const d = maxOffset * frac;
      ctx.save();
      ctx.translate(sdx * d, sdy * d);
      buildPath(offsets);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fill();
      ctx.restore();
    }
  }
  buildPath(offsets);
  ctx.fillStyle = fillColor;
  ctx.fill();
}

// ---------- chooseEdge / reseed ----------
function chooseEdge() {
  const p = getParams();
  const edges = canvas.width >= canvas.height
    ? ['top', 'bottom']
    : ['left', 'right'];
  edge    = edges[Math.floor(Math.random() * 2)];
  basePts = makePts(p.n);
  extraPts = Array.from({ length: p.numLines }, () => makePts(p.n));
  palette  = generatePalette(p.numLines);
  lastNumLines = p.numLines;
}

// Regenerate points & palette but keep the current edge
function reseed() {
  const p = getParams();
  basePts  = makePts(p.n);
  extraPts = Array.from({ length: p.numLines }, () => makePts(p.n));
  palette  = generatePalette(p.numLines);
  lastNumLines = p.numLines;
}

// ---------- main loop ----------
function loop() {
  const p = getParams();
  const W = canvas.width, H = canvas.height;

  resizePts(basePts, p.n);
  while (extraPts.length < p.numLines) extraPts.push(makePts(p.n));
  extraPts.length = p.numLines;
  for (let l = 0; l < p.numLines; l++) resizePts(extraPts[l], p.n);

  if (p.numLines !== lastNumLines) {
    palette = generatePalette(p.numLines);
    lastNumLines = p.numLines;
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Advance angles
  for (const pt of basePts) pt.angle += pt.speed * p.speedMult;
  for (let l = 0; l < p.numLines; l++)
    for (const pt of extraPts[l]) pt.angle += pt.speed * p.speedMult;

  // Compute per-point offsets
  const offsets = [];
  for (let l = 0; l < p.numLines; l++) {
    offsets[l] = new Float32Array(p.n);
    for (let i = 0; i < p.n; i++) {
      const baseOsc  = p.amplitude * Math.sin(basePts[i].angle);
      const extraOsc = p.extraAmp  * Math.sin(extraPts[l][i].angle);
      if (l === 0) {
        offsets[0][i] = Math.max(1, p.baseDist + baseOsc + extraOsc);
      } else {
        const gap = Math.max(2, p.spacing * Math.pow(p.spacingFalloff, l - 1) + extraOsc);
        offsets[l][i] = offsets[l - 1][i] + gap;
      }
    }
  }

  // Paint back-to-front
  for (let l = p.numLines - 1; l >= 0; l--) {
    drawWithShadow(offsets[l], palette[l], p.shadow);
  }

  requestAnimationFrame(loop);
}

// ---------- init ----------
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('load', () => {
  canvas = document.getElementById('c');
  ctx    = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('click', reseed);
  chooseEdge();
  loop();
});

// expose chooseEdge so the HTML button can still call it
window.chooseEdge = chooseEdge;

// ---------- params ----------
function getParams() {
  const v = id => parseFloat(document.getElementById(id).value);
  const n        = v('numPoints') | 0;
  const baseDist = v('baseDist')  | 0;
  const amplitude = v('amplitude');
  const extraAmp  = v('extraAmp');
  const speedMult = v('speedMult');
  const shadow    = v('thickness');
  const numLines  = v('numLines') | 0;
  const spacing   = v('spacing');
  const spacingFalloff = v('spacingFalloff');
  return {
    n, baseDist,
    amplitude: Math.min(amplitude, baseDist - 1),
    extraAmp, speedMult, shadow,
    numLines, spacing, spacingFalloff
  };
}

// ---------- control points ----------
function makePts(n) {
  return Array.from({ length: n }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 0.0006 + Math.random() * 0.0014
  }));
}

function resizePts(arr, n) {
  while (arr.length < n)
    arr.push({ angle: Math.random() * Math.PI * 2, speed: 0.0006 + Math.random() * 0.0014 });
  arr.length = n;
}

// ---------- palette ----------
function lerpN(a, b, t) { return a + (b - a) * t; }

function hsbToHex(h, s, b) {           // s,b in 0..100
  s /= 100; b /= 100;
  const c = b * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = b - c;
  let r, g, bv;
  if      (h < 60)  { r=c; g=x; bv=0; }
  else if (h < 120) { r=x; g=c; bv=0; }
  else if (h < 180) { r=0; g=c; bv=x; }
  else if (h < 240) { r=0; g=x; bv=c; }
  else if (h < 300) { r=x; g=0; bv=c; }
  else              { r=c; g=0; bv=x; }
  const to2 = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(bv)}`;
}

function generatePalette(numBands) {
  const h       = Math.random() * 360;
  const variant = Math.floor(Math.random() * 3);
  const h2      = variant === 2 ? (h + 25 + Math.random() * 30) % 360 : h;
  return Array.from({ length: numBands }, (_, i) => {
    const t = numBands > 1 ? i / (numBands - 1) : 0.5;
    if      (variant === 0) return hsbToHex(h,               lerpN(20, 88, t), lerpN(92, 28, t));
    else if (variant === 1) return hsbToHex(h,               lerpN(88, 20, t), lerpN(28, 92, t));
    else                    return hsbToHex(lerpN(h, h2, t), lerpN(55, 90, t), lerpN(90, 28, t));
  });
}

