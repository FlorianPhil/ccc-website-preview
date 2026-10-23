#!/usr/bin/env python3
"""Chamber Lines rules the player must keep on every page.

1. Dots are solid. Every gold dot sits on a ring that hides the lines under it:
   a ring painted in the field colour, or a ring cut out of a transparent field.
2. Speed never passes the setting. The scroll clock may wake a field up to
   the speed setting while the page scrolls, never past it.

Run: python3 tools/check_signature_speed.py  (exit 1 on a broken rule)
"""
import re
import sys
from pathlib import Path

JS = Path(__file__).resolve().parent.parent / "assets/js/site.js"


def main():
    js = JS.read_text()
    errors = []

    # 1. Every dot fill (node.r) follows a ring (node.outerR) in the same block.
    for m in re.finditer(r"\.arc\(node\.cx, node\.cy, node\.r,", js):
        block = js[max(0, m.start() - 900): m.start()]
        last_dot = block.rfind("node.r,")
        ring = block.rfind("node.outerR")
        if ring < 0 or ring < last_dot:
            line = js.count("\n", 0, m.start()) + 1
            errors.append(f"site.js:{line}: dot drawn without a ring under it, so lines show through")
    if "globalAlpha = P.dots" in js and 'destination-out' not in js:
        errors.append("site.js: no transparent-field ring cut found")

    # 2. Scroll never pushes speed past the setting.
    cap = re.search(r"scrollBoost = Math\.min\(([\d.]+),", js)
    if not cap or float(cap.group(1)) > 1:
        errors.append("site.js: scrollBoost may exceed 1, so scroll fields run faster than the speed setting")
    if re.search(r"1 \+ scrollBoost", js):
        errors.append("site.js: speed multiplied by 1 + scrollBoost runs past the speed setting")
    for m in re.finditer(r"this\.time \+= delta \* this\.P\.speed([^;]*);", js):
        if "scrollBoost" in m.group(1) and "Math.max(this.idle, scrollBoost)" not in m.group(1):
            line = js.count("\n", 0, m.start()) + 1
            errors.append(f"site.js:{line}: unexpected speed formula {m.group(0)!r}")

    for e in errors:
        print(e)
    print("signature rules hold" if not errors else f"{len(errors)} rule(s) broken")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
