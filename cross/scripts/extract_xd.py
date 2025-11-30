import argparse
import base64
import hashlib
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path

META_KEYS = {
    "title": "Title",
    "author": "Author",
    "date": "Date",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract minimal puzzle data from XD archive")
    parser.add_argument("--zip", dest="zip_path", default="xd-puzzles.zip", help="Path to xd-puzzles.zip")
    parser.add_argument(
        "--out", dest="output", default=Path(__file__).resolve().parents[1] / "data", type=Path,
        help="Directory where manifest and shards will be written",
    )
    parser.add_argument(
        "--prefix", dest="prefix", default="gxd/", help="Path prefix inside the archive to scan",
    )
    return parser.parse_args()


def parse_xd(raw: str) -> tuple[dict[str, str], list[str]]:
    meta: dict[str, str] = {}
    grid: list[str] = []
    lines = raw.splitlines()
    in_meta = True
    grid_started = False
    for line in lines:
        stripped = line.strip()
        if in_meta:
            if not stripped:
                in_meta = False
                continue
            match = re.match(r"^([^:]+):\s*(.+)$", stripped)
            if match:
                key = match.group(1).strip().lower()
                meta[key] = match.group(2).strip()
            continue
        if not grid_started:
            if is_grid_line(stripped):
                grid_started = True
                grid.append(stripped)
            continue
        if grid_started:
            if is_grid_line(stripped):
                grid.append(stripped)
            else:
                break
    return meta, grid


def is_grid_line(line: str) -> bool:
    return bool(line) and bool(re.match(r"^[#A-Z]+$", line))


def normalize_date(meta_date: str | None, filename: str) -> str:
    if meta_date:
        for fmt in (
            "%A, %B %d, %Y",
            "%A, %b %d, %Y",
            "%B %d, %Y",
            "%b %d, %Y",
            "%Y-%m-%d",
        ):
            try:
                dt = datetime.strptime(meta_date, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return meta_date
    match = re.search(r"(\d{4})[-_](\d{2})[-_](\d{2})", filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return filename


def encode_grid(grid: list[str]) -> str:
    joined = "\n".join(grid)
    return base64.b64encode(joined.encode("ascii", errors="ignore")).decode("ascii")


def shard_filename(slug: str) -> str:
    digest = hashlib.sha1(slug.encode("utf-8")).hexdigest()[:16]
    return f"{digest}.json"


def main() -> None:
    args = parse_args()
    zip_path = Path(args.zip_path)
    output_root: Path = Path(args.output)
    shards_dir = output_root / "shards"
    shards_dir.mkdir(parents=True, exist_ok=True)

    shard_map: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    with zipfile.ZipFile(zip_path) as archive:
        for name in archive.namelist():
            if not name.lower().endswith(".xd"):
                continue
            if not name.startswith(args.prefix):
                continue
            parts = Path(name).parts
            if len(parts) < 4:
                continue
            publication = parts[1]
            year = parts[2]
            raw = archive.read(name).decode("utf-8", errors="ignore")
            meta, grid = parse_xd(raw)
            if not grid:
                continue
            shard_map[(publication, year)].append(
                {
                    "title": meta.get("title") or meta.get("date") or Path(name).stem,
                    "author": meta.get("author", "Unknown"),
                    "date": normalize_date(meta.get("date"), Path(name).stem),
                    "grid": encode_grid(grid),
                }
            )

    manifest: list[dict[str, str]] = []
    for (publication, year), puzzles in sorted(shard_map.items()):
        slug = f"{publication}-{year}"
        file_name = shard_filename(slug)
        shard_path = shards_dir / file_name
        puzzles.sort(key=lambda p: p.get("date") or p["title"])
        shard_payload = {
            "id": slug,
            "publication": publication,
            "year": year,
            "count": len(puzzles),
            "puzzles": puzzles,
        }
        shard_path.write_text(json.dumps(shard_payload, separators=(",", ":")), encoding="utf-8")
        manifest.append(
            {
                "id": slug,
                "publication": publication,
                "year": year,
                "count": len(puzzles),
                "label": f"{publication.title()} {year}",
                "url": f"data/shards/{file_name}",
            }
        )

    manifest_path = output_root / "manifest.json"
    manifest.sort(key=lambda item: (item["publication"], item["year"]))
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {manifest_path} with {len(manifest)} shards")


if __name__ == "__main__":
    main()
