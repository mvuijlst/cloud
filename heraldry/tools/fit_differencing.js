// Fits the differencing moves' weights (H.DIFF_W in grammar.js) to the rolls' own complex coats.
//
// node tools/fit_differencing.js [iterations=14] [seeds=3000]
//
// Target: the unquartered coats of the generator's roll (the pooled late-fifteenth-century armorials) with
// three elements or more (complexity() in grammar.js). For each element, the share of those coats that
// carry it. Each roll's weights start at 1; every round draws the differenced skeletons of seeds 1..n,
// measures the same shares on the unquartered ones, and scales the weight of each move by
// (target / generated)^0.8, kept within a factor of two per round, for the element that move adds.
// Prints the fitted weights, to be copied into H.DIFF_W, and the shares they give.
global.self = global;
const path = require('path');
for (const f of ['geometry', 'charges', 'charges-art', 'render', 'arms-data', 'names-data', 'grammar']) require(path.join(__dirname, '..', f + '.js'));
const H = global.Heraldry;
const iters = +(process.argv[2] || 14), N = +(process.argv[3] || 3000);

const FEATURES = {
  divided: s => s.f.k !== 'plain',
  several: s => !!(s.m && s.m.n > 1),
  principal: s => !!s.m,
  ordinary: s => !!s.o,
  on: s => !!s.on,
  between: s => !!s.ar,
  chief: s => !!s.c,
  chiefCharged: s => !!(s.c && s.c.on),
  bordure: s => !!s.b,
  label: s => !!s.lb,
  canton: s => !!s.cn,
};
const MOVE_FEATURE = {
  divide: 'divided', multiply: 'several', charge: 'principal', ordinary: 'ordinary', on: 'on', between: 'between',
  accompanied: 'between', chief: 'chief', chiefCharges: 'chiefCharged', bordure: 'bordure', label: 'label', canton: 'canton',
};
const shares = (list) => {
  const out = {}; let tot = 0;
  for (const [s, w] of list) { tot += w; for (const [k, f] of Object.entries(FEATURES)) if (f(s)) out[k] = (out[k] || 0) + w; }
  for (const k of Object.keys(FEATURES)) out[k] = (out[k] || 0) / tot;
  return out;
};

const pool = [];
for (const [s, c] of H.DATA.late.skeletons) if (!s.q && H.complexity(s) >= 3) pool.push([s, c]);
const target = shares(pool);
console.log('target from', pool.reduce((a, [, c]) => a + c, 0), 'roll coats:', JSON.stringify(Object.fromEntries(Object.entries(target).map(([k, v]) => [k, +v.toFixed(3)]))));

const fitted = {};
for (const roll of ['late']) {
  const W = Object.fromEntries(Object.keys(MOVE_FEATURE).map(k => [k, 1]));
  let gen;
  for (let it = 0; it <= iters; it++) {
    H.DIFF_W[roll] = W;
    const list = [];
    for (let s = 1; s <= N; s++) { const sk = H.skeletonFor(s, roll); if (!sk.q) list.push([sk, 1]); }
    gen = shares(list);
    if (it === iters) break;
    for (const [m, f] of Object.entries(MOVE_FEATURE)) {
      const ratio = Math.pow((target[f] + 0.005) / (gen[f] + 0.005), 0.8);
      W[m] = Math.min(50, Math.max(0.01, W[m] * Math.min(2, Math.max(0.5, ratio))));
    }
  }
  fitted[roll] = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, +v.toFixed(3)]));
  console.log(`\n${roll}: weights`, JSON.stringify(fitted[roll]));
  console.log('  element        target  generated');
  for (const k of Object.keys(FEATURES)) console.log(`  ${k.padEnd(14)} ${(100 * target[k]).toFixed(1).padStart(5)}%  ${(100 * gen[k]).toFixed(1).padStart(5)}%`);
}
console.log('\nH.DIFF_W =', JSON.stringify(fitted));
