"""A station dot must stay solid: no line may ever show through it.

Every dot sits on a solid ring painted in the field colour, on opaque fields and
on transparent fields over a photo alike. Nothing is cut out, so neither a line
nor the photo shows under or around a dot. Opaque fields fade the gold onto that
ring; transparent fields fill the dot with gold pre-mixed into the field colour
at full opacity, so the dot itself is never see-through. Run: python3 tools/check_signature_dots.py
"""
import re
import sys
from pathlib import Path

src = (Path(__file__).resolve().parents[1] / "assets/js/site.js").read_text(encoding="utf-8")
m = re.search(r"for \(var n = 0; n < this\.nodes\.length; n\+\+\) \{(.*?)\n    \}\n", src, re.S)
problems = []
if not m:
    problems.append("node drawing loop not found in Field.draw")
else:
    loop = m.group(1)
    t = re.search(r"if \(this\.transparent\) \{(.*?)\} else \{(.*?)\n      \}", loop, re.S)
    if not t:
        problems.append("node loop has no transparent / opaque branches")
    else:
        clear, opaque = t.group(1), t.group(2)
        if "destination-out" in loop:
            problems.append("a dot ring is cut out, so the photo or lines show around the dot")
        for name, branch in (("transparent", clear), ("opaque", opaque)):
            ring = re.search(r"fillStyle = FIELD\.background;\s*ctx\.beginPath\(\); ctx\.arc\(node\.cx, node\.cy, node\.outerR", branch)
            if not ring:
                problems.append(name + " dots have no solid field-colour ring under them")
        if "mixHex(FIELD.background, FIELD.gold, P.dots)" not in clear or "globalAlpha" in clear:
            problems.append("transparent dots are not filled with an opaque pre-mixed gold")
        ring = opaque.find("FIELD.background")
        fade = opaque.find("globalAlpha = P.dots")
        if ring < 0 or fade < 0 or ring > fade:
            problems.append("opaque dots fade the gold without a solid field-colour ring under it")
if problems:
    print("FAIL signature dots:\n  " + "\n  ".join(problems))
    sys.exit(1)
print("ok signature dots stay solid")
