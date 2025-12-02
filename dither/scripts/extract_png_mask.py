#!/usr/bin/env python3
"""Convert a grayscale/monochrome PNG mask into a JavaScript Uint8Array module.

This avoids third-party dependencies (like Pillow) so it keeps working even when
pip installs are blocked. Currently limited to 8-bit, non-interlaced PNGs.
"""
from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
from typing import Iterable, List
import struct
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

COLOR_TYPE_TO_CHANNELS = {
    0: 1,  # Grayscale
    2: 3,  # Truecolor (RGB)
    3: 1,  # Indexed-color
    4: 2,  # Grayscale + alpha
    6: 4,  # RGBA
}

def paeth_predictor(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c

def read_png_bytes(path: Path) -> tuple[int, int, int, List[bytearray], bytes | None]:
    data = path.read_bytes()
    if data[:8] != PNG_SIGNATURE:
        raise ValueError("File is not a PNG")

    offset = 8
    idat = bytearray()
    palette = None
    width = height = bit_depth = color_type = None

    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + length]
        offset += 12 + length

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack_from(">IIBBBBB", chunk_data)
            if bit_depth != 8:
                raise ValueError("Only 8-bit PNGs are supported")
            if interlace != 0:
                raise ValueError("Interlaced PNGs are not supported")
            if compression != 0 or filter_method != 0:
                raise ValueError("Unsupported PNG compression/filter method")
        elif chunk_type == b"PLTE":
            palette = chunk_data
        elif chunk_type == b"IDAT":
            idat.extend(chunk_data)
        elif chunk_type == b"IEND":
            break

    if width is None or height is None or color_type is None:
        raise ValueError("PNG is missing IHDR data")

    if color_type not in COLOR_TYPE_TO_CHANNELS:
        raise ValueError(f"Unsupported PNG color type {color_type}")

    channels = COLOR_TYPE_TO_CHANNELS[color_type]
    stride = width * channels
    raw = zlib.decompress(bytes(idat))
    rows: List[bytearray] = []
    idx = 0
    prev = bytearray(stride)

    for _ in range(height):
        filter_type = raw[idx]
        idx += 1
        scanline = bytearray(raw[idx : idx + stride])
        idx += stride
        recon = bytearray(stride)

        for i in range(stride):
            left = recon[i - channels] if i >= channels else 0
            up = prev[i]
            up_left = prev[i - channels] if i >= channels else 0

            if filter_type == 0:
                recon[i] = scanline[i]
            elif filter_type == 1:
                recon[i] = (scanline[i] + left) & 0xFF
            elif filter_type == 2:
                recon[i] = (scanline[i] + up) & 0xFF
            elif filter_type == 3:
                recon[i] = (scanline[i] + (left + up) // 2) & 0xFF
            elif filter_type == 4:
                recon[i] = (scanline[i] + paeth_predictor(left, up, up_left)) & 0xFF
            else:
                raise ValueError(f"Unsupported PNG filter type {filter_type}")

        rows.append(recon)
        prev = recon

    return width, height, color_type, rows, palette

def rows_to_grayscale(rows: List[bytearray], color_type: int, palette: bytes | None) -> List[int]:
    values: List[int] = []

    if color_type == 0:
        for row in rows:
            values.extend(row)
        return values

    if color_type == 2:
        for row in rows:
            for i in range(0, len(row), 3):
                values.append(row[i])
        return values

    if color_type == 3:
        if not palette:
            raise ValueError("Indexed PNG is missing a palette")
        # Palette is RGB triplets
        for row in rows:
            for index in row:
                base = index * 3
                values.append(palette[base])
        return values

    if color_type == 4:
        for row in rows:
            for i in range(0, len(row), 2):
                values.append(row[i])
        return values

    if color_type == 6:
        for row in rows:
            for i in range(0, len(row), 4):
                values.append(row[i])
        return values

    raise ValueError(f"Unhandled color type {color_type}")

def format_js_module(width: int, height: int, values: Iterable[int], const_prefix: str) -> str:
    numbers = list(values)
    lines = []
    for i in range(0, len(numbers), 16):
        chunk = ", ".join(str(n) for n in numbers[i : i + 16])
        lines.append(f"  {chunk},")
    if lines:
        lines[-1] = lines[-1].rstrip(",")

    return (
        f"export const {const_prefix}_WIDTH = {width};\n"
        f"export const {const_prefix}_HEIGHT = {height};\n\n"
        f"export const {const_prefix} = new Uint8Array([\n"
        + "\n".join(lines)
        + "\n]);\n"
    )

def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="PNG file containing the mask")
    parser.add_argument("output", type=Path, help="Destination JavaScript file")
    parser.add_argument(
        "--const-prefix",
        default="BLUE_NOISE_MASK_64",
        help="Prefix to use for exported constants (default: %(default)s)",
    )
    args = parser.parse_args()

    width, height, color_type, rows, palette = read_png_bytes(args.input)
    values = rows_to_grayscale(rows, color_type, palette)
    module_text = format_js_module(width, height, values, args.const_prefix)
    args.output.write_text(module_text)
    print(f"Wrote {len(values)} samples to {args.output}")

if __name__ == "__main__":
    main()
