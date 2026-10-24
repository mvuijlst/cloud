"""Score an encoding against its source crop and write an overlay.

Usage: score.py ID [ID ...]        reads encodings/ID.json, writes data/overlays/ID.png
       score.py --all              scores every encoding, writes data/encoding_scores.csv

Metrics (pixel scale of the source crop, stroke = measured source stroke width):
  iou_d1         IoU of source and rendered ink, both dilated by 1 px
  cov            fraction of source skeleton pixels within 0.75 stroke of rendered ink
  prec           fraction of rendered skeleton pixels within 0.75 stroke of source ink
  d_src2ren      mean distance from source skeleton to rendered ink, in stroke widths
  d_ren2src      mean distance from rendered skeleton to source ink, in stroke widths
Predeclared acceptance for a reconstruction: cov >= 0.85, prec >= 0.85, iou_d1 >= 0.55.
"""
import csv
import json
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ACCEPT = dict(cov=0.85, prec=0.85, iou_d1=0.55)


def tight(g):
    m = g < 128
    ys, xs = np.nonzero(m)
    return g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def score_one(cid, man, write_overlay=True):
    src = tight(cv2.imread(str(ROOT / man[cid]['crop_file']), cv2.IMREAD_GRAYSCALE))
    h, w = src.shape
    enc = sigil.load(ROOT / 'encodings' / f'{cid}.json')
    ren = sigil.render(enc, h, pad=0)
    # align sizes (aspect rounding): pad to common size
    H = max(h, ren.shape[0]); W = max(w, ren.shape[1])
    S = np.full((H, W), 255, np.uint8); S[:h, :w] = src
    R = np.full((H, W), 255, np.uint8); R[:ren.shape[0], :ren.shape[1]] = ren
    sm = S < 128; rm = R < 128
    sk_s = skeletonize(sm); sk_r = skeletonize(rm)
    dt_s = ndi.distance_transform_edt(~sm); dt_r = ndi.distance_transform_edt(~rm)
    stroke = float(np.median(2 * ndi.distance_transform_edt(sm)[sk_s])) if sk_s.any() else 4.0
    tol = 0.75 * stroke
    cov = float((dt_r[sk_s] <= tol).mean()) if sk_s.any() else 0.0
    prec = float((dt_s[sk_r] <= tol).mean()) if sk_r.any() else 0.0
    d_sr = float(dt_r[sk_s].mean() / stroke) if sk_s.any() else 9.9
    d_rs = float(dt_s[sk_r].mean() / stroke) if sk_r.any() else 9.9
    k = np.ones((3, 3), bool)
    sd = ndi.binary_dilation(sm, k); rd = ndi.binary_dilation(rm, k)
    iou = float(np.logical_and(sd, rd).sum() / max(1, np.logical_or(sd, rd).sum()))
    counts = sigil.count_members(enc)
    res = dict(id=cid, cov=round(cov, 3), prec=round(prec, 3), iou_d1=round(iou, 3),
               d_src2ren=round(d_sr, 3), d_ren2src=round(d_rs, 3), stroke_px=round(stroke, 2),
               accepted=bool(cov >= ACCEPT['cov'] and prec >= ACCEPT['prec'] and iou >= ACCEPT['iou_d1']),
               primitives=counts['primitives'], escapes=counts['escapes'], repeats=counts['repeats'], mirrors=counts['mirrors'],
               family_by_eye=enc.get('family_by_eye', ''))
    if write_overlay:
        Z = 3
        ov = np.full((H * Z, W * Z, 3), 255, np.uint8)
        Sb = cv2.resize(S, (W * Z, H * Z), interpolation=cv2.INTER_NEAREST) < 128
        Rb = cv2.resize(R, (W * Z, H * Z), interpolation=cv2.INTER_NEAREST) < 128
        ov[Sb] = (190, 190, 190)          # source only: grey
        ov[Rb] = (0, 0, 255)              # render only: red
        ov[Sb & Rb] = (40, 40, 40)        # both: dark
        head = np.full((22, W * Z, 3), 255, np.uint8)
        txt = f'{cid} cov={cov:.2f} prec={prec:.2f} iou={iou:.2f} prim={counts["primitives"]} esc={counts["escapes"]} {"OK" if res["accepted"] else "--"}'
        cv2.putText(head, txt, (4, 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        (ROOT / 'data' / 'overlays').mkdir(exist_ok=True, parents=True)
        cv2.imwrite(str(ROOT / 'data' / 'overlays' / f'{cid}.png'), np.vstack([head, ov]))
        # also the plain render and svg next to the encoding
        (ROOT / 'encodings' / 'render').mkdir(exist_ok=True, parents=True)
        cv2.imwrite(str(ROOT / 'encodings' / 'render' / f'{cid}.png'), sigil.render(enc, 300))
        (ROOT / 'encodings' / 'svg').mkdir(exist_ok=True, parents=True)
        (ROOT / 'encodings' / 'svg' / f'{cid}.svg').write_text(sigil.to_svg(enc), encoding='utf-8', newline='\n')
    return res


def main():
    man = {c['id']: c for c in json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))['cells']}
    if sys.argv[1:] == ['--all']:
        ids = sorted(p.stem for p in (ROOT / 'encodings').glob('*.json'))
        rows = [score_one(cid, man) for cid in ids]
        with open(ROOT / 'data' / 'encoding_scores.csv', 'w', newline='\n', encoding='utf-8') as fh:
            wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)
        acc = sum(r['accepted'] for r in rows)
        print(f'{len(rows)} encodings, {acc} accepted; mean cov {np.mean([r["cov"] for r in rows]):.3f} prec {np.mean([r["prec"] for r in rows]):.3f} iou {np.mean([r["iou_d1"] for r in rows]):.3f}; escapes total {sum(r["escapes"] for r in rows)}')
    else:
        for cid in sys.argv[1:]:
            print(score_one(cid, man))


if __name__ == '__main__':
    main()
