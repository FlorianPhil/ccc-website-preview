"""A station dot must stay solid: no line may ever show through it.

Opaque fields paint the field-colour ring before the faded gold. Transparent
fields (lines over a photo) cut the ring out of the lines and fill the dot with
gold pre-mixed into the field colour at full opacity. Run: python3 tools/check_signature_dots.py
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
        if "destination-out" not in clear:
            problems.append("transparent dots do not cut the ring out of the lines")
        if "mixHex(FIELD.background, FIELD.gold, P.dots)" not in clear or "globalAlpha = P.dots" in clear:
            problems.append("transparent dots are not filled with an opaque pre-mixed gold")
        ring = opaque.find("FIELD.background")
        fade = opaque.find("globalAlpha = P.dots")
        if ring < 0 or fade < 0 or ring > fade:
            problems.append("opaque dots fade the gold without a solid field-colour ring under it")
if problems:
    print("FAIL signature dots:\n  " + "\n  ".join(problems))
    sys.exit(1)
print("ok signature dots stay solid")
