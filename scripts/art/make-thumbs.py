#!/usr/bin/env python3
"""Make the small Queen of Hearts copy (QH-sm.webp) for every court set.

The deck picker shows each deck's Queen of Hearts at 46px; loading the full
480x640 painting thirteen times made the picker slow on phones. Run this again
after repainting any court's QH:  python3 scripts/art/make-thumbs.py
"""
from pathlib import Path

from PIL import Image

COURT = Path(__file__).resolve().parents[2] / "public" / "art" / "court"

# */*/QH.webp: the skin-tone copies (scripts/art/install-skin-tones.py)
for qh in sorted([*COURT.glob("*/QH.webp"), *COURT.glob("*/*/QH.webp")]):
    out = qh.with_name("QH-sm.webp")
    Image.open(qh).convert("RGB").resize((150, 200), Image.LANCZOS).save(out, "WEBP", quality=78, method=6)
    print(f"{out.relative_to(COURT)}  {out.stat().st_size // 1024} KB")
