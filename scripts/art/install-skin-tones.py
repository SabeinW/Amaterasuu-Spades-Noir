#!/usr/bin/env python3
"""Install skin-tone copies of the court art, and check none are missing.

scripts/art/skin-tones.ts writes <out>/<tone>/<set>__<card>.png (768x1024).
This saves each as public/art/court/<set>/<tone>/<card>.webp (480x640, like
the originals) plus the small Queen of Hearts (QH-sm.webp) for the deck picker.

    python3 scripts/art/install-skin-tones.py <out-dir>   # install, then check
    python3 scripts/art/install-skin-tones.py --check     # only list what's missing

Every court set needs every tone: a new deck isn't finished until --check
passes. (A missing copy falls back to the original Brown painting in the app.)
"""
import sys
from pathlib import Path

from PIL import Image

COURT = Path(__file__).resolve().parents[2] / "public" / "art" / "court"
TONES = ["pale", "olive", "light", "deep"]  # brown is the original painting
CARDS = [v + s for v in "JQK" for s in "SHDC"] + ["JOKER_BIG", "JOKER_SMALL"]


def install(out: Path) -> None:
    n = 0
    for tone in TONES:
        for png in sorted((out / tone).glob("*__*.png")):
            court_set, card = png.stem.split("__")
            if not (COURT / court_set).is_dir() or card not in CARDS:
                print(f"skip {png}")
                continue
            dst = COURT / court_set / tone / f"{card}.webp"
            dst.parent.mkdir(exist_ok=True)
            im = Image.open(png).convert("RGB")
            im.resize((480, 640), Image.LANCZOS).save(dst, "WEBP", quality=80, method=6)
            if card == "QH":
                im.resize((150, 200), Image.LANCZOS).save(dst.with_name("QH-sm.webp"), "WEBP", quality=78, method=6)
            n += 1
    print(f"installed {n}")


def check() -> int:
    missing = [
        f"{s.name}/{tone}/{card}.webp"
        for s in sorted(p for p in COURT.iterdir() if p.is_dir())
        for tone in TONES
        for card in CARDS + ["QH-sm"]
        if not (s / tone / f"{card}.webp").exists()
    ]
    for m in missing:
        print(f"missing {m}")
    print(f"{len(missing)} missing")
    return 1 if missing else 0


if __name__ == "__main__":
    if sys.argv[1:] and sys.argv[1] != "--check":
        install(Path(sys.argv[1]))
    sys.exit(check())
