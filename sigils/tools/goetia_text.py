"""The 72 entries of the Goetia as text, from Peterson's transcription of Sloane 3825.

    python tools/goetia_text.py

Source: witnesses/peterson_sloane3825/goetia_peterson.html (Joseph H. Peterson,
esotericarchives.com; transcription CC-BY 4.0). Each entry is the <P id=...>
paragraph of the catalogue, up to the end of its table cell, plus the formula
under its seal ("This is his seal..."); the notes in the neighbouring cell are
left out. Superscript abbreviations are expanded (y^e -> the, y^t -> that,
w^ch -> which, w^th -> with); spelling is otherwise the manuscript's.

Writes data/goetia_entries_raw.json: [{n, id, name, text, seal_formula}].
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'witnesses' / 'peterson_sloane3825' / 'goetia_peterson.html'
SUP = {'e': 'the', 't': 'that', 'ch': 'which', 'th': 'with', 'm': 'them', 'r': 'your', 'u': 'you'}


def clean(s):
    s = re.sub(r'y<SUP>(e|t|m|r|u)</SUP>', lambda m: SUP[m.group(1)], s, flags=re.I)
    s = re.sub(r'w<SUP>(ch|th)</SUP>', lambda m: SUP[m.group(1)], s, flags=re.I)
    s = re.sub(r'<SUP>\d+</SUP>', '', s)                    # footnote marks
    s = re.sub(r'<SUP>([^<]*)</SUP>', r'\1', s)
    s = re.sub(r'<em class="pg"[^>]*>\[[^\]]*\]</em>', '', s)  # folio marks
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def main():
    raw = SRC.read_text(encoding='latin-1')
    start = raw.find('id=catalog')
    blocks = list(re.finditer(r'<P id=([A-Za-z_]+)>', raw[start:]))
    entries = []
    for k, m in enumerate(blocks):
        a = start + m.end()
        cell_end = raw.find('</TD>', a)
        body = clean(raw[a:cell_end])
        nxt = start + blocks[k + 1].start() if k + 1 < len(blocks) else len(raw)
        rest = raw[cell_end:nxt]
        fm = re.search(r'<P>\s*(This is[^<]*(?:<SUP>[^<]*</SUP>[^<]*)*)', rest)
        name = re.search(r'<STRONG>([^<]+)</STRONG>', raw[a:cell_end])
        entries.append(dict(id=m.group(1), name=clean(name.group(1)) if name else None, text=body,
                            seal_formula=clean(fm.group(1)) if fm else None))
        if len(entries) == 72:
            break
    for n, e in enumerate(entries, 1):
        e['n'] = n
    (ROOT / 'data' / 'goetia_entries_raw.json').write_text(json.dumps(entries, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
    print(len(entries), 'entries;', entries[0]['name'], '...', entries[-1]['name'])
    print('without a name:', [e['id'] for e in entries if not e['name']])


if __name__ == '__main__':
    main()
