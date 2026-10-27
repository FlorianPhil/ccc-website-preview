#!/usr/bin/env python3
"""Chamber Lines rules the player must keep on every page.

This checker owns the scroll-speed cap and rounded route-corner rules.
Dot appearance is checked by tools/check_signature_dots.py.

1. Speed never passes the setting. The scroll clock may wake a field up to
   the speed setting while the page scrolls, never past it.
2. Corners are rounded. Every turn in a route is a metro-map arc; two path
   segments never meet at an angle, at any scale.

Run: python3 tools/check_signature_speed.py  (exit 1 on a broken rule)
"""
import json
import math
import re
import sys
from pathlib import Path

JS = Path(__file__).resolve().parent.parent / "assets/js/site.js"


def sharp_joints(d, limit=2.0):
    """Joints where the incoming and outgoing tangents differ by more than limit degrees."""
    nums = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", d)]
    if not re.fullmatch(r"M[\d\s.,-]+(C[\d\s.,-]+)+", d.replace(" ", "")):
        return [(0, 0, 999)]
    pts = [tuple(nums[0:2])]
    segs = []
    for k in range(2, len(nums), 6):
        c1, c2, end = tuple(nums[k:k + 2]), tuple(nums[k + 2:k + 4]), tuple(nums[k + 4:k + 6])
        segs.append((pts[-1], c1, c2, end))
        pts.append(end)

    def ang(a, b):
        return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) if a != b else None

    bad = []
    for a, b in zip(segs, segs[1:]):
        out = ang(a[2], a[3]) if ang(a[2], a[3]) is not None else ang(a[0], a[3])
        inn = ang(b[0], b[1]) if ang(b[0], b[1]) is not None else ang(b[0], b[3])
        if out is None or inn is None:
            continue
        turn = abs((inn - out + 180) % 360 - 180)
        if turn > limit:
            bad.append((a[3][0], a[3][1], turn))
    return bad


def check(js):
    """Return scroll-speed and route-corner violations for JavaScript source."""
    errors = []

    # 1. Scroll never pushes speed past the setting.
    cap = re.search(r"scrollBoost = Math\.min\(([\d.]+),", js)
    if not cap or float(cap.group(1)) > 1:
        errors.append("site.js: scrollBoost may exceed 1, so scroll fields run faster than the speed setting")
    if re.search(r"1 \+ scrollBoost", js):
        errors.append("site.js: speed multiplied by 1 + scrollBoost runs past the speed setting")
    for m in re.finditer(r"this\.time \+= delta \* this\.P\.speed([^;]*);", js):
        if "scrollBoost" in m.group(1) and "Math.max(this.idle, scrollBoost)" not in m.group(1):
            line = js.count("\n", 0, m.start()) + 1
            errors.append(f"site.js:{line}: unexpected speed formula {m.group(0)!r}")

    # 2. Every joint between two path segments continues the same direction.
    sig = re.search(r"window\.CCC_SIG=window\.CCC_SIG\|\|(\{.*?\});\n", js)
    routes = json.loads(sig.group(1))["field"]["routes"] if sig else []
    if not routes:
        errors.append("site.js: CCC_SIG routes not found")
    for i, r in enumerate(routes):
        for x, y, turn in sharp_joints(r["d"]):
            errors.append(f"route {i}: {turn:.0f} degree corner at ({x:g}, {y:g}) has no rounding")

    return errors


def main():
    errors = check(JS.read_text(encoding="utf-8"))
    for e in errors:
        print(e)
    print("signature rules hold" if not errors else f"{len(errors)} rule(s) broken")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
