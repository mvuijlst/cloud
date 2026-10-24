"""Crop the 80 drawings out of 72_Goeta_sigils.png.

Writes data/crop_manifest.json (integer rectangles in original pixels),
crops/NN.png (one per drawing, tight bounding box, no label), and
data/crop_qa.png (the sheet with rectangles drawn for visual QA).

Method: label text lines are found as horizontal clusters of small connected
components; each label line is split into 10 labels by x gaps; a cell is the
band below its label line, between the label x-starts; the drawing rectangle
is the union of non-label components whose centre falls in that cell.
"""
import json
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / '72_Goeta_sigils.png'
THRESH = 128

# Sheet labels, row-major, read from the image. Identity number, variant, label text.
LABELS = [
 (1,'a','Bael'),(2,'a','Agares/Agreas'),(3,'a','Vassago'),(4,'a','Samigina/Gamigin'),(5,'a','Marbas'),
 (6,'a','Valefor'),(7,'a','Amon'),(8,'a','Barbatos'),(9,'a','Paimon'),(9,'b','Paimon'),
 (10,'a','Buer'),(11,'a','Gusion'),(12,'a','Sitri'),(13,'a','Beleth/Bileth/Bilet'),(13,'b','Beleth/Bileth/Bilet'),
 (14,'a','Leraje/Leraie/Leraikha'),(14,'b','Leraje/Leraie/Leraikha'),(15,'a','Eligos'),(16,'a','Zepar'),(17,'a','Botis'),
 (18,'a','Bathin'),(18,'b','Bathin'),(19,'a','Sallos/Saleos'),(20,'a','Purson'),(21,'a','Marax/Morax'),
 (22,'a','Ipos'),(23,'a','Aim'),(24,'a','Naberius'),(25,'a','Glasya-Labolas'),(26,'a','Bune/Bimé/Buné/Bim'),
 (26,'b','Bune/Bimé/Buné/Bim'),(27,'a','Ronové'),(28,'a','Berith/Beale/Beal/Bofry/Bolfry'),(29,'a','Astaroth'),(30,'a','Forneus'),
 (31,'a','Foras'),(32,'a','Asmoday/Asmodai'),(33,'a','Gaap/Gäap'),(34,'a','Furfur'),(35,'a','Marchosias'),
 (36,'a','Stolas/Stolos'),(37,'a','Phenex/Pheynix'),(38,'a','Halphas/Malthus/Malthous/Malthas'),(39,'a','Malphas'),(40,'a','Raum/Räum'),
 (41,'a','Focalor/Forcalor/Furcalor'),(42,'a','Vepar/Vephar'),(42,'b','Vepar/Vephar'),(43,'a','Sabnock/Savnok'),(44,'a','Shan/Shax/Shaz/Shass'),
 (45,'a','Viné/Vinea'),(46,'a','Bifrons/Bifröus/Bifrovs'),(47,'a','Uvall/Vual/Voval'),(47,'b','Uvall/Vual/Voval'),(48,'a','Haagenti'),
 (49,'a','Crocell/Crokel'),(50,'a','Furcas'),(51,'a','Balam/Balaam'),(52,'a','Alloces/Alocas'),(53,'a','Camio/Caim'),
 (54,'a','Murmur/Murmus/Murmux'),(55,'a','Orobas'),(56,'a','Gremory/Gamori'),(57,'a','Osé/Voso/Oso'),(58,'a','Amy/Avnas'),
 (59,'a','Oriax/Orias'),(60,'a','Vapula/Naphula'),(61,'a','Zagan'),(62,'a','Volac/Valak/Valu/Ualac/Valac'),(63,'a','Andras'),
 (64,'a','Haures/Hauras/Havres/Flauros'),(65,'a','Andrealphus'),(66,'a','Cimejes/Cimeies/Kimaris'),(67,'a','Amdusias/Amdukias'),(68,'a','Belial'),
 (69,'a','Decarabia'),(70,'a','Seere/Sear/Seir'),(70,'b','Seere/Sear/Seir'),(71,'a','Dantalion'),(72,'a','Andromalius'),
]
assert len(LABELS) == 80


def main():
    img = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
    H, W = img.shape
    ink = (img < THRESH).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(ink, connectivity=8)
    st = stats[1:]; ce = cent[1:]
    x, y, w, h, a = st[:, 0], st[:, 1], st[:, 2], st[:, 3], st[:, 4]

    # 1. label text components: small glyphs arranged in dense horizontal lines
    small = (h <= 22) & (w <= 40) & (a <= 260)
    cy = ce[:, 1]
    hist, edges = np.histogram(cy[small], bins=np.arange(0, H + 4, 4))
    thr = 25
    lines = []
    i = 0
    while i < len(hist):
        if hist[i] >= thr:
            j = i
            while j + 1 < len(hist) and hist[j + 1] >= thr:
                j += 1
            lines.append((edges[i], edges[j + 1]))
            i = j + 1
        else:
            i += 1
    assert len(lines) == 8, f'expected 8 label lines, found {len(lines)}: {lines}'
    label_lines = []
    for (ya, yb) in lines:
        m = small & (cy >= ya - 6) & (cy < yb + 6)
        label_lines.append(dict(top=int(y[m].min()), bottom=int((y[m] + h[m]).max()), members=np.where(m)[0]))

    # 2. split each label line into 10 labels by x gaps
    cells = []
    for r, L in enumerate(label_lines):
        idx = L['members']
        order = idx[np.argsort(x[idx])]
        # ten labels per line: split at the nine largest inter-glyph gaps
        gaps = np.array([x[k] - (x[p] + w[p]) for p, k in zip(order[:-1], order[1:])])
        cut = set(np.argsort(gaps)[-9:].tolist())
        groups = [[order[0]]]
        for gi, k in enumerate(order[1:]):
            if gi in cut:
                groups.append([k])
            else:
                groups[-1].append(k)
        assert len(groups) == 10, f'row {r}: {len(groups)} labels'
        assert gaps[sorted(cut)[0]] >= 14, f'row {r}: smallest label gap {gaps[sorted(cut)[0]]} px is ambiguous'
        starts = [int(x[g].min()) for g in groups]
        ends = [int((x[g] + w[g]).max()) for g in groups]
        band_top = L['bottom']
        band_bottom = label_lines[r + 1]['top'] if r + 1 < 8 else H
        for c in range(10):
            cells.append(dict(row=r, col=c, label_x0=starts[c], label_x1=ends[c],
                              label_y0=L['top'], label_y1=L['bottom'],
                              band_top=int(band_top), band_bottom=int(band_bottom)))

    # 3. column boundaries per row: nearest ink-free column to (next label start - 12)
    label_members = set(int(k) for L in label_lines for k in L['members'])
    # larger-font labels (e.g. '18. Bathin') escape the small-glyph histogram: any component
    # lying entirely inside a label line's vertical band (+-8 px) is label text too
    for L in label_lines:
        inside = (y >= L['top'] - 8) & (y + h <= L['bottom'] + 8) & (h <= 30)
        label_members |= set(np.where(inside)[0].tolist())
    nolabel = ink.copy()
    for k in label_members:
        nolabel[y[k]:y[k] + h[k], x[k]:x[k] + w[k]] = 0
    for r in range(8):
        rc = [c for c in cells if c['row'] == r]
        band = nolabel[rc[0]['band_top']:rc[0]['band_bottom'], :]
        col_ink = band.sum(axis=0)
        bounds = [0]
        for c in range(1, 10):
            target = rc[c]['label_x0'] - 12
            lo, hi = rc[c - 1]['label_x0'] + 20, rc[c]['label_x0'] + 10
            free = np.where(col_ink[lo:hi] == 0)[0] + lo
            assert len(free), f'row {r} col {c}: no ink-free column between labels'
            b = int(free[np.argmin(np.abs(free - target))])
            bounds.append(b)
        bounds.append(W)
        for c in range(10):
            rc[c]['cell_x0'], rc[c]['cell_x1'] = bounds[c], bounds[c + 1]

    # 4. tight rectangle per cell from non-label components whose centre lies inside
    comp_ids = np.array([k for k in range(len(st)) if k not in label_members])
    cx, cyc = ce[comp_ids, 0], ce[comp_ids, 1]
    manifest = []
    (ROOT / 'crops').mkdir(exist_ok=True)
    for i, c in enumerate(cells):
        m = (cx >= c['cell_x0']) & (cx < c['cell_x1']) & (cyc >= c['band_top']) & (cyc < c['band_bottom'])
        ids = comp_ids[m]
        assert len(ids), f'cell {i}: no components'
        x0 = int(x[ids].min()); y0 = int(y[ids].min())
        x1 = int((x[ids] + w[ids]).max()); y1 = int((y[ids] + h[ids]).max())
        num, var, name = LABELS[i]
        cid = f'{num:02d}{var}'
        pad = 4
        crop = np.full((y1 - y0 + 2 * pad, x1 - x0 + 2 * pad), 255, np.uint8)
        sub_lab = lab[y0:y1, x0:x1]
        sub_img = img[y0:y1, x0:x1]
        keep = np.isin(sub_lab, ids + 1)
        region = crop[pad:pad + (y1 - y0), pad:pad + (x1 - x0)]
        region[keep] = sub_img[keep]
        fringe = (sub_img >= THRESH) & (sub_img < 250)
        region[fringe & ~keep] = sub_img[fringe & ~keep]
        cv2.imwrite(str(ROOT / 'crops' / f'{cid}.png'), crop)
        suffix = var if var == 'b' else ''
        manifest.append(dict(id=cid, identity=num, variant=var, sheet_label=f'{num}{suffix}. {name}',
                             row=c['row'] + 1, col=c['col'] + 1,
                             rect=[x0, y0, x1, y1], width=x1 - x0, height=y1 - y0,
                             crop_file=f'crops/{cid}.png', crop_pad=pad,
                             label_rect=[c['label_x0'], c['label_y0'], c['label_x1'], c['label_y1']],
                             components=int(len(ids))))
    out = dict(source='72_Goeta_sigils.png', source_size=[W, H], threshold=THRESH,
               sha256='6a6df81aef47ef7292df3bf6918e3b004a0876093f6398031cc5ba5accc20995',
               method='label lines from small-glyph clusters; cell = band below label between label x-starts; rect = union of non-label components with centre in cell',
               cells=manifest)
    (ROOT / 'data').mkdir(exist_ok=True)
    (ROOT / 'data' / 'crop_manifest.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')

    qa = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    for m in manifest:
        x0, y0, x1, y1 = m['rect']
        cv2.rectangle(qa, (x0, y0), (x1, y1), (0, 0, 255), 2)
        lx0, ly0, lx1, ly1 = m['label_rect']
        cv2.rectangle(qa, (lx0, ly0), (lx1, ly1), (255, 0, 0), 1)
        cv2.putText(qa, m['id'], (x0, y1 + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 160, 0), 1)
    cv2.imwrite(str(ROOT / 'data' / 'crop_qa.png'), qa)
    print('cells', len(manifest))
    ws = [m['width'] for m in manifest]; hs = [m['height'] for m in manifest]
    print('width  min/med/max', min(ws), int(np.median(ws)), max(ws))
    print('height min/med/max', min(hs), int(np.median(hs)), max(hs))
    cs = [m['components'] for m in manifest]
    print('components per cell min/med/max', min(cs), int(np.median(cs)), max(cs))


if __name__ == '__main__':
    main()
