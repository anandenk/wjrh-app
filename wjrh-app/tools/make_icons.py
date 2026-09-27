#!/usr/bin/env python3
"""
Generate the app icons. Pure stdlib — no Pillow, nothing to install.

The mark is the app's own signal-bar motif (the 9-bar square on the Now
screen, simplified to 5 chunky bars so it survives being 40px on a home
screen) in accent green on ink.

Replace these with the station's real logo when there is one. Nothing in the
app cares how the PNGs were made; keep the filenames.

    python3 tools/make_icons.py
"""

import struct
import sys
import zlib

INK = (0x11, 0x11, 0x11)
ACCENT = (0x00, 0xE0, 0xA4)

# Bar heights as a fraction of the mark's height, left to right.
BARS = [0.34, 0.66, 1.0, 0.78, 0.46]


def write_png(path, width, height, pixel_fn):
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None) for each scanline
        for x in range(width):
            raw.extend(pixel_fn(x, y))

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def make(size):
    # Mark occupies the middle ~54%, leaving a wide margin so the icon still
    # reads inside a maskable circle crop.
    mark_w = size * 0.54
    mark_h = size * 0.42
    left = (size - mark_w) / 2
    bottom = (size + mark_h) / 2

    gap = mark_w * 0.06
    bar_w = (mark_w - gap * (len(BARS) - 1)) / len(BARS)

    spans = []
    for i, frac in enumerate(BARS):
        x0 = left + i * (bar_w + gap)
        spans.append((x0, x0 + bar_w, bottom - mark_h * frac, bottom))

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        for x0, x1, y0, y1 in spans:
            if x0 <= px < x1 and y0 <= py < y1:
                return ACCENT
        return INK

    path = f"icon-{size}.png"
    write_png(path, size, size, pixel)
    return path


if __name__ == "__main__":
    for s in (180, 192, 512, 1024):
        print("wrote", make(s))
    sys.exit(0)
