"""Turn a rendered PNG into a submission screenshot: 1280x720 JPEG under 256 KiB.

Usage: python3 tools/tojpeg.py <in.png> <out.jpg>
"""

from __future__ import annotations

import sys

from PIL import Image

MAX_BYTES = 256_000
TARGET = (1280, 720)


def convert(source: str, target: str) -> None:
    image = Image.open(source).convert("RGB")
    if image.size != TARGET:
        image = image.resize(TARGET, Image.LANCZOS)
    for quality in (92, 90, 88, 86, 84, 82, 80, 78, 75, 70):
        image.save(target, "JPEG", quality=quality, optimize=True, progressive=False)
        with open(target, "rb") as handle:
            size = len(handle.read())
        if size <= MAX_BYTES:
            print(f"{target}: {image.size} q={quality} {size} bytes")
            return
    raise SystemExit(f"{target}: cannot reach {MAX_BYTES} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    convert(sys.argv[1], sys.argv[2])
