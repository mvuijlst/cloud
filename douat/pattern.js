// Douat-style compositions of the diagonally halved square.
// States follow Douat's key: the dark triangle's right angle sits at
// A bottom-left, B top-left, C top-right, D bottom-right.
// The construction follows research/study.md: words of tiles repeated in rows, a short
// cycle of rows derived from each other, or a seed reflected about the centre.

export const LETTERS = 'ABCD';
const MX = [3, 2, 1, 0];   // left-right mirror of one tile
const MY = [1, 0, 3, 2];   // top-bottom mirror
const TR = [2, 1, 0, 3];   // reflection in the main diagonal (swap x and y)

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const mod = (a, n) => ((a % n) + n) % n;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const word = w => w.map(s => LETTERS[s]).join('');

// Relations between words that Douat's recipes use or imply.
const OPS = {
  copy: w => w.slice(),
  complement: w => w.map(s => (s + 2) & 3),
  mirror: w => w.slice().reverse().map(s => MX[s]),
  flip: w => w.map(s => MY[s]),
  turn: w => w.map(s => (s + 1) & 3),
  shift: w => w.slice(1).concat(w.slice(0, 1)),
  swap: w => w.slice(w.length / 2).concat(w.slice(0, w.length / 2)),
};

function randomWord(rng, n) {
  for (;;) {
    const w = Array.from({ length: n }, () => Math.floor(rng() * 4));
    if (n === 1 || new Set(w).size > 1) return w;
  }
}

function repeatProgram(rng) {
  let base = randomWord(rng, pick(rng, [2, 2, 4, 4, 4]));
  let pair = null;
  if (rng() < 0.22) {
    // design 5: alternate a word with a relative of itself
    pair = pick(rng, ['complement', 'mirror', 'flip', 'turn']);
    base = base.concat(OPS[pair](base));
  }
  const h = pick(rng, [1, 2, 2, 2, 4, 4]);
  const rows = [base];
  const ops = [];
  for (let r = 1; r < h; r++) {
    const op = pick(rng, ['complement', 'mirror', 'flip', 'shift', 'turn', 'swap', 'copy']);
    rows.push(OPS[op](rows[r - 1]));
    ops.push(op);
  }
  const w = base.length;
  return {
    kind: 'rows',
    describe: `rows of ${w}${pair ? ` (word and its ${pair})` : ''}, cycle of ${h}: ${rows.map(word).join(' / ')}`,
    at: (x, y) => rows[mod(y, h)][mod(x, w)],
    period: [w, h],
  };
}

// A k×k seed in the bottom-right quadrant, reflected about both axes through the
// floor centre and folded back on itself beyond k, as in a kaleidoscope.
function centredProgram(rng) {
  const k = pick(rng, [3, 4, 4, 5, 6, 6]);
  const fam = pick(rng, ['diagonals', 'squares', 'crosses', 'symmetric']);
  const m = pick(rng, [2, 2, 3, 4]);
  const tab = randomWord(rng, m);
  const seed = [];
  for (let y = 0; y < k; y++) {
    seed.push([]);
    for (let x = 0; x < k; x++) {
      let s;
      if (fam === 'diagonals') s = tab[(x + y) % m];
      else if (fam === 'squares') s = tab[Math.max(x, y) % m];
      else if (fam === 'crosses') s = tab[Math.min(x, y) % m];
      else s = x >= y ? Math.floor(rng() * 4) : TR[seed[x][y]];
      seed[y].push(s);
    }
  }
  if (fam !== 'symmetric' && rng() < 0.5) {
    // break the rule once along the diagonal, as Douat's centred plates do
    for (let i = 0; i < k; i++) seed[i][i] = (seed[i][i] + 2) & 3;
  }
  const fold = (d) => {
    const q = mod(d, 2 * k);
    return q < k ? [q, false] : [2 * k - 1 - q, true];
  };
  return {
    kind: 'centred',
    describe: `${k}×${k} seed of ${fam} reflected about the centre: ${seed.map(word).join(' / ')}`,
    centred: true,
    at: (x, y, cx, cy) => {
      let dx = x - cx, dy = y - cy, mx = false, my = false;
      if (dx < 0) { dx = -dx - 1; mx = true; }
      if (dy < 0) { dy = -dy - 1; my = true; }
      const [ix, fx] = fold(dx), [iy, fy] = fold(dy);
      let s = seed[iy][ix];
      if (mx !== fx) s = MX[s];
      if (my !== fy) s = MY[s];
      return s;
    },
  };
}

function bandProgram(rng) {
  const m = pick(rng, [2, 3, 4, 4, 6]);
  const tab = randomWord(rng, m);
  const a = pick(rng, [1, 1, 2]), b = pick(rng, [1, 1, -1, 2, 0]);
  const chevron = rng() < 0.4;
  return {
    kind: 'bands',
    describe: `${chevron ? 'chevron ' : ''}bands ${a}x${b >= 0 ? '+' : ''}${b}y over ${word(tab)}`,
    centred: chevron,
    at: (x, y, cx) => {
      if (chevron) {
        const left = x < cx;
        const dx = left ? cx - 1 - x : x - cx;
        const s = tab[mod(a * dx + b * y, m)];
        return left ? MX[s] : s;
      }
      return tab[mod(a * x + b * y, m)];
    },
  };
}

// Whole-field symmetries and crop phase; a composition is the same under these.
function dress(rng, prog, NX, NY) {
  const cx = NX / 2, cy = NY / 2;
  const transpose = !prog.centred && rng() < 0.3;
  const comp = rng() < 0.5;
  const px = prog.centred ? 0 : Math.floor(rng() * 8), py = prog.centred ? 0 : Math.floor(rng() * 8);
  return (x, y) => {
    let s = transpose ? TR[prog.at(y + py, x + px, cy, cx)] : prog.at(x + px, y + py, cx, cy);
    if (comp) s = (s + 2) & 3;
    return s;
  };
}

function interesting(grid, NX, NY) {
  const n = [0, 0, 0, 0];
  for (const s of grid) n[s]++;
  const used = n.filter(x => x > 0).length;
  return used >= 2 && Math.max(...n) / grid.length < 0.8;
}

export function samplePattern(rng, NX, NY) {
  for (let tries = 0; tries < 50; tries++) {
    const r = rng();
    const prog = r < 0.45 ? repeatProgram(rng) : r < 0.8 ? centredProgram(rng) : bandProgram(rng);
    const at = dress(rng, prog, NX, NY);
    const grid = new Uint8Array(NX * NY);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) grid[y * NX + x] = at(x, y);
    if (interesting(grid, NX, NY) || tries === 49) return { grid, at, kind: prog.kind, describe: prog.describe, centred: !!prog.centred };
  }
}

// The order a mason would set the cells: from the far wall, or out from the centre
// line of a symmetric design, or along the diagonal.
export function layingOrder(rng, NX, NY, centred) {
  const cells = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) cells.push([i, j]);
  const cx = NX / 2, cy = NY / 2;
  const mode = centred ? (rng() < 0.75 ? 'centre' : 'rows') : pick(rng, ['rows', 'rows', 'diagonal', 'centre']);
  const flipX = rng() < 0.5;
  let key;
  if (mode === 'rows') key = ([i, j]) => j * NX + (flipX ? NX - 1 - i : i);
  else if (mode === 'diagonal') key = ([i, j]) => ((flipX ? NX - 1 - i : i) + j) * NX + j;
  else key = ([i, j]) => {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
    const ring = Math.max(Math.abs(dx), Math.abs(dy));
    return ring * 1000 + mod(Math.atan2(dy, dx) + Math.PI * 0.75, Math.PI * 2);
  };
  cells.sort((a, b) => key(a) - key(b));
  return { mode, cells };
}
