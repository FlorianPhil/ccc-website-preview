"""A station dot must stay solid: no line may ever show through it.

Every dot sits on a solid ring painted in the field colour, on opaque fields and
on transparent fields over a photo alike. Nothing is cut out, so neither a line
nor the photo shows under or around a dot. Opaque fields fade the gold onto that
ring; transparent fields fill the dot with gold pre-mixed into the field colour
at full opacity, so the dot itself is never see-through. A field over a photo
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
