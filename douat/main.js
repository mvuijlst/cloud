import { Renderer, makeView } from './render.js';
import { samplePattern, layingOrder, mulberry32, LETTERS } from './pattern.js';
import { pickMaterial, daylight } from './materials.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('floor');
const info = document.getElementById('info');
const status = document.getElementById('status');

const PITCH = 250;     // mm, one square cell
const THICK = 25;      // mm, stone thickness above the mortar bed

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  status.textContent = e.message;
  status.hidden = false;
  throw e;
}

const opts = {
  speed: Math.max(0.1, +qs.get('speed') || 1),
  still: qs.has('still'),
  cells: +qs.get('cells') || 0,
  tilt: (+qs.get('tilt') || 0) * Math.PI / 180,
  material: qs.get('material'),
  samples: +qs.get('samples') || 0,
  hold: (+qs.get('hold') || 75),
  // freeze=n,u: lay stones before n at once, then hold stone n at fraction u of its flight
  freeze: qs.get('freeze') ? qs.get('freeze').split(',').map(Number) : null,
};
let seed = qs.has('seed') ? (+qs.get('seed') >>> 0) : (Math.random() * 2 ** 32) >>> 0;

let floor = null;      // current floor description
let run = null;        // laying state
let paused = false;

function size() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  renderer.samples = opts.samples || (dpr >= 1.75 ? 2 : 4);
  renderer.resize(w, h);
  return { w, h, dpr };
}

function newFloor(s) {
  seed = s >>> 0;
  const rng = mulberry32(seed);
  const { w, h, dpr } = size();
  const cssW = w / dpr;
  const across = opts.cells || Math.max(5, Math.min(14, Math.round(cssW / 165)));
  const view = makeView(w, h, { pitch: PITCH, thick: THICK, cellsAcross: across, fovY: 38 * Math.PI / 180, tilt: opts.tilt });
  const material = pickMaterial(rng, opts.material);
  const sun = daylight(rng);
  const pat = samplePattern(rng, view.NX, view.NY);
  const order = layingOrder(rng, view.NX, view.NY, pat.centred);
  const cells = new Uint8Array(view.NX * view.NY * 4);
  for (let k = 0; k < view.NX * view.NY; k++) {
    cells[k * 4] = pat.grid[k];
    cells[k * 4 + 1] = opts.still ? 3 : 0;
    cells[k * 4 + 2] = opts.still ? 255 : 0;
  }
  floor = { seed, view, material, sun, pattern: pat, order, cells };
  renderer.setFloor(floor);
  renderer.fade = 0;
  // stones in laying order: in each cell, first the half that meets laid work
  const laid = new Set();
  const stones = [];
  const has = (i, j) => laid.has(i + ',' + j);
  for (const [i, j] of order.cells) {
    const st = pat.grid[j * view.NX + i];
    // does the dark half touch the left/top/right/bottom neighbours that are down already?
    const n = [has(i - 1, j), has(i, j - 1), has(i + 1, j), has(i, j + 1)];
    const darkEdges = [[0, 3], [0, 1], [1, 2], [2, 3]][st];       // edges owned by the dark half
    const edgeN = [n[0], n[1], n[2], n[3]];
    const darkScore = darkEdges.reduce((a, e) => a + (edgeN[e] ? 1 : 0), 0);
    const lightScore = [0, 1, 2, 3].filter(e => !darkEdges.includes(e)).reduce((a, e) => a + (edgeN[e] ? 1 : 0), 0);
    const first = darkScore > lightScore ? 0 : darkScore < lightScore ? 1 : (rng() < 0.5 ? 0 : 1);
    stones.push([i, j, first], [i, j, 1 - first]);
    laid.add(i + ',' + j);
  }
  const cx = view.NX / 2, cy = view.NY / 2;
  run = {
    phase: opts.still ? 'hold' : 'intro', t: 0, stones, next: 0, cur: null,
    pointNext: 0, rng, cx, cy, mode: order.mode, holdFor: opts.still ? Infinity : opts.hold,
  };
  describe();
}

// edges: 0 left, 1 top, 2 right, 3 bottom. Owners of a half tile's legs:
// A (right angle bottom-left): left, bottom. B: left, top. C: top, right. D: right, bottom.

function describe() {
  const f = floor;
  const total = f.view.NX * f.view.NY * 2;
  const done = run.phase === 'hold' || run.phase === 'point' || run.phase === 'outro' ? total : run.next;
  info.querySelector('.what').textContent = `${f.pattern.describe}`;
  info.querySelector('.how').textContent = `${f.material.name} · ${f.view.NX}×${f.view.NY} squares, ${total} stones · laid ${f.order.mode === 'centre' ? 'out from the centre' : f.order.mode === 'rows' ? 'row by row' : 'along the diagonal'} · ${done}/${total} · seed ${f.seed}`;
}

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function startStone() {
  const [i, j, k] = run.stones[run.next];
  const v = floor.view;
  renderer.makeSprite(i, j, k);
  // the stone comes in from the side not yet laid
  let ax, ay;
  if (run.mode === 'rows') { ax = 0; ay = 1; }
  else if (run.mode === 'diagonal') { ax = 0.7; ay = 0.7; }
  else { ax = i + 0.5 - run.cx; ay = j + 0.5 - run.cy; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
  const ang = Math.atan2(ay, ax) + (run.rng() - 0.5) * 1.1;
  const reach = PITCH * (0.45 + 0.25 * run.rng());
  run.cur = {
    i, j, k, t: 0,
    sx: Math.cos(ang) * reach, sy: Math.sin(ang) * reach,
    srot: (run.rng() - 0.5) * 0.35,
    ex: (run.rng() - 0.5) * 5, ey: (run.rng() - 0.5) * 5, erot: (run.rng() - 0.5) * 0.03,
    lift0: 150 + 80 * run.rng(),
  };
}

function animateStone(dt) {
  const c = run.cur, D = 1.0 / opts.speed;
  c.t += dt;
  if (opts.freeze) c.t = opts.freeze[1] * D;
  const u = c.t / D;
  const a = easeOut(u / 0.62), b = ease((u - 0.62) / 0.26);
  const dx = (c.sx * (1 - a) + c.ex * a) * (1 - b);
  const dy = (c.sy * (1 - a) + c.ey * a) * (1 - b);
  const rot = (c.srot * (1 - a) + c.erot * a) * (1 - b);
  const lift = (c.lift0 * Math.pow(1 - a, 1.4) + 5 * a) * (1 - b);
  renderer.setActive({ i: c.i, j: c.j, k: c.k, dx, dy, rot, lift, alpha: ease(u / 0.12) });
  if (u >= 0.9) {
    const idx = (c.j * floor.view.NX + c.i) * 4;
    const cell = floor.cells.slice(idx, idx + 4);
    cell[1] |= 1 << c.k;
    renderer.setCell(c.i, c.j, cell, true);
    renderer.setActive(null);
    run.cur = null;
    run.next++;
    run.wait = 0.1 / opts.speed;
    describe();
  }
}

function step(dt) {
  if (!run) return;
  switch (run.phase) {
    case 'intro':
      if (renderer.pending === 0) {
        renderer.fade = Math.min(1, renderer.fade + dt / 1.6);
        if (renderer.fade >= 1) run.phase = 'lay';
      }
      break;
    case 'lay':
      if (opts.freeze && !run.frozen) {
        run.frozen = true;
        const [n] = opts.freeze;
        for (let s = 0; s < Math.min(n, run.stones.length); s++) {
          const [i, j, k] = run.stones[s];
          floor.cells[(j * floor.view.NX + i) * 4 + 1] |= 1 << k;
        }
        renderer.setFloor(floor);
        renderer.fade = 1;
        run.next = n;
        startStone();
      }
      if (run.cur) animateStone(opts.freeze ? 0 : dt);
      else if (run.wait > 0) run.wait -= dt;
      else if (run.next < run.stones.length) startStone();
      else { run.phase = 'point'; run.t = 0; describe(); }
      break;
    case 'point': {
      // joints filled across the floor, in laying order
      run.t += dt;
      const cells = floor.order.cells;
      const target = Math.min(cells.length, Math.floor(run.t / (14 / opts.speed) * cells.length));
      while (run.pointNext < target) {
        const [i, j] = cells[run.pointNext++];
        const idx = (j * floor.view.NX + i) * 4;
        const cell = floor.cells.slice(idx, idx + 4);
        cell[2] = 255;
        renderer.setCell(i, j, cell);
      }
      if (run.pointNext >= cells.length && renderer.pending === 0) { run.phase = 'hold'; run.t = 0; }
      break;
    }
    case 'hold':
      if (renderer.pending === 0) renderer.fade = Math.min(1, renderer.fade + dt / 1.6);
      run.t += dt;
      if (run.t > run.holdFor) { run.phase = 'outro'; }
      break;
    case 'outro':
      renderer.fade = Math.max(0, renderer.fade - dt / 2.5);
      if (renderer.fade <= 0) newFloor(seed + 1);
      break;
  }
}

let last = 0;
function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  try {
    if (!paused) step(dt);
    renderer.frame(now);
  } catch (e) {
    status.textContent = e.message;
    status.hidden = false;
    console.error(e);
    return;
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- controls
let hideTimer = 0;
function wake() {
  document.body.classList.add('awake');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => document.body.classList.remove('awake'), 3000);
}
window.addEventListener('mousemove', wake);
window.addEventListener('touchstart', wake, { passive: true });
window.addEventListener('keydown', e => {
  if (e.key === 'n' || e.key === 'N') newFloor((Math.random() * 2 ** 32) >>> 0);
  else if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  else if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  } else if (e.key >= '1' && e.key <= '4') opts.speed = [1, 2, 4, 8][+e.key - 1];
  wake();
});
document.getElementById('again').addEventListener('click', () => newFloor((Math.random() * 2 ** 32) >>> 0));

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => newFloor(seed), 400);
});

// A lost GPU context (driver reset, long sleep) takes every texture with it: start afresh.
canvas.addEventListener('webglcontextlost', e => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());

newFloor(seed);
requestAnimationFrame(loop);

// for inspection from the console
window.douat = { get floor() { return floor; }, get run() { return run; }, renderer, newFloor, LETTERS };
