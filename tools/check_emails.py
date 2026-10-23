#!/usr/bin/env python3
"""Flag email addresses with uppercase letters. Every address on the site is lowercase.

Scans page text, mailto: links, JSON-LD, meta tags and data files, including
%40 and &#64; encoded forms, plus CSS that would capitalize an email or mailto link.
"""
import html, re, sys, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXTS = (".html", ".json", ".js", ".xml", ".txt", ".md", ".webmanifest")
EMAIL = re.compile(r"[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
RULE = re.compile(r"([^{}]+)\{([^{}]*)\}")


def main():
    bad = []
    for p in sorted(ROOT.rglob("*")):
        if ".git" in p.parts or p.suffix not in EXTS or not p.is_file():
            continue
        for n, raw in enumerate(p.read_text(errors="ignore").splitlines(), 1):
            # Decode %40 and &#64; forms so encoded links are checked too
            line = html.unescape(urllib.parse.unquote(raw))
            for m in EMAIL.finditer(line):
                if re.search(r"[A-Z]", m.group(0)):
                    bad.append(f"{p.relative_to(ROOT)}:{n}: uppercase in email {m.group(0)}")
    for css in sorted((ROOT / "assets/css").glob("*.css")):
        text = re.sub(r"/\*.*?\*/", "", css.read_text(), flags=re.S)
        for m in RULE.finditer(text):
            sel, decl = m.group(1), m.group(2)
            if re.search(r"mailto|email", sel, re.I) and re.search(r"text-transform\s*:\s*(uppercase|capitalize)", decl):
                line = text[: m.start()].count("\n") + 1
                bad.append(f"{css.relative_to(ROOT)}:{line}: capitalizes an email {sel.strip().splitlines()[-1]}")
    for b in bad:
        print(b)
    print(f"emails: {'FAIL' if bad else 'ok'} ({len(bad)} with uppercase)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
