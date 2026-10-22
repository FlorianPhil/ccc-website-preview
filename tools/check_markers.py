#!/usr/bin/env python3
"""Flag square UI markers. Markers must use the signature's round nodes (ISS-095).

A marker is a ::before/::after/::marker rule sized 16px or smaller. It passes when
it sets a border-radius, carries no box (content text only), or belongs to a native
form control listed in ALLOW.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ALLOW = ("checkbox", "toggle", "switch", "skip", "sr-only", ".check input", "control--select")
RULE = re.compile(r"([^{}]+)\{([^{}]*)\}")


def px(decl, prop):
    m = re.search(r"(?:^|;)\s*" + prop + r"\s*:\s*(\d+(?:\.\d+)?)px", decl)
    return float(m.group(1)) if m else None


def main():
    bad = []
    for css in sorted((ROOT / "assets/css").glob("*.css")):
        text = re.sub(r"/\*.*?\*/", "", css.read_text(), flags=re.S)
        for m in RULE.finditer(text):
            sel, decl = m.group(1).strip(), m.group(2)
            if not re.search(r"::?(before|after|marker)", sel) or any(a in sel for a in ALLOW):
                continue
            w, h = px(decl, "width"), px(decl, "height")
            if w is None or h is None or w > 16 or h > 16 or w < 3 or h < 3:
                continue
            if "border-radius" in decl or "mask" in decl or "clip-path" in decl:
                continue
            line = text[: m.start()].count("\n") + 1
            bad.append(f"{css.relative_to(ROOT)}:{line}: square marker {sel.splitlines()[-1].strip()}")
    for b in bad:
        print(b)
    print(f"markers: {'FAIL' if bad else 'ok'} ({len(bad)} square)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
