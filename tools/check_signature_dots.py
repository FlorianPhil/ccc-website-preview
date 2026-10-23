"""A station dot must stay solid: no line may ever show through it.

Florian's design (ISS-119): no visible line or outline around a dot, and the dot
is never see-through. On opaque fields the clearance ring is the field colour, so
it is invisible, and the gold fades onto it. Over a photo the clearance ring is
cut out of the lines (destination-out), so the photo shows in the gap and no
cream ring is drawn; the dot is filled with gold pre-mixed into the field colour
at full opacity. A field over a photo
never fades its canvas in, because a half-faded canvas makes every dot see-through. Run: python3 tools/check_signature_dots.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
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
            problems.append("dots over a photo do not cut an invisible clearance gap out of the lines")
        if "FIELD.background" in clear.split("mixHex")[0]:
            problems.append("dots over a photo paint a visible field-colour ring (Florian: no line around the circle)")
        if "destination-out" in opaque:
            problems.append("opaque dots cut the field instead of using the field-colour ring")
        if "mixHex(FIELD.background, FIELD.gold, P.dots)" not in clear or "globalAlpha" in clear:
            problems.append("transparent dots are not filled with an opaque pre-mixed gold")
        ring = opaque.find("FIELD.background")
        fade = opaque.find("globalAlpha = P.dots")
        if ring < 0 or fade < 0 or ring > fade:
            problems.append("opaque dots fade the gold without a solid field-colour ring under it")
css = (ROOT / "assets/css/site.css").read_text(encoding="utf-8")
if not re.search(r"\.field--photo \.field__canvas \{[^}]*opacity: 1;[^}]*transition: none;", css):
    problems.append("a field over a photo fades its canvas in, so its dots are see-through while it fades")
sig = json.loads(re.search(r"window\.CCC_SIG=window\.CCC_SIG\|\|(\{.*?\});\n", src).group(1))
photo = {k for k, g in sig["groups"].items() if g.get("transparent") and not g.get("hover")}
for page in sorted(ROOT.rglob("*.html")):
    if ".git" in page.parts:
        continue
    for cls, name in re.findall(r'<div class="(field[^"]*)"[^>]*data-signature="([^"]+)"', page.read_text(encoding="utf-8")):
        if name in photo and "field--photo" not in cls.split():
            problems.append(f"{page.relative_to(ROOT)}: {name} sits over a photo without field--photo, so it fades in see-through")
if problems:
    print("FAIL signature dots:\n  " + "\n  ".join(problems))
    sys.exit(1)
print("ok signature dots stay solid")
