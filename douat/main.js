import { Renderer } from './render.js';
import { makeView, Orbit } from './camera.js';
import { mulberry32, LETTERS } from './pattern.js';
import { MATERIALS, daylight } from './materials.js';
import { buildTiling, TILINGS } from './tilings.js';
import { buildPool } from './geometry.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('floor');
const panel = document.getElementById('panel');
const gear = document.getElementById('gear');
const status = document.getElementById('status');

// The viewer's own choices are kept in this browser; the page works the same without them.
const store = {
  get(k) { try { return localStorage.getItem('douat.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('douat.' + k, v); } catch { /* private window */ } },
};
// speed steps 1–5: each doubles the one before; 3 is the default
const SPEEDS = [1, 2, 4, 8, 16];

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

const savedLevel = Math.min(5, Math.max(1, +store.get('speed') || 3));
const opts = {
  // speed=x multiplies directly; otherwise the remembered step
  speed: qs.has('speed') ? Math.max(0.1, +qs.get('speed') || 1) : SPEEDS[savedLevel - 1],
  still: qs.has('still'),
  cells: +qs.get('cells') || 0,
  material: qs.get('material') || store.get('stones') || null,
  tiles: qs.get('tiles') || store.get('tiles') || null,
  // pick=name,name: take these wherever they are among the choices (a design, rule or shape)
  pick: qs.get('pick') ? qs.get('pick').split(',').map(x => x.trim()) : null,
  // seconds a finished floor stays without anyone touching the screen
  hold: (+qs.get('hold') || 120),
  // freeze=n,u: lay stones before n at once, then hold stone n at fraction u of its flight
  freeze: qs.get('freeze') ? qs.get('freeze').split(',').map(Number) : null,
  // view=yaw,pitch,dist (degrees, degrees, fraction of the default distance)
  view: qs.get('view') ? qs.get('view').split(',').map(Number) : null,
  // photo: straight down at the framing used to compare with photographs; no turning
  photo: qs.has('photo'),
  // minutes for one turn of the view; 0 holds it still
  spin: qs.has('spin') ? +qs.get('spin') : (store.get('turning') === '0' ? 0 : 3),
};
let seed = qs.has('seed') ? (+qs.get('seed') >>> 0) : (Math.random() * 2 ** 32) >>> 0;

// The record of floors shown in this browser: when, which seed, and every choice made for it
// (tiling, material, and the tiling's own design, rule or shape). New floors lean away from
// recent choices; a floor named by its seed in the address comes out the same regardless.
const HISTORY_MAX = 500;
let history = [];
try { history = JSON.parse(localStorage.getItem('douat.history') || '[]').filter(e => e && e.c && e.c.kind); } catch { history = []; }
const repeatable = qs.has('seed');
function saveHistory() {
  try { localStorage.setItem('douat.history', JSON.stringify(history)); } catch { /* private window */ }
}
// 1 for a choice not made lately, about 0.2 for one made on the floor just shown
function freshness(key, value) {
  if (repeatable) return 1;
  let r = 0;
  for (let i = history.length - 1, n = 0; i >= 0 && n < 30; i--, n++) if (history[i].c[key] === value) r += Math.pow(0.75, n);
  return Math.exp(-1.6 * r);
}
// A weighted draw that always takes exactly one random number, so that a floor replays from
// its seed and its recorded choices.
function makeChooser(rng, forced, made) {
  return (key, options) => {
    const u = rng();
    let i = forced ? options.findIndex(o => o[0] === forced[key]) : -1;
    if (i < 0 && opts.pick) i = options.findIndex(o => opts.pick.includes(o[0]));
    if (i < 0) {
      const w = options.map(([v, wt]) => wt * freshness(key, v));
      let x = u * w.reduce((a, b) => a + b, 0);
      i = 0;
      while (i < w.length - 1 && (x -= w[i]) > 0) i++;
    }
    made[key] = options[i][0];
    return i;
  };
}
const familyOf = id => id ? (id.startsWith('cement') ? 'cement' : 'stone') : null;

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

function newFloor(s, replay = null) {
  seed = s >>> 0;
  const rng = mulberry32(seed);
  const { w, h, dpr } = size();
  const across = opts.cells || Math.max(5, Math.min(14, Math.round(w / dpr / 165)));
  const view = makeView(w, h, { pitch: PITCH, thick: THICK, cellsAcross: across, fovY: FOV });
  const made = {};
  const choose = makeChooser(rng, replay && replay.c, made);
  // the tiling, then a material of its family: as set in the panel, or drawn
  const fam = familyOf(opts.material);
  const kinds = Object.keys(TILINGS).filter(k => replay || (opts.tiles && TILINGS[opts.tiles] ? k === opts.tiles : !fam || TILINGS[k].family === fam));
  const kind = kinds[choose('kind', kinds.map(k => [k, TILINGS[k].weight]))];
  const fits = MATERIALS.filter(m => m.family === TILINGS[kind].family);
  const mats = !replay && fits.some(m => m.id === opts.material) ? fits.filter(m => m.id === opts.material) : fits;
  const material = mats[choose('material', mats.map(m => [m.id, m.weight]))];
  const sun = daylight(rng);
  const tiling = buildTiling(kind, rng, view, choose);
  // every stone takes one of a pool of baked stones of its class
  const pool = buildPool(tiling, material, seed, renderer.lowPower ? 32 : 56);
  pool.slotOf = pool.entries.map((_, i) => i);
  for (const st of tiling.stones) {
    const list = pool.byClass[st.cls];
    st.entry = list[Math.floor(rng() * list.length)];
  }
  floor = { seed, view, material, sun, tiling, stones: tiling.stones, pool, choices: made };
  record({ t: Date.now(), seed, c: made });
  renderer.setFloor(floor);
  renderer.fade = 0;
  renderer.setPointing(opts.still ? 1e9 : -1);
  orbit.setFloor(view, { photo: opts.photo, period: opts.spin * 60 });
  if (opts.view) {
    const [yaw, pitch, d] = opts.view;
    orbit.home.yaw = yaw * Math.PI / 180; orbit.home.pitch = pitch * Math.PI / 180; orbit.home.dist *= d || 1;
    orbit.reset();
  }
  const rr = view.roomRect;
  run = {
    phase: 'intro', t: 0, stones: tiling.stones, next: 0, cur: null, rng,
    holdFor: opts.still ? Infinity : opts.hold, pointMax: Math.hypot(rr[2] - rr[0], rr[3] - rr[1]) / 2 + 200,
  };
  describe();
}

function record(entry) {
  const last = history[history.length - 1];
  // a resize redraws the same floor: one entry
  if (last && last.seed === entry.seed && last.c.kind === entry.c.kind) history[history.length - 1] = entry;
  else history.push(entry);
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  saveHistory();
  showRecord();
}

function label(e) {
  const k = e.c.kind;
  const v = e.c[k + '.shape'] || e.c[k + '.design'] || e.c[k + '.rule'] || '';
  const m = MATERIALS.find(x => x.id === e.c.material);
  return [TILINGS[k] ? TILINGS[k].name : k, v, m ? m.short : ''].filter(Boolean).join(' · ');
}

function showRecord() {
  const counts = {};
  for (const e of history) counts[e.c.kind] = (counts[e.c.kind] || 0) + 1;
  $('count').textContent = `${history.length} floor${history.length === 1 ? '' : 's'} so far: `
    + Object.keys(TILINGS).filter(k => counts[k]).map(k => `${TILINGS[k].name} ${counts[k]}`).join(', ') + '.';
  const ol = $('recent');
  ol.textContent = '';
  history.slice(-8).reverse().forEach((e, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label(e);
    b.title = `Lay this floor again · seed ${e.seed} · ${new Date(e.t).toLocaleString()}`;
    if (i === 0) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => newFloor(e.seed, e));
    li.append(b);
    ol.append(li);
  });
}

function describe() {
  const f = floor;
  const total = f.stones.length;
  const done = run.phase === 'hold' || run.phase === 'point' || run.phase === 'outro' ? total : run.next;
  panel.querySelector('.what').textContent = `${f.tiling.describe}`;
  panel.querySelector('.how').textContent = `${f.material.name} · ${f.tiling.how} · ${done}/${total} stones · seed ${f.seed}`;
}

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function startStone() {
  const st = run.stones[run.next];
  const outer = st.outer;
  // the mason brings the stone from the side not yet laid
  const ang = Math.atan2(st.from[1], st.from[0]) + (run.rng() - 0.5) * 1.1;
  const reach = PITCH * (0.55 + 0.35 * run.rng());
  const dir = [Math.cos(ang), Math.sin(ang)];
  run.cur = {
    t: 0, dir, outer,
    sx: dir[0] * reach, sy: dir[1] * reach,
    yaw0: (run.rng() - 0.5) * 0.5,
    tilt0: 0.14 + 0.1 * run.rng(),               // held with the leading edge lower
    lift0: 170 + 90 * run.rng(),
  };
}

function animateStone(dt) {
  // the open field around the pattern goes faster
  const c = run.cur, D = (c.outer ? 0.7 : 1.1) / opts.speed;
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
        describe();
      }
      if (run.cur) animateStone(opts.freeze ? 0 : dt);
      else if (run.wait > 0) run.wait -= dt;
      else if (run.next < run.stones.length) startStone();
      else { run.phase = 'point'; run.t = 0; describe(); }
      break;
    case 'point': {
      // joints filled in a sweep out from the centre
      run.t += dt;
      const r = run.t / (14 / opts.speed) * run.pointMax;
      renderer.setPointing(r);
      if (r >= run.pointMax) { renderer.setPointing(1e9); run.phase = 'hold'; run.t = 0; }
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
    if (!paused) orbit.tick(dt);
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
  // anything done to the screen keeps a finished floor a while longer
  if (run && run.phase === 'hold') run.t = 0;
  document.body.classList.add('awake');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => document.body.classList.remove('awake'), 3000);
}
window.addEventListener('mousemove', wake);
window.addEventListener('touchstart', wake, { passive: true });

const $ = id => document.getElementById(id);
function openPanel(open) {
  panel.hidden = !open;
  gear.hidden = open;
  gear.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('open', open);
  if (open) $('close').focus(); else gear.focus({ preventScroll: true });
}
gear.addEventListener('click', () => openPanel(true));
$('close').addEventListener('click', () => openPanel(false));

function setSpeed(level) {
  opts.speed = SPEEDS[level - 1];
  store.set('speed', level);
  showSpeed();
}
function showSpeed() {
  for (const b of $('speed').querySelectorAll('button')) b.setAttribute('aria-checked', String(SPEEDS[+b.dataset.level - 1] === opts.speed));
}
$('speed').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.level); });

function setPaused(p) {
  paused = p;
  $('pause').setAttribute('aria-pressed', String(p));
  $('pause').textContent = p ? 'Paused' : 'Pause';
}
$('pause').addEventListener('click', () => setPaused(!paused));

function setTurning(on) {
  opts.spin = on ? (qs.has('spin') && +qs.get('spin') > 0 ? +qs.get('spin') : 3) : 0;
  orbit.home.spin = on ? Math.PI * 2 / (opts.spin * 60) : 0;
  if (on) orbit.idle = Orbit.RESUME;
  store.set('turning', on ? '1' : '0');
  $('spin').setAttribute('aria-pressed', String(on));
}
$('spin').addEventListener('click', () => setTurning(!(orbit.home.spin > 0)));

function resetView() { orbit.reset(true); orbit.idle = Orbit.RESUME; }
$('reset').addEventListener('click', resetView);

const another = () => newFloor((Math.random() * 2 ** 32) >>> 0);
$('again').addEventListener('click', another);
$('stones').value = opts.material || '';
$('stones').addEventListener('change', e => {
  opts.material = e.target.value || null;
  store.set('stones', e.target.value);
  // a material from the other family brings tiles it suits
  const fam = familyOf(e.target.value);
  if (fam && opts.tiles && TILINGS[opts.tiles] && TILINGS[opts.tiles].family !== fam) { opts.tiles = null; $('tiles').value = ''; store.set('tiles', ''); }
  another();
});
$('tiles').value = opts.tiles || '';
$('tiles').addEventListener('change', e => {
  opts.tiles = e.target.value || null;
  store.set('tiles', e.target.value);
  // tiles of the other family bring a material that suits them
  const fam = opts.tiles && TILINGS[opts.tiles] && TILINGS[opts.tiles].family;
  if (fam && opts.material && familyOf(opts.material) !== fam) {
    opts.material = null; $('stones').value = ''; store.set('stones', '');
  }
  another();
});

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
}
if (!document.fullscreenEnabled) $('full').hidden = true;
$('full').addEventListener('click', toggleFull);
document.addEventListener('fullscreenchange', () => { $('full').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; });

window.addEventListener('keydown', e => {
  if (e.target.closest?.('select')) return;
  if (e.key === 'Escape' && !panel.hidden) openPanel(false);
  else if (e.key === 'n' || e.key === 'N') another();
  else if (e.key === ' ' && !e.target.closest?.('button')) { setPaused(!paused); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') resetView();
  else if (e.key === 'f' || e.key === 'F') toggleFull();
  else if (e.key >= '1' && e.key <= '5') setSpeed(+e.key);
  wake();
});
showSpeed();
$('spin').setAttribute('aria-pressed', String(opts.spin > 0));

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  // the same floor, drawn again for the new size
  resizeTimer = setTimeout(() => newFloor(seed, floor && { c: floor.choices }), 400);
});

// A lost GPU context (driver reset, long sleep) takes every texture with it: start afresh.
canvas.addEventListener('webglcontextlost', e => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());

newFloor(seed);
requestAnimationFrame(loop);

// for inspection from the console
window.douat = {
  get floor() { return floor; }, get run() { return run; }, get history() { return history; }, renderer, orbit, newFloor, LETTERS,
  // arguments for tools/measure_render.py, for the view from above (?photo)
  measureArgs() {
    const v = floor.view, px = renderer.H / (2 * Math.tan(v.fovY / 2) * v.dist);
    // the half-square states of the pattern area, read back from the placed dark stones
    const P = PITCH, g = new Array(v.NX * v.NY).fill(0);
    for (const st of floor.stones) {
      if (st.cls !== 'dark' || st.outer) continue;
      const i = Math.floor((st.center[0] - v.origin[0]) / P), j = Math.floor((st.center[1] - v.origin[1]) / P);
      // where the right angle (class frame (-1, 1)) lands: BL 0, TL 1, TR 2, BR 3
      const x = -st.L[0] + st.L[2], y = -st.L[1] + st.L[3];
      g[j * v.NX + i] = x < 0 ? (y > 0 ? 0 : 1) : (y < 0 ? 2 : 3);
    }
    return [px * P, v.NX, v.NY, g.join('')].join(' ');
  },
};
