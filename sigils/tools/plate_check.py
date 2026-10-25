"""Do rendered plates measure like the real ones?

    python tools/plate_check.py [seed ...]

Renders plates with plate.js under Node (no lettering, which needs a browser
canvas; R = 290 px, the scans' size), measures each with tools/plate_ink.py
exactly as the real plates were measured, and compares the ring statistics with
data/plate_ink.json: width variation, edge raggedness, course wander, ring
widths and radii. Writes data/plate_check.json. Requires node on the PATH.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plate_ink  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
R = 290

NODE = r"""
const path = require('path'), fs = require('fs');
const [dir, out, R, ...seeds] = process.argv.slice(1);
require(path.join(dir, 'sigil-data.js')); require(path.join(dir, 'generator.js')); require(path.join(dir, 'plate.js'));
for (const sd of seeds) {
  const enc = Sigils.sealForSeed(+sd), img = Sigils.renderPlate(enc, Sigils.nameForSeed(+sd), +sd, { R: +R, letters: false });
  const g = Buffer.alloc(img.width * img.height);
  for (let i = 0; i < g.length; i++) g[i] = 255 - img.data[4 * i];          // black ink on white, as scanned
  fs.writeFileSync(path.join(out, sd + '.gray'), g);
  fs.writeFileSync(path.join(out, sd + '.json'), JSON.stringify({ w: img.width, h: img.height }));
}
"""

KEYS = ('width_cv', 'edge_rag_rms', 'wobble_rms', 'width')


def ring_means(m):
    return {k: float(np.mean([r[k] for r in m['rings']])) for k in KEYS}


def main():
    seeds = sys.argv[1:] or ['11', '22', '33', '44', '55', '66']
    real = json.loads((ROOT / 'data' / 'plate_ink.json').read_text(encoding='utf-8'))['plates']
    target = {k: float(np.median([ring_means(p)[k] for p in real])) for k in KEYS}
    rows = {}
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(['node', '-e', NODE, str(ROOT), d, str(R), *seeds], check=True)
        for sd in seeds:
            h = json.loads((Path(d) / f'{sd}.json').read_text())
            g = np.fromfile(Path(d) / f'{sd}.gray', np.uint8).reshape(h['h'], h['w'])
            m = plate_ink.measure(sd, g)
            rows[sd] = dict(ring_means(m), radii=[r['radius'] for r in m['rings']])
    got = {k: float(np.median([r[k] for r in rows.values()])) for k in KEYS}
    out = dict(R_px=R, seeds=seeds, target_median_of_plates=target, rendered_median=got,
               ratio={k: round(got[k] / target[k], 3) for k in KEYS}, per_seed=rows)
    (ROOT / 'data' / 'plate_check.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    for k in KEYS:
        print(f'{k:14s} plates {target[k]:.5f}  rendered {got[k]:.5f}  ({got[k] / target[k]:.2f}x)')
    print('ring radii (rendered, first seed):', rows[seeds[0]]['radii'])


if __name__ == '__main__':
    main()
