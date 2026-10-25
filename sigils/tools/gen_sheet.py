"""Contact sheet of a folder of encodings, rendered exact-width (stroke x 0.75).

    python tools/gen_sheet.py <folder> <out.png> [--cols 10] [--h 120]
"""
import sys
from pathlib import Path
import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402
from acceptance import scale_stroke, STROKE_K  # noqa: E402


def sheet(paths, out, cols=10, h=120, labels=True):
    cw = int(h * 1.75); ch = h + (26 if labels else 12)
    rows = (len(paths) + cols - 1) // cols
    img = np.full((rows * ch + 10, cols * cw + 10), 255, np.uint8)
    for i, p in enumerate(paths):
        enc = sigil.load(p)
        r = sigil.render(scale_stroke(enc, STROKE_K), h - 12, pad=0, exact=True)
        if r.shape[1] > cw - 10:
            r = cv2.resize(r, (cw - 10, int(r.shape[0] * (cw - 10) / r.shape[1])), interpolation=cv2.INTER_AREA)
        y = (i // cols) * ch + (20 if labels else 6); x = (i % cols) * cw + 5 + (cw - r.shape[1]) // 2
        img[y:y + r.shape[0], x:x + r.shape[1]] = np.minimum(img[y:y + r.shape[0], x:x + r.shape[1]], r)
        if labels:
            cv2.putText(img, f"{enc.get('id', p.stem)} {enc.get('family', enc.get('family_by_eye', ''))}", ((i % cols) * cw + 6, (i // cols) * ch + 13),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, 90, 1, cv2.LINE_AA)
    cv2.imwrite(str(out), img)


if __name__ == '__main__':
    a = sys.argv
    cols = int(a[a.index('--cols') + 1]) if '--cols' in a else 10
    h = int(a[a.index('--h') + 1]) if '--h' in a else 120
    sheet(sorted(Path(a[1]).glob('*.json')), a[2], cols, h)
