// node tools/dump_samples.js <out.json> [n=500] [first seed=1]
// Draws n coats per roll with the browser's own code and writes them with their blazon, key and matches.
global.self = global;
const path = require('path');
for (const f of ['geometry', 'charges', 'charges-art', 'render', 'arms-data', 'grammar']) require(path.join(__dirname, '..', f + '.js'));
const H = global.Heraldry;
const out = process.argv[2], n = +(process.argv[3] || 500), first = +(process.argv[4] || 1);
const res = {};
for (const roll of ['zurich', 'grunenberg']) {
  res[roll] = [];
  const t0 = Date.now();
  for (let s = first; s < first + n; s++) {
    const a = H.sample(s, roll);
    const raw = H.sample(s, roll, { redraw: false });
    res[roll].push({ seed: s, arms: a, blazon: H.blazon(a), key: H.canonical(a), also: H.alsoBorneBy(a).length, rawAlso: H.alsoBorneBy(raw).length, draw: a.draw, name: H.nameFor(s, roll) });
  }
  const t1 = Date.now();
  for (let s = first; s < first + 100; s++) { H.renderSVG(res[roll][s - first].arms, 'engraved'); H.renderSVG(res[roll][s - first].arms, 'colour'); }
  const t2 = Date.now();
  console.log(roll, 'sample ms/coat', ((t1 - t0) / n / 2).toFixed(2), 'render ms/coat (both styles)', ((t2 - t1) / 100).toFixed(2));
}
require('fs').writeFileSync(out, JSON.stringify(res));
console.log('wrote', out);
