import { Renderer } from './render.js';
import { makeView, Orbit } from './camera.js';
import { samplePattern, layingOrder, mulberry32, LETTERS } from './pattern.js';
import { pickMaterial, daylight } from './materials.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('floor');
const info = document.getElementById('info');
const status = document.getElementById('status');

const PITCH = 250;     // mm, one square cell
const THICK = 25;      // mm, stone thickness above the mortar bed
const FOV = 38 * Math.PI / 180;

const small = matchMedia('(pointer: coarse)').matches;
let renderer;
try {
  renderer = new Renderer(canvas, { lowPower: small || qs.has('low') });
} catch (e) {
  status.textContent = e.message;
  status.hidden = false;
  throw e;
}

const opts = {
  speed: Math.max(0.1, +qs.get('speed') || 1),
  still: qs.has('still'),
  cells: +qs.get('cells') || 0,
  material: qs.get('material'),
  hold: (+qs.get('hold') || 75),
  // freeze=n,u: lay stones before n at once, then hold stone n at fraction u of its flight
  freeze: qs.get('freeze') ? qs.get('freeze').split(',').map(Number) : null,
  // view=yaw,pitch,dist (degrees, degrees, fraction of the default distance)
  view: qs.get('view') ? qs.get('view').split(',').map(Number) : null,
};
let seed = qs.has('seed') ? (+qs.get('seed') >>> 0) : (Math.random() * 2 ** 32) >>> 0;

let floor = null;      // current floor description
let run = null;        // laying state
let paused = false;
const orbit = new Orbit(canvas, () => wake());

function size() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  renderer.resize(w, h);
  return { w, h, dpr };
}

function newFloor(s) {
  seed = s >>> 0;
  const rng = mulberry32(seed);
  const { w, h, dpr } = size();
  const across = opts.cells || Math.max(5, Math.min(14, Math.round(w / dpr / 165)));
  const view = makeView(w, h, { pitch: PITCH, thick: THICK, cellsAcross: across, fovY: FOV });
  const material = pickMaterial(rng, opts.material);
  const sun = daylight(rng);
  const pat = samplePattern(rng, view.NX, view.NY);
  const order = layingOrder(rng, view.NX, view.NY, pat.centred);
  const cells = new Uint8Array(view.NX * view.NY * 4);
  for (let k = 0; k < view.NX * view.NY; k++) {
    cells[k * 4] = pat.grid[k];
    cells[k * 4 + 1] = 3;                    // which halves exist; drawing follows the laid count
    cells[k * 4 + 2] = opts.still ? 255 : 0;
  }
  // stones in laying order: in each cell, first the half that meets laid work
  const laid = new Set();
  const stones = [];
  const has = (i, j) => laid.has(i + ',' + j);
  for (const [i, j] of order.cells) {
    const st = pat.grid[j * view.NX + i];
    const n = [has(i - 1, j), has(i, j - 1), has(i + 1, j), has(i, j + 1)];
    const darkEdges = [[0, 3], [0, 1], [1, 2], [2, 3]][st];   // left, top, right, bottom edges of the dark half
    const darkScore = darkEdges.reduce((a, e) => a + (n[e] ? 1 : 0), 0);
    const lightScore = [0, 1, 2, 3].filter(e => !darkEdges.includes(e)).reduce((a, e) => a + (n[e] ? 1 : 0), 0);
    const first = darkScore > lightScore ? 0 : darkScore < lightScore ? 1 : (rng() < 0.5 ? 0 : 1);
    stones.push([i, j, first], [i, j, 1 - first]);
    laid.add(i + ',' + j);
  }
  floor = { seed, view, material, sun, pattern: pat, order, cells, stones };
  renderer.setFloor(floor);
  renderer.fade = 0;
  orbit.setFloor(view);
  if (opts.view) {
    const [yaw, pitch, d] = opts.view;
    orbit.yaw = yaw * Math.PI / 180; orbit.pitch = pitch * Math.PI / 180; orbit.dist = view.dist * (d || 1);
    orbit.changed(false);
  }
  run = {
    phase: 'intro', t: 0, stones, next: 0, cur: null, pointNext: 0, rng,
    cx: view.NX / 2, cy: view.NY / 2, mode: order.mode, holdFor: opts.still ? Infinity : opts.hold,
  };
  describe();
}

function describe() {
  const f = floor;
  const total = f.stones.length;
  const done = run.phase === 'hold' || run.phase === 'point' || run.phase === 'outro' ? total : run.next;
  info.querySelector('.what').textContent = `${f.pattern.describe}`;
  info.querySelector('.how').textContent = `${f.material.name} · ${f.view.NX}×${f.view.NY} squares, ${total} stones · laid ${f.order.mode === 'centre' ? 'out from the centre' : f.order.mode === 'rows' ? 'row by row' : 'along the diagonal'} · ${done}/${total} · seed ${f.seed}`;
}

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function startStone() {
  const [i, j] = run.stones[run.next];
  // the mason brings the stone from the side not yet laid
  let ax, ay;
  if (run.mode === 'rows') { ax = 0; ay = 1; }
  else if (run.mode === 'diagonal') { ax = 0.7; ay = 0.7; }
  else { ax = i + 0.5 - run.cx; ay = j + 0.5 - run.cy; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
  const ang = Math.atan2(ay, ax) + (run.rng() - 0.5) * 1.1;
  const reach = PITCH * (0.55 + 0.35 * run.rng());
  const dir = [Math.cos(ang), Math.sin(ang)];
  run.cur = {
    t: 0, dir,
    sx: dir[0] * reach, sy: dir[1] * reach,
    yaw0: (run.rng() - 0.5) * 0.5,
    tilt0: 0.14 + 0.1 * run.rng(),               // held with the leading edge lower
    lift0: 170 + 90 * run.rng(),
  };
}

function animateStone(dt) {
  const c = run.cur, D = 1.1 / opts.speed;
  c.t += dt;
  if (opts.freeze) c.t = opts.freeze[1] * D;
  const u = c.t / D;
  const a = easeOut(u / 0.6), b = ease((u - 0.6) / 0.28);
  const k = 1 - b;
  const lift = (c.lift0 * Math.pow(1 - a, 1.3) + 12 * a) * k;
  const tilt = (c.tilt0 * Math.pow(1 - a, 0.8) + 0.05 * a) * k;
  // tilt about the axis across the direction of travel: the edge towards its place goes down first
  const axis = [-c.dir[1], c.dir[0]];
  renderer.setFlying({
    index: run.next,
    dx: (c.sx * (1 - a) + c.sx * 0.02 * a) * k,
    dy: (c.sy * (1 - a) + c.sy * 0.02 * a) * k,
    lift, yaw: (c.yaw0 * (1 - a) + c.yaw0 * 0.08 * a) * k,
    tiltX: tilt * axis[0], tiltY: tilt * axis[1],
    alpha: ease(u / 0.04),
  });
  if (u >= 0.9) {
    renderer.setFlying(null);
    run.cur = null;
    run.next++;
    renderer.setLaid(run.next);
    run.wait = 0.1 / opts.speed;
    describe();
  }
}

function step(dt) {
  if (!run) return;
  switch (run.phase) {
    case 'intro': {
      const t0 = performance.now();
      while (!renderer.bakeStep() && performance.now() - t0 < 12);
      if (renderer.baked) {
        if (opts.still) { renderer.setLaid(run.stones.length); run.next = run.stones.length; run.phase = 'hold'; describe(); break; }
        renderer.fade = Math.min(1, renderer.fade + dt / 1.6);
        if (renderer.fade >= 1) run.phase = 'lay';
      }
      break;
    }
    case 'lay':
      if (opts.freeze && !run.frozen) {
        run.frozen = true;
        run.next = Math.min(opts.freeze[0], run.stones.length - 1);
        renderer.setLaid(run.next);
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
      if (run.pointNext >= cells.length) { run.phase = 'hold'; run.t = 0; }
      break;
    }
    case 'hold':
      renderer.fade = Math.min(1, renderer.fade + dt / 1.6);
      run.t += dt;
      if (run.t > run.holdFor) run.phase = 'outro';
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
    if (!paused || run?.phase === 'intro') step(dt);
    const m = orbit.matrices(renderer.W / renderer.H);
    renderer.frame({ ...m, version: orbit.version });
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
  else if (e.key === 'r' || e.key === 'R') orbit.reset(true);
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
window.douat = {
  get floor() { return floor; }, get run() { return run; }, renderer, orbit, newFloor, LETTERS,
  // arguments for tools/measure_render.py, for the default top-down view
  measureArgs() {
    const v = floor.view, px = renderer.H / (2 * Math.tan(v.fovY / 2) * v.dist);
    return [px * PITCH, v.NX, v.NY, Array.from(floor.pattern.grid).join('')].join(' ');
  },
};
