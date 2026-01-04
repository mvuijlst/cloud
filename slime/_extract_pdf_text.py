from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

pdf_path = Path(r"M:\dev\cloud\slime\artl.2010.16.2.pdf")
out_path = pdf_path.with_suffix('.txt')

reader = PdfReader(str(pdf_path))
parts: list[str] = []
for i, page in enumerate(reader.pages):
    text = page.extract_text() or ""
    parts.append(f"\n\n===== PAGE {i+1} =====\n\n{text}")

out_path.write_text("".join(parts), encoding="utf-8", errors="ignore")
print(f"pages={len(reader.pages)}")
print(f"out={out_path}")
print(f"bytes={out_path.stat().st_size}")
