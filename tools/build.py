#!/usr/bin/env python3
"""Regenerate data-driven parts of the CCC staging site.

Run from anywhere:  python3 tools/build.py
Optional:           CCC_TODAY=2026-12-01 python3 tools/build.py   (pretend today)

Reads  data/chapters.json, data/events.json, data/continents.json, data/site.json
Writes the HTML pages in place. See data/README.md.
"""
import html as H
import json
import math
import os
import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P = '/ccc-website-preview/'
ORIGIN = 'https://florianphil.github.io'
TODAY = os.environ.get('CCC_TODAY') or date.today().isoformat()

CH = json.loads((ROOT / 'data/chapters.json').read_text(encoding='utf-8'))
EV = json.loads((ROOT / 'data/events.json').read_text(encoding='utf-8'))['events']
CONT = json.loads((ROOT / 'data/continents.json').read_text(encoding='utf-8'))
SITE = json.loads((ROOT / 'data/site.json').read_text(encoding='utf-8'))
REGIONS = CH['regions']
CHAPTERS = CH['chapters']
BY_SLUG = {c['slug']: c for c in CHAPTERS}
REGION = {r['key']: r for r in REGIONS}
EV_BY_SLUG = {e['slug']: e for e in EV}

STATE_LABEL = {'active': 'Active', 'forming': 'Forming', 'coming-soon': 'Coming soon'}
FORMAT_LABEL = {'mixer': 'Mixer', 'chapter-meeting': 'Chapter meeting', 'virtual-forum': 'Virtual forum',
                'job-fair': 'Job fair', 'workshop': 'Workshop', 'expo': 'Expo', 'other': 'Event'}


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;'))


def end_day(e):
    return e['end'][:10]


def upcoming(e):
    return end_day(e) >= TODAY


def counts():
    act = sum(1 for c in CHAPTERS if c['status'] == 'active')
    frm = sum(1 for c in CHAPTERS if c['status'] == 'forming')
    return {'chapters': len(CHAPTERS), 'active': act, 'forming': frm,
            'regions': len({c['region'] for c in CHAPTERS}), 'eventsyear': SITE.get('eventsPerYear', 75)}


NUM = counts()


def sub_numbers(s):
    return re.sub(r'<!--n:(\w+)-->.*?<!--/n-->', lambda m: '<!--n:%s-->%s<!--/n-->' % (m.group(1), NUM[m.group(1)]), s, flags=re.S)


def sub_block(s, name, body):
    pat = re.compile(r'(<!--data:%s-->).*?(<!--/data:%s-->)' % (name, name), re.S)
    if not pat.search(s):
        return s
    return pat.sub(lambda m: m.group(1) + '\n' + body + '\n' + m.group(2), s)


def leaders_text(c):
    n = len(c['leaders'])
    if n == 0:
        return 'Leadership team forming'
    t = '%d leader%s' % (n, '' if n == 1 else 's')
    return (c['state'] + ' · ' + t) if c.get('state') else t


def chapter_items(chs):
    out = []
    for c in chs:
        out.append(
            '            <li class="chapter-item">\n'
            '              <h4 class="chapter-item__name"><a href="%schapters/%s/">%s</a></h4>\n'
            '              <p class="chapter-item__meta">%s</p>\n'
            '              <span class="state state--%s">%s</span>\n'
            '            </li>' % (P, c['slug'], esc(c['name']), esc(leaders_text(c)), c['status'], STATE_LABEL[c['status']]))
    return '\n'.join(out)


def count_spans(chs):
    parts = []
    for st, word in (('active', 'active'), ('forming', 'forming'), ('coming-soon', 'coming soon')):
        n = sum(1 for c in chs if c['status'] == st)
        if n:
            parts.append('<span class="state state--%s">%d %s</span>' % (st if st != 'coming-soon' else 'soon', n, word))
    return ''.join(parts)


def region_chapters(rk):
    return [c for c in CHAPTERS if c['region'] == rk]


def project(c, cont):
    x0, x1, y0, y1 = cont['box']
    k, cx = cont['k'], cont['cx']
    x = (c['lon'] - x0) * cx * k
    y = (y1 - c['lat']) * k
    return min(max(x, 8), cont['width'] - 8), min(max(y, 8), cont['height'] - 8)


def spread(pts, w, h, mind=15.0, iters=140):
    pos = [list(p) for p in pts]
    for it in range(iters):
        moved = False
        for i in range(len(pos)):
            for j in range(i + 1, len(pos)):
                dx, dy = pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]
                d = math.hypot(dx, dy)
                if d >= mind:
                    continue
                if d < 0.01:
                    ang = (i * 2.399 + j) % 6.283
                    dx, dy, d = math.cos(ang), math.sin(ang), 1.0
                push = (mind - d) / 2 + 0.2
                ux, uy = dx / d, dy / d
                pos[i][0] -= ux * push; pos[i][1] -= uy * push
                pos[j][0] += ux * push; pos[j][1] += uy * push
                moved = True
        for p in pos:
            p[0] = min(max(p[0], 9), w - 9)
            p[1] = min(max(p[1], 9), h - 9)
        if not moved:
            break
    return pos


def overlap(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def map_svg(region):
    cont = CONT[region['continent']]
    w, h = cont['width'], cont['height']
    chs = region_chapters(region['key'])
    true = [project(c, cont) for c in chs]
    pos = spread(true, w, h)
    uid = region['anchor']
    boxes = [(p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8) for p in pos]
    placed = []
    labels = {}
    order = sorted(range(len(chs)), key=lambda i: (chs[i]['status'] != 'active', i))
    for i in order:
        txt = chs[i]['name']
        tw = len(txt) * 6.1 + 4
        px, py = pos[i]
        cands = [
            (px + 11, py - 6, px + 11 + tw, py + 7, 'start', px + 11, py + 4),
            (px - 11 - tw, py - 6, px - 11, py + 7, 'end', px - 11, py + 4),
            (px - tw / 2, py - 22, px + tw / 2, py - 9, 'middle', px, py - 12),
            (px - tw / 2, py + 9, px + tw / 2, py + 22, 'middle', px, py + 19),
        ]
        for (x0, y0, x1, y1, anchor, tx, ty) in cands:
            if x0 < 2 or x1 > w - 2 or y0 < 2 or y1 > h - 2:
                continue
            bb = (x0, y0, x1, y1)
            if any(overlap(bb, o) for j, o in enumerate(boxes) if j != i) or any(overlap(bb, o) for o in placed):
                continue
            placed.append(bb)
            labels[i] = (tx, ty, anchor)
            break
    parts = ['<svg class="ch-svg" viewBox="0 0 %d %d" role="group" aria-label="%s chapter map" focusable="false">' % (w, h, esc(region['label']))]
    parts.append('<defs><pattern id="dots-%s" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.15" class="ch-dot"/></pattern>'
                 '<clipPath id="land-%s"><path d="%s"/></clipPath></defs>' % (uid, uid, cont['path']))
    parts.append('<rect width="%d" height="%d" fill="url(#dots-%s)" clip-path="url(#land-%s)"/>' % (w, h, uid, uid))
    parts.append('<path class="ch-land" d="%s"/>' % cont['path'])
    for i, c in enumerate(chs):
        if math.hypot(pos[i][0] - true[i][0], pos[i][1] - true[i][1]) > 2.5:
            parts.append('<line class="ch-lead-line" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/><circle class="ch-true" cx="%.1f" cy="%.1f" r="1.8"/>'
                         % (true[i][0], true[i][1], pos[i][0], pos[i][1], true[i][0], true[i][1]))
    for i, c in enumerate(chs):
        st = c['status']
        parts.append('<a class="ch-pin ch-pin--%s" href="%schapters/%s/"><title>%s, %s</title><circle class="ch-pin__hit" cx="%.1f" cy="%.1f" r="11"/><circle class="ch-pin__dot" cx="%.1f" cy="%.1f" r="6"/></a>'
                     % ('soon' if st == 'coming-soon' else st, P, c['slug'], esc(c['name']), STATE_LABEL[st].lower(), pos[i][0], pos[i][1], pos[i][0], pos[i][1]))
    for i, (tx, ty, anchor) in labels.items():
        parts.append('<text class="ch-lab" x="%.1f" y="%.1f" text-anchor="%s" aria-hidden="true">%s</text>' % (tx, ty, anchor, esc(chs[i]['name'])))
    parts.append('</svg>')
    return ''.join(parts)


LEGEND = ('<ul class="ch-legend" role="list" aria-label="Map key">'
          '<li><span class="ch-legend__dot ch-legend__dot--active" aria-hidden="true"></span>Active chapter</li>'
          '<li><span class="ch-legend__dot ch-legend__dot--forming" aria-hidden="true"></span>Forming</li>'
          '<li><span class="ch-legend__dot ch-legend__dot--soon" aria-hidden="true"></span>Coming soon</li></ul>')


def atlas():
    out = ['    <div class="ch-atlas sec-body" data-atlas>', '      ' + LEGEND]
    for r in REGIONS:
        chs = region_chapters(r['key'])
        if not chs:
            continue
        out.append(
            '      <article class="ch-panel" id="%(a)s" data-region="%(k)s" aria-labelledby="ch-%(a)s-title">\n'
            '        <header class="ch-panel__head">\n'
            '          <h3 class="ch-panel__title" id="ch-%(a)s-title">%(l)s</h3>\n'
            '          <p class="ch-group__count">%(cnt)s</p>\n'
            '        </header>\n'
            '        <div class="ch-panel__body">\n'
            '          <figure class="ch-mapfig">%(svg)s</figure>\n'
            '          <ul class="chapter-list" role="list">\n%(items)s\n          </ul>\n'
            '        </div>\n'
            '      </article>' % {'a': r['anchor'], 'k': r['key'], 'l': esc(r['label']), 'cnt': count_spans(chs),
                                  'svg': map_svg(r), 'items': chapter_items(chs)})
    out.append('    </div>')
    return '\n'.join(out)


def forming_list():
    return '\n'.join('        <li><a class="ch-forming__link" href="%schapters/%s/#get-involved">%s</a><span class="state state--forming">Forming</span></li>'
                     % (P, c['slug'], esc(c['name'])) for c in CHAPTERS if c['status'] == 'forming')


def region_index():
    out = []
    for r in REGIONS:
        chs = region_chapters(r['key'])
        if not chs:
            continue
        out.append('        <li class="region-index__group">\n'
                   '          <h3 class="region-index__name"><a href="%schapters/#%s">%s</a></h3>\n'
                   '          <p class="region-index__count">%s</p>\n'
                   '          <p class="region-index__places">%s</p>\n        </li>'
                   % (P, r['anchor'], esc(r['label']), count_spans(chs), esc(', '.join(c['name'] for c in chs))))
    return '\n'.join(out)


_img_cache = {}


def img_size(rel):
    if rel in _img_cache:
        return _img_cache[rel]
    try:
        from PIL import Image
        with Image.open(ROOT / rel) as im:
            _img_cache[rel] = im.size
    except Exception:
        _img_cache[rel] = (800, 1000)
    return _img_cache[rel]


def person_li(l):
    photo = l['photo']
    nm = esc(l['name'])
    co = '    <p class="bd-co">%s</p>\n' % esc(l['company']) if l.get('company') else ''
    li = ''
    for key, lab in (('linkedin', 'LinkedIn'), ('website', 'Website')):
        if not l.get(key):
            continue
        li += ('    <p class="bd-links"><a class="person__link bd-link" href="%s" target="_blank" rel="noopener">%s<span class="visually-hidden"> %s %s (opens in a new tab)</span></a></p>\n'
               % (esc(l[key]), lab, 'profile of' if key == 'linkedin' else 'of', nm))
    if photo:
        base = photo[:-5] if photo.endswith('.webp') else photo
        w, h = img_size(photo)
        srcset = ''
        if (ROOT / (base + '-480w.webp')).exists():
            srcset = ' srcset="%s%s-480w.webp 480w, %s%s %dw" sizes="(min-width: 1024px) 280px, (min-width: 768px) 30vw, 46vw"' % (P, base, P, photo, w)
        fig = ('  <figure class="person__photo media" data-reveal="r2" data-from="bottom" data-stagger-self><img src="%s%s"%s alt="Portrait of %s" width="%d" height="%d" loading="lazy" decoding="async"></figure>\n'
               % (P, photo, srcset, nm, w, h))
    else:
        ini = ''.join(x[0] for x in l['name'].split()[:2]).upper()
        fig = '  <div class="person__photo"><span class="person__mono" aria-hidden="true">%s</span></div>\n' % ini
    return ('        <li class="person">\n' + fig + '  <div class="bd-person">\n    <h3 class="person__name">%s</h3>\n    <p class="person__role">%s</p>\n%s%s  </div>\n</li>'
            % (nm, esc(l['role']), co, li))


def date_block(e):
    d = datetime.strptime(e['start'][:10], '%Y-%m-%d')
    return ('<time class="date-block" datetime="%s"><span class="date-block__day">%02d</span><span class="date-block__month">%s</span>'
            '<span class="date-block__week">%s</span></time>' % (e['start'][:10], d.day, d.strftime('%b'), d.strftime('%a')))


STREAK = ('<span class="impulse-rule__clip" aria-hidden="true"><svg class="streak impulse-rule__streak" viewBox="0 0 120 4" width="120" height="4" aria-hidden="true" focusable="false">'
          '<rect width="40" height="4" opacity=".12"/><rect x="40" width="40" height="4" opacity=".3"/><rect x="80" width="40" height="4" opacity=".78"/></svg></span>')


def event_row(e):
    tags = '<li class="tag tag--region">%s</li><li class="tag tag--format">%s</li>' % (esc(e['tags'][0] if e['tags'] else ''), FORMAT_LABEL.get(e['format'], 'Event'))
    return ('<li class="event-row" data-end="%s">\n  %s\n  <div class="event-row__main">\n'
            '    <h3 class="event-row__title"><a href="%sevents/%s/">%s</a></h3>\n    <p class="event-row__meta">%s</p>\n  </div>\n'
            '  <ul class="event-row__tags" role="list" aria-label="Tags">\n    %s\n  </ul>\n'
            '  <p class="event-row__state"><span class="state state--open">RSVP open</span><span class="event-row__go" aria-hidden="true">Details</span></p>\n  %s\n</li>'
            % (end_day(e), date_block(e), P, e['slug'], esc(e['title']), e['meta'], tags, STREAK))


def km(a, b):
    p = math.pi / 180
    d = math.sin((b['lat'] - a['lat']) * p / 2) ** 2 + math.cos(a['lat'] * p) * math.cos(b['lat'] * p) * math.sin((b['lon'] - a['lon']) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(d))


def fallback_events(c, limit=4):
    ups = sorted([e for e in EV if upcoming(e)], key=lambda e: e['start'])
    picked = []
    online = [e for e in ups if e['online'] and e['chapter'] != c['slug']]
    if online:
        picked.append(online[0])
    near = sorted([x for x in CHAPTERS if x['slug'] != c['slug']], key=lambda x: km(c, x))
    for x in near:
        for e in ups:
            if e['chapter'] == x['slug'] and e not in picked:
                picked.append(e)
        if len(picked) >= limit:
            break
    for e in ups:
        if len(picked) >= limit:
            break
        if not e['chapter'] and e not in picked:
            picked.append(e)
    return picked[:limit]


def chapter_events_section(c, old):
    m = re.search(r'sec-head__num">(\d+)<', old)
    num = m.group(1) if m else '02'
    own = sorted([e for e in EV if e['chapter'] == c['slug'] and upcoming(e)], key=lambda e: e['start'])
    own = [e for e in own if e['chapter'] == c['slug']]
    fb = fallback_events(c)
    name = esc(c['name'])
    own_html = ''
    if own:
        own_html = '      <ol class="event-list" role="list" data-own>\n' + '\n'.join(event_row(e) for e in own) + '\n      </ol>\n'
    empty = ('      <div class="empty-state cd-empty-events" data-own-empty%s>\n        <h3 class="empty-state__title">Nothing on the %s calendar yet.</h3>\n'
             '        <p>See online events and nearby chapters below.</p>\n      </div>\n' % (' hidden' if own else '', name))
    rows = '\n'.join(event_row(e) for e in fb)
    fb_html = ('      <div class="cd-also" data-also%s>\n        <h3 class="label cd-also__title">Also coming up</h3>\n        <ol class="event-list" role="list">\n%s\n        </ol>\n'
               '        <p class="cd-also__none" data-also-none%s>No other events are scheduled right now. <a class="link" href="%sevents/past/">See past events</a>.</p>\n      </div>\n'
               % (' hidden' if own else '', rows, ' hidden' if fb else '', P))
    return ('<section class="section surface-ivory cd-events" id="events" aria-labelledby="events-title" data-chapter="%s">\n  <div class="wrap">\n'
            '    <header class="sec-head grid" data-reveal="r4">\n'
            '  <p class="sec-head__eyebrow"><span class="label sec-head__num">%s</span><span class="label">Events</span></p>\n'
            '  <h2 class="sec-head__title" id="events-title">Upcoming events in %s.</h2>\n'
            '  <div class="sec-head__aside">\n      <p>Mixers, meetups and workshops in %s.</p>\n    </div>\n</header>\n'
            '    <div class="sec-body">\n%s%s%s    </div>\n'
            '    <p class="cd-more"><a class="link" href="%sevents/">View all events</a></p>\n  </div>\n</section>'
            % (c['slug'], num, name, name, own_html, empty, fb_html, P))


ROW_RE = re.compile(r'<li class="(event-row[^"]*|event-strip__item)"([^>]*)>(.*?)\n</li>\n?', re.S)


def prune_rows(s):
    def f(m):
        slug = re.search(r'/events/([^/"]+)/', m.group(3))
        e = EV_BY_SLUG.get(slug.group(1)) if slug else None
        if not e:
            return m.group(0)
        if not upcoming(e):
            return ''
        attrs = re.sub(r'\s*data-end="[^"]*"', '', m.group(2))
        tail = '\n' if m.group(0).endswith('\n') else ''
        return '<li class="%s"%s data-end="%s">%s\n</li>%s' % (m.group(1), attrs, end_day(e), m.group(3), tail)
    return ROW_RE.sub(f, s)


def home_events(s):
    ups = sorted([e for e in EV if upcoming(e)], key=lambda e: e['start'])
    none = '<a class="link" href="%sevents/past/">See past events</a>' % P
    if ups:
        strip = '\n'.join('      <li class="event-strip__item" data-end="%s">\n  %s\n  <div>\n    <h3 class="event-strip__title"><a href="%sevents/%s/">%s</a></h3>\n    <p class="event-strip__meta">%s</p>\n  </div>\n</li>'
                          % (end_day(e), date_block(e), P, e['slug'], esc(e['title']), e['meta']) for e in ups[:3])
        lst = '\n'.join(event_row(e) for e in ups[:6])
    else:
        strip = '      <li class="event-strip__item event-strip__item--none"><div><p class="event-strip__meta">No events are scheduled right now. %s</p></div></li>' % none
        lst = '        <li class="event-row event-row--none"><p>No events are scheduled right now. %s.</p></li>' % none
    s = re.sub(r'(<ol class="event-strip" role="list">).*?(</ol>)', lambda m: m.group(1) + '\n' + strip + '\n    ' + m.group(2), s, count=1, flags=re.S)
    s = re.sub(r'(<ol class="event-list" role="list" data-reveal="r1">).*?(</ol>)', lambda m: m.group(1) + '\n' + lst + '\n      ' + m.group(2), s, count=1, flags=re.S)
    return s


def recount_events_index(s):
    rows = re.findall(r'<li class="event-row ev-row"([^>]*)>', s)
    attrs = [dict(re.findall(r'data-(region|format|month)="([^"]*)"', r)) for r in rows]

    def chip(m):
        key, val = m.group(2), m.group(3)
        n = sum(1 for a in attrs if a.get(key) == val)
        if n == 0:
            return ''
        return m.group(1) + '<span class="chip__count">%d</span></button>' % n
    s = re.sub(r'(<button class="chip"[^>]*data-filter-key="(\w+)" data-filter-value="([^"]+)"[^>]*>[^<]*)<span class="chip__count">\d+</span></button>\n?', chip, s)
    s = re.sub(r'\s*<fieldset class="filter-group">\s*<legend>[^<]*</legend>\s*</fieldset>', '', s)

    def grp(m):
        return m.group(0) if '<li class="event-row' in m.group(0) else ''
    s = re.sub(r'\s*<section class="ev-month" data-group.*?</section>', grp, s, flags=re.S)
    s = re.sub(r'(<span class="result-count__n">)\d+(</span>)', lambda m: m.group(1) + str(len(rows)) + m.group(2), s)
    if not rows:
        s = s.replace('data-empty hidden', 'data-empty')
    return s


def breadcrumbs(s, rel):
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    page_url = canon.group(1) if canon else ORIGIN + P + rel
    m = re.search(r'<nav class="crumbs[^"]*"[^>]*><ol>(.*?)</ol></nav>', s, re.S)
    items = []
    if m:
        for i, li in enumerate(re.findall(r'<li>(.*?)</li>', m.group(1), re.S)):
            a = re.search(r'<a href="([^"]+)">(.*?)</a>', li, re.S)
            text = H.unescape(re.sub(r'<[^>]+>', '', a.group(2) if a else li)).strip()
            url = (ORIGIN + a.group(1)) if a and a.group(1).startswith('/') else (a.group(1) if a else page_url)
            items.append({'@type': 'ListItem', 'position': i + 1, 'name': text, 'item': url})
    elif rel == 'index.html':
        items = [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': page_url}]
    s = re.sub(r'<script type="application/ld\+json" data-breadcrumbs>.*?</script>\n?', '', s, flags=re.S)
    if not items:
        return s
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': items}, ensure_ascii=False, separators=(',', ':'))
    return s.replace('</head>', '<script type="application/ld+json" data-breadcrumbs>%s</script>\n</head>' % ld, 1)


def process(path):
    rel = str(path.relative_to(ROOT))
    s = path.read_text(encoding='utf-8')
    o = s
    s = sub_numbers(s)
    if rel == 'index.html':
        s = sub_block(s, 'regions', region_index())
        s = home_events(s)
    elif rel == 'chapters/index.html':
        s = sub_block(s, 'atlas', atlas())
        s = sub_block(s, 'forming', forming_list())
    elif rel == 'events/index.html':
        s = prune_rows(s)
        s = recount_events_index(s)
    else:
        m = re.match(r'chapters/([^/]+)/index\.html$', rel)
        if m and m.group(1) in BY_SLUG:
            c = BY_SLUG[m.group(1)]
            n = len(c['leaders'])
            if c['leaders']:
                body = '<ul class="people" role="list">\n' + '\n'.join(person_li(l) for l in c['leaders']) + '\n      </ul>'
                s = re.sub(r'<ul class="people" role="list">.*?\n      </ul>', lambda _: body, s, count=1, flags=re.S)
                s = re.sub(r'is led by \d+ professionals? who lives? and works? in the market',
                           'is led by %d professional%s who live%s and work%s in the market' % (n, '' if n == 1 else 's', 's' if n == 1 else '', 's' if n == 1 else ''), s)
            s = re.sub(r'(<span class="tag tag--region">)[^<]*(</span>)', lambda mm: mm.group(1) + esc(REGION[c['region']]['label']) + mm.group(2), s, count=1)
            old = re.search(r'<section class="section surface-ivory cd-events".*?</section>', s, re.S)
            if old:
                s = s.replace(old.group(0), chapter_events_section(c, old.group(0)), 1)
    s = breadcrumbs(s, rel)
    if s != o:
        path.write_text(s, encoding='utf-8')
        return True
    return False


def main():
    changed = 0
    for p in sorted(ROOT.rglob('*.html')):
        if '/.git/' in str(p):
            continue
        if process(p):
            changed += 1
    print('build ok: today=%s chapters=%d (active %d, forming %d) regions=%d, pages changed=%d'
          % (TODAY, NUM['chapters'], NUM['active'], NUM['forming'], NUM['regions'], changed))


if __name__ == '__main__':
    main()
