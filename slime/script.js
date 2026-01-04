// Slime Dish (color) — based on the algorithm embedded in slime/readme.MD

let WIDTH = 400;
let HEIGHT = 400;
let CELL_SIZE = 2; // device pixels per sim cell (must be same for x/y)
const MAX_CELLS = 550_000; // cap for performance
const NUM_AGENTS = 1500;
const DECAY = 0.9;
const MIN_CHEM = 0.0001;

const SENS_ANGLE = (45 * Math.PI) / 180;
const SENS_DIST = 9;
const AGT_SPEED = 1;
const AGT_ANGLE = (45 * Math.PI) / 180;
const DEPOSIT = 1;

// Food / stimulus (paper-style projected attractant)
const FOOD_DECAY = 0.95;
const FOOD_INJECT = 0.55;
const FOOD_WEIGHT = 2.2;
const FOOD_RADIUS = 2;

const SOURCE_RELOCATE_EVERY = 700; // sim steps

function boundedXY(x, y) {
  return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function randCircle() {
  const r = Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class Agent {
  constructor(x, y, ang) {
    this.x = x;
    this.y = y;
    this.ang = ang;
    this.scatter = false;
  }

  sense(m, chem) {
    const a = this.ang + m * SENS_ANGLE;
    const sx = Math.floor(this.x + Math.cos(a) * SENS_DIST);
    const sy = Math.floor(this.y + Math.sin(a) * SENS_DIST);

    if (!boundedXY(sx, sy)) return -1;

    const i = sy * WIDTH + sx;
    const sensedTrail = chem[i];
    const sensedFood = food[i];
    const sensed = sensedTrail + FOOD_WEIGHT * sensedFood;
    // Scatter only inverts the trail-following component; food still attracts.
    return this.scatter ? (1 - sensedTrail) + FOOD_WEIGHT * sensedFood : sensed;
  }

  react(chem) {
    const forwardChem = this.sense(0, chem);
    const leftChem = this.sense(-1, chem);
    const rightChem = this.sense(1, chem);

    let rotate = 0;
    if (forwardChem > leftChem && forwardChem > rightChem) {
      rotate = 0;
    } else if (forwardChem < leftChem && forwardChem < rightChem) {
      rotate = Math.random() < 0.5 ? -AGT_ANGLE : AGT_ANGLE;
    } else if (leftChem < rightChem) {
      rotate = AGT_ANGLE;
    } else if (rightChem < leftChem) {
      rotate = -AGT_ANGLE;
    } else if (forwardChem < 0) {
      rotate = Math.PI / 2;
    }

    this.ang += rotate;

    const nx = this.x + Math.cos(this.ang) * AGT_SPEED;
    const ny = this.y + Math.sin(this.ang) * AGT_SPEED;

    const tx = Math.floor(nx);
    const ty = Math.floor(ny);
    if (!boundedXY(tx, ty)) {
      // Hit boundary: turn and stay put.
      this.ang += (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2);
      return;
    }

    this.x = nx;
    this.y = ny;
  }

  deposit(chem) {
    const x = Math.floor(this.x);
    const y = Math.floor(this.y);
    if (!boundedXY(x, y)) return;

    const i = y * WIDTH + x;
    const v = chem[i] + DEPOSIT;
    chem[i] = v > 1 ? 1 : v;
  }
}

function blurAt(x, y, field) {
  // 3x3 mean filter with clamped boundaries.
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= HEIGHT) continue;
    const row = yy * WIDTH;
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= WIDTH) continue;
      const i = row + xx;
      sum += field[i];
    }
  }
  return sum / 9;
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

// Precompute a color LUT to avoid per-pixel allocations/work.
// Low chem = dark, high chem = bright gradient.
const COLOR_LUT = new Uint8ClampedArray(256 * 4);
randomizePalette();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
ctx.imageSmoothingEnabled = false;

// Click to randomize to a new (constrained) palette.
canvas.addEventListener('pointerdown', (e) => {
  // Only primary button (mouse); touch is fine too.
  if (typeof e.button === 'number' && e.button !== 0) return;
  randomizePalette();
});

const off = document.createElement('canvas');
const offCtx = off.getContext('2d', { alpha: false });

let offImg;
let chem;
let wip;
let food;
let foodWip;
let agents = [];

// Exactly two food sources; the second relocates over time.
let sources = [];

// Initialize after offscreen canvas exists (autoResize may call setupSimulation).
autoResize();
window.addEventListener('resize', autoResize);

let frame = 0;
requestAnimationFrame(tick);

function tick() {
  frame++;

  // Run a couple sim steps per frame for smoother trails.
  const steps = 2;
  for (let s = 0; s < steps; s++) {
    simStep();
  }

  render();
  requestAnimationFrame(tick);
}

function simStep() {
  // Keep exactly two sources; relocate one occasionally.
  if (frame % SOURCE_RELOCATE_EVERY === 0) {
    sources[1] = randomSourceCellDifferentFrom(sources[0]);
  }

  // Inject food stimulus into the food field.
  for (const s of sources) {
    injectFood(s.x, s.y);
  }

  // Diffuse & decay food field.
  for (let y = 0; y < HEIGHT; y++) {
    const row = y * WIDTH;
    for (let x = 0; x < WIDTH; x++) {
      const i = row + x;
      let v = FOOD_DECAY * blurAt(x, y, food);
      if (v < MIN_CHEM) v = 0;
      foodWip[i] = v;
    }
  }
  {
    const swapFood = food;
    food = foodWip;
    foodWip = swapFood;
  }

  // Diffuse + decay (and clamp outside dish to 0)
  for (let y = 0; y < HEIGHT; y++) {
    const row = y * WIDTH;
    for (let x = 0; x < WIDTH; x++) {
      const i = row + x;
      let v = DECAY * blurAt(x, y, chem);
      if (v < MIN_CHEM) v = 0;
      wip[i] = v;
    }
  }
  const swap = chem;
  chem = wip;
  wip = swap;

  const isScattering = Math.sin(frame / 150) > 0.8;
  // Randomized iteration order reduces subtle directional bias.
  shuffleInPlace(agents);
  for (const a of agents) {
    a.scatter = isScattering;
    a.react(chem);
  }
  for (const a of agents) {
    a.deposit(chem);
  }
}

function viewRect() {
  return { x: 0, y: 0, w: WIDTH, h: HEIGHT };
}

function render() {
  // Update offscreen pixels.
  const d = offImg.data;
  let p = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const v = chem[i];
      let idx = (v * 255) | 0;
      if (idx < 0) idx = 0;
      else if (idx > 255) idx = 255;

      const o = idx * 4;
      d[p++] = COLOR_LUT[o + 0];
      d[p++] = COLOR_LUT[o + 1];
      d[p++] = COLOR_LUT[o + 2];
      d[p++] = 255;
    }
  }
  offCtx.putImageData(offImg, 0, 0);

  ctx.imageSmoothingEnabled = false;
  const vr = viewRect();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = vr.w * CELL_SIZE;
  const drawH = vr.h * CELL_SIZE;
  const ox = Math.floor((canvas.width - drawW) / 2);
  const oy = Math.floor((canvas.height - drawH) / 2);
  ctx.drawImage(off, vr.x, vr.y, vr.w, vr.h, ox, oy, drawW, drawH);
}

function autoResize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.imageSmoothingEnabled = false;

  // Choose a cell size so the sim fills the screen with square pixels,
  // while staying under MAX_CELLS.
  let cellSize = 1;
  while (true) {
    const w = Math.max(1, Math.floor(canvas.width / cellSize));
    const h = Math.max(1, Math.floor(canvas.height / cellSize));
    if (w * h <= MAX_CELLS) break;
    cellSize++;
  }

  const nextW = Math.max(1, Math.floor(canvas.width / cellSize));
  const nextH = Math.max(1, Math.floor(canvas.height / cellSize));

  const changed = nextW !== WIDTH || nextH !== HEIGHT || cellSize !== CELL_SIZE;
  WIDTH = nextW;
  HEIGHT = nextH;
  CELL_SIZE = cellSize;
  if (changed) setupSimulation();
}

function injectFood(x, y) {
  // Radial injection helps the source be visible/stable.
  for (let dy = -FOOD_RADIUS; dy <= FOOD_RADIUS; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= HEIGHT) continue;
    for (let dx = -FOOD_RADIUS; dx <= FOOD_RADIUS; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= WIDTH) continue;
      const r2 = dx * dx + dy * dy;
      if (r2 > FOOD_RADIUS * FOOD_RADIUS) continue;
      const falloff = 1 - Math.sqrt(r2) / (FOOD_RADIUS + 1);
      const i = yy * WIDTH + xx;
      const v = food[i] + FOOD_INJECT * falloff;
      food[i] = v > 1 ? 1 : v;
    }
  }
}

function randomSourceCell() {
  return {
    x: (Math.random() * WIDTH) | 0,
    y: (Math.random() * HEIGHT) | 0,
  };
}

function randomSourceCellDifferentFrom(other) {
  for (let tries = 0; tries < 20; tries++) {
    const s = randomSourceCell();
    if (s.x !== other.x || s.y !== other.y) return s;
  }
  return randomSourceCell();
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
}

function randomizePalette() {
  // Choose from a few safe gradient archetypes so every roll looks good.
  // We keep low values dark and mid/high values saturated & bright.
  const archetypes = [
    // cool -> warm
    { h0: rand(190, 240), h1: rand(20, 60), s0: 0.95, s1: 1.0, l0: 0.05, l1: 0.62, gamma: 1 / 3 },
    // neon-ish mono hue
    { h0: rand(160, 320), h1: null, s0: 1.0, s1: 1.0, l0: 0.04, l1: 0.58, gamma: 0.45 },
    // green -> cyan/blue
    { h0: rand(95, 150), h1: rand(170, 225), s0: 0.9, s1: 1.0, l0: 0.05, l1: 0.60, gamma: 1 / 3 },
    // magenta -> orange
    { h0: rand(280, 330), h1: rand(25, 55), s0: 0.95, s1: 1.0, l0: 0.05, l1: 0.62, gamma: 1 / 3 },
  ];
  const a = archetypes[(Math.random() * archetypes.length) | 0];

  const h0 = a.h0;
  const h1 = a.h1 == null ? h0 : a.h1;
  const s0 = a.s0;
  const s1 = a.s1;
  const l0 = a.l0;
  const l1 = a.l1;
  const gamma = a.gamma;

  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    const w = Math.pow(v, gamma);

    // Interpolate hue along the shortest arc.
    const dh = shortestHueDelta(h0, h1);
    const h = (h0 + dh * w) / 360;
    const s = s0 + (s1 - s0) * w;
    const l = l0 + (l1 - l0) * w;

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = hue2rgb(p, q, h + 1 / 3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1 / 3);

    const o = i * 4;
    COLOR_LUT[o + 0] = (r * 255) | 0;
    COLOR_LUT[o + 1] = (g * 255) | 0;
    COLOR_LUT[o + 2] = (b * 255) | 0;
    COLOR_LUT[o + 3] = 255;
  }
}

function shortestHueDelta(h0, h1) {
  let d = ((h1 - h0) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function setupSimulation() {
  off.width = WIDTH;
  off.height = HEIGHT;
  offImg = offCtx.createImageData(WIDTH, HEIGHT);

  chem = new Float32Array(WIDTH * HEIGHT);
  wip = new Float32Array(WIDTH * HEIGHT);
  food = new Float32Array(WIDTH * HEIGHT);
  foodWip = new Float32Array(WIDTH * HEIGHT);

  agents = [];
  for (let i = 0; i < NUM_AGENTS; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const ang = Math.random() * 2 * Math.PI;
    agents.push(new Agent(x, y, ang));
  }

  sources = [
    { x: Math.floor(WIDTH * 0.25), y: Math.floor(HEIGHT * 0.50) },
    randomSourceCellDifferentFrom({ x: Math.floor(WIDTH * 0.25), y: Math.floor(HEIGHT * 0.50) }),
  ];
}
