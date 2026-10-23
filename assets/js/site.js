(function () {
  "use strict";
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  var panel = document.getElementById("mobile-nav");
  var body = document.body;
  var wide = window.matchMedia("(min-width: 1100px)");
  if (header) {
    var ticking = false;
    var update = function () {
      header.classList.toggle("is-condensed", window.scrollY > 24);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
  if (!toggle || !panel) return;
  function focusables() {
    return Array.prototype.filter.call(
      panel.querySelectorAll("a[href], button:not([disabled])"),
      function (el) { return el.offsetParent !== null; }
    );
  }
  function open() {
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    body.classList.add("menu-open");
    var first = focusables()[0];
    if (first) first.focus();
    document.addEventListener("keydown", onKey);
  }
  function close(returnFocus) {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    body.classList.remove("menu-open");
    document.removeEventListener("keydown", onKey);
    if (returnFocus) toggle.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (e.key !== "Tab") return;
    var list = [toggle].concat(focusables());
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  toggle.addEventListener("click", function () {
    if (toggle.getAttribute("aria-expanded") === "true") close(false); else open();
  });
  panel.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a[href]")) close(false);
  });
  var onWide = function () { if (wide.matches && toggle.getAttribute("aria-expanded") === "true") close(false); };
  if (wide.addEventListener) wide.addEventListener("change", onWide); else if (wide.addListener) wide.addListener(onWide);
})();
(function () {
  "use strict";
  var CCC = (window.CCC = window.CCC || {});
  var root = document.documentElement, doc = document;
  var mq = matchMedia("(prefers-reduced-motion: reduce)");
  var EASE = "cubic-bezier(0.25, 1, 0.5, 1)", CAP = 6;
  var pending = [], io;
  function osReduced() { return mq.matches || !!(navigator.connection && navigator.connection.saveData); }
  function allowed() { return !osReduced() && root.getAttribute("data-motion") !== "off"; }
  function $$(s, c) { return [].slice.call((c || doc).querySelectorAll(s)); }
  function vh() { return innerHeight || root.clientHeight; }
  function clamp(p) { return p < 0 ? 0 : p > 1 ? 1 : p; }
  function onScroll(fn) {
    var t = false;
    addEventListener("scroll", function () { if (!t) { t = true; requestAnimationFrame(function () { t = false; fn(); }); } }, { passive: true });
  }
  function sync() {
    var off = osReduced();
    $$(".motion-toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", String(!off && root.getAttribute("data-motion") !== "off"));
      off ? b.setAttribute("aria-disabled", "true") : b.removeAttribute("aria-disabled");
    });
  }
  function changed() {
    sync();
    root.classList.toggle("motion-ok", allowed());
    if (!allowed()) settleAll();
    doc.dispatchEvent(new CustomEvent("ccc:motion", { detail: { allowed: allowed() } }));
  }
  function setMotion(on) {
    on ? root.removeAttribute("data-motion") : root.setAttribute("data-motion", "off");
    try { on ? localStorage.removeItem("ccc-motion") : localStorage.setItem("ccc-motion", "off"); } catch (e) {}
    changed();
  }
  mq.addEventListener ? mq.addEventListener("change", changed) : mq.addListener(changed);
  function below(el) { return el.getBoundingClientRect().top >= vh() - 1; }
  function restore(el) { if (el.__r3) { el.innerHTML = el.__r3; el.__r3 = null; } }
  function reveal(el) {
    el.classList.replace("is-pending", "is-in");
    if (el.__r3) setTimeout(restore, 1200, el);
  }
  function settleAll() {
    pending.forEach(function (el) { el.classList.remove("is-pending"); restore(el); });
    pending = [];
    if (io) io.disconnect();
  }
  function prepare(el, i) {
    el.style.setProperty("--i", Math.min(i, CAP));
    el.classList.add("is-pending");
    pending.push(el);
    io.observe(el);
  }
  function splitWords(el) {
    var kids = [].slice.call(el.childNodes), frag = doc.createDocumentFragment(), cur = null, words = [];
    function add(node) {
      if (!cur) {
        cur = doc.createElement("span");
        cur.className = "r3-w";
        cur.appendChild(doc.createElement("span"));
        frag.appendChild(cur);
        words.push(cur);
      }
      cur.firstChild.appendChild(node);
    }
    el.__r3 = el.innerHTML;
    kids.forEach(function (k) {
      if (k.nodeType === 1) { if (k.nodeName === "BR") { cur = null; frag.appendChild(k); } else add(k); return; }
      if (k.nodeType !== 3) return;
      k.nodeValue.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        if (/^\s/.test(p)) { cur = null; frag.appendChild(doc.createTextNode(p)); } else add(doc.createTextNode(p));
      });
    });
    el.textContent = "";
    el.appendChild(frag);
    var top = null, line = -1;
    words.forEach(function (w) {
      var t = Math.round(w.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      w.firstChild.style.setProperty("--i", Math.min(line, CAP));
    });
  }
  function initReveals() {
    if (!window.IntersectionObserver || !allowed()) return;
    if (window.innerWidth < 768) return;
    setTimeout(function () { if (!doc.hidden) settleAll(); }, 3000);
    if (doc.hidden) {
      doc.addEventListener("visibilitychange", function wake() {
        if (doc.hidden) return;
        doc.removeEventListener("visibilitychange", wake);
        initReveals();
      });
      return;
    }
    addEventListener("beforeprint", settleAll);
    root.classList.add("motion-ok");
    io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        var el = e.target;
        if (!e.isIntersecting || !(e.intersectionRatio >= 0.25 || e.intersectionRect.height >= vh() / 4)) return;
        io.unobserve(el);
        if (el.hasAttribute("data-stagger-self")) el.style.setProperty("--i", Math.min(n++, CAP));
        reveal(el);
        var k = pending.indexOf(el);
        if (k > -1) pending.splice(k, 1);
      });
    }, { threshold: [0, 0.25], rootMargin: "0px 0px -6% 0px" });
    $$("[data-reveal]").forEach(function (el) {
      var kind = el.getAttribute("data-reveal");
      if (kind === "r1" && !el.hasAttribute("data-reveal-self")) {
        [].filter.call(el.children, below).forEach(function (k) { k.setAttribute("data-stagger-self", ""); prepare(k, 0); });
        return;
      }
      if (!below(el)) return;
      if (kind === "r3") splitWords(el);
      prepare(el, kind === "r2" ? $$(":scope > [data-reveal=r2]", el.parentNode).indexOf(el) % 4 : 0);
    });
  }
  function rollCount(el, n) {
    if (!el) return;
    el.innerHTML = "<span>" + n + "</span>";
    if (!allowed()) return;
    el.classList.remove("is-rolling");
    void el.offsetWidth;
    el.classList.add("is-rolling");
  }
  var STREAK = '<svg class="streak impulse-rule__streak" viewBox="0 0 120 4" width="120" height="4" aria-hidden="true" focusable="false">' +
    '<rect width="40" height="4" opacity=".12"/><rect x="40" width="40" height="4" opacity=".3"/><rect x="80" width="40" height="4" opacity=".78"/></svg>';
  function impulse(clip, o) {
    o = o || {};
    if (!clip || !allowed() || clip.__run) return null;
    var s = clip.querySelector(".streak");
    if (!s) { clip.insertAdjacentHTML("beforeend", STREAK); s = clip.lastElementChild; }
    var w = clip.clientWidth;
    if (!s.animate || w < 24) return null;
    var flip = o.reverse ? " scaleX(-1)" : "", a = -130, b = w + 10;
    if (o.reverse) { a = b; b = -130; }
    clip.__run = true;
    var anim = s.animate([{ transform: "translateX(" + a + "px)" + flip }, { transform: "translateX(" + b + "px)" + flip }],
      { duration: o.duration || Math.min(1400, 600 + w * 0.9), delay: o.delay || 0, easing: EASE });
    anim.onfinish = anim.oncancel = function () { clip.__run = false; if (o.done) o.done(); };
    return anim;
  }
  function initImpulses() {
    var clip = doc.querySelector(".site-header .header-impulse"), btn = doc.querySelector(".site-header .btn--header");
    if (clip && btn) {
      var run = function () { clip.style.width = Math.max(0, root.clientWidth - btn.getBoundingClientRect().left) + "px"; impulse(clip); };
      btn.addEventListener("mouseenter", run);
      btn.addEventListener("focus", function () { if (btn.matches(":focus-visible")) run(); });
    }
    $$(".event-row").forEach(function (row) {
      var c = row.querySelector(".impulse-rule__clip");
      if (c) row.addEventListener("mouseenter", function () { impulse(c); });
    });
  }
  function moveGuide(svg, from, to, ms, done) {
    var p = svg.querySelector(".guide__impulse"), seg = +svg.getAttribute("data-seg") || 90;
    if (!p || !allowed() || !p.animate) { if (done) done(); return null; }
    p.style.strokeDasharray = seg + " 3000";
    var anim = p.animate([{ strokeDashoffset: seg - from * (1000 + seg) }, { strokeDashoffset: seg - to * (1000 + seg) }],
      { duration: ms || 1400, easing: EASE, fill: "forwards" });
    anim.onfinish = function () { if (done) done(); };
    return anim;
  }
  function initGuides() {
    if (!window.IntersectionObserver) return;
    var once = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.intersectionRatio < 0.4) return;
        once.unobserve(e.target);
        moveGuide(e.target, 0, 1);
      });
    }, { threshold: 0.4 });
    $$('svg.guide[data-guide="run"]').forEach(function (s) { once.observe(s); });
    $$('svg.guide[data-guide="hop"]').forEach(function (svg) {
      var stops = (svg.getAttribute("data-stops") || "").split(",").map(Number);
      var targets = $$(svg.getAttribute("data-targets") || "_none");
      var at = 0, reached = -1, q = Promise.resolve();
      var hop = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = targets.indexOf(e.target);
          if (!e.isIntersecting || i <= reached) return;
          hop.unobserve(e.target);
          reached = i;
          var to = stops[Math.min(i, stops.length - 1)];
          q = q.then(function () {
            return new Promise(function (res) { var from = at; at = to; moveGuide(svg, from, to, 520 + 600 * Math.abs(to - from), res); });
          });
        });
      }, { threshold: 0.5 });
      targets.forEach(function (t) { hop.observe(t); });
    });
  }
  function initRail() {
    var rail = doc.querySelector(".rail");
    if (!rail) return;
    var fill = rail.querySelector(".rail__fill"), ticks = $$(".rail__tick", rail), start = 0, end = 1;
    var secs = ticks.map(function (t) { return doc.getElementById(t.getAttribute("data-for")); });
    var after = doc.querySelector(rail.getAttribute("data-clip-after") || "#none");
    var before = doc.querySelector(rail.getAttribute("data-clip-before") || "#none");
    function y(el, edge) { return el.getBoundingClientRect()[edge] + pageYOffset - vh() / 2; }
    function measure() {
      if (!secs[0]) return;
      start = y(secs[0], "top");
      end = y(secs[secs.length - 1], "bottom");
      ticks.forEach(function (t, i) { if (secs[i]) t.style.top = (clamp((y(secs[i], "top") - start) / (end - start)) * 100).toFixed(2) + "%"; });
      update();
    }
    function update() {
      var on = allowed(), p = on ? clamp((pageYOffset - start) / (end - start)) : 1;
      fill.style.transform = "scaleY(" + p.toFixed(4) + ")";
      var r = rail.getBoundingClientRect(), h = r.height;
      var top = after ? Math.max(0, Math.min(h, after.getBoundingClientRect().bottom - r.top)) : 0;
      var bot = before ? Math.max(0, Math.min(h, r.bottom - before.getBoundingClientRect().top)) : 0;
      rail.style.clipPath = "inset(" + top.toFixed(1) + "px -16px " + bot.toFixed(1) + "px -16px)";
      rail.classList.toggle("is-shown", top + bot < h - 24);
      ticks.forEach(function (t, i) { t.classList.toggle("is-on", !on || (secs[i] && secs[i].getBoundingClientRect().top < vh() / 2)); });
    }
    onScroll(update);
    addEventListener("resize", measure);
    addEventListener("load", measure);
    doc.addEventListener("ccc:motion", update);
    if (doc.fonts) doc.fonts.ready.then(measure);
    measure();
  }
  function initDrift() {
    var items = $$("[data-drift]"), desk = matchMedia("(min-width: 1024px)"), live = [];
    if (!items.length || !window.IntersectionObserver) return;
    function update() {
      var on = allowed() && desk.matches;
      live.forEach(function (img) {
        var r = img.parentNode.getBoundingClientRect(), p = (r.top + r.height / 2 - vh() / 2) / (vh() / 2 + r.height / 2);
        img.style.transform = on ? "translate3d(0," + (-p * (+img.getAttribute("data-drift") || 14) / 2).toFixed(2) + "px,0) scale(1.03)" : "";
      });
    }
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = live.indexOf(e.target);
        if (e.isIntersecting && i < 0) live.push(e.target);
        else if (!e.isIntersecting && i >= 0) live.splice(i, 1);
      });
      update();
    });
    items.forEach(function (img) { seen.observe(img); });
    onScroll(update);
    doc.addEventListener("ccc:motion", update);
  }
  function initReadingRule() {
    var bar = doc.querySelector(".reading-rule"), body = doc.querySelector("[data-reading]");
    if (!bar || !body) return;
    function update() {
      var r = body.getBoundingClientRect(), total = r.height - vh() * 0.6;
      bar.style.transform = "scaleX(" + (total > 0 ? clamp((vh() * 0.4 - r.top) / total) : 1).toFixed(4) + ")";
    }
    onScroll(update);
    addEventListener("resize", update);
    update();
  }
  function boot() {
    sync();
    $$(".motion-toggle").forEach(function (b) {
      b.addEventListener("click", function () { if (!osReduced()) setMotion(root.getAttribute("data-motion") === "off"); });
    });
    initReveals();
    initImpulses();
    initGuides();
    initRail();
    initDrift();
    initReadingRule();
  }
  doc.readyState === "loading" ? doc.addEventListener("DOMContentLoaded", boot) : boot();
  CCC.motion = { allowed: allowed, set: setMotion, impulse: impulse, guide: moveGuide, rollCount: rollCount, streak: STREAK };
})();
try{
(function () {
  "use strict";
  /* Hide events whose end date has passed, so a static page never shows a stale date. */
  var d = new Date();
  var today = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  function qa(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function run() {
    var gone = 0;
    qa("[data-end]").forEach(function (el) {
      if (el.getAttribute("data-end") < today) { el.parentNode.removeChild(el); gone++; }
    });
    if (!gone) return;
    qa(".ev-month").forEach(function (g) { if (!g.querySelector(".event-row")) g.parentNode.removeChild(g); });
    var n = qa(".ev-row").length;
    qa(".result-count__n").forEach(function (el) { el.textContent = n; });
    qa("[data-filter-key]").forEach(function (chip) {
      var k = chip.getAttribute("data-filter-key"), v = chip.getAttribute("data-filter-value");
      var c = qa(".ev-row").filter(function (r) { return r.getAttribute("data-" + k) === v; }).length;
      var cnt = chip.querySelector(".chip__count");
      if (cnt) cnt.textContent = c;
      if (!c) chip.parentNode.removeChild(chip);
    });
    var sec = document.querySelector("[data-chapter]");
    if (sec) {
      var own = sec.querySelector("[data-own]");
      if (own && !own.querySelector(".event-row")) {
        own.parentNode.removeChild(own);
        var e = sec.querySelector("[data-own-empty]"), a = sec.querySelector("[data-also]");
        if (e) e.hidden = false;
        if (a) a.hidden = false;
      }
      var also = sec.querySelector("[data-also]");
      if (also && !also.querySelector(".event-row")) {
        var none = also.querySelector("[data-also-none]");
        if (none) none.hidden = false;
      }
    }
    var strip = document.querySelector(".event-strip");
    if (strip && !strip.querySelector(".event-strip__item")) {
      var li = document.createElement("li");
      li.className = "event-strip__item event-strip__item--none";
      li.textContent = "No events are scheduled right now.";
      strip.appendChild(li);
    }
    var emp = document.querySelector("[data-empty]");
    if (emp && !n && document.querySelector(".ev-row, .result-count__n")) emp.hidden = false;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
}catch(e){console.error('expiry.js',e)}
try{
(function () {
  "use strict";
  var CCC = (window.CCC = window.CCC || {});
  var doc = document;
  function $$(s, c) { return [].slice.call((c || doc).querySelectorAll(s)); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function motionOK() { return !!(CCC.motion && CCC.motion.allowed()); }
  function words(s) { return String(s || "").split(/\s+/).filter(Boolean); }
  function SmartList(root) {
    var items = $$("[data-item]", root);
    var chips = $$("[data-filter-key]", root);
    var search = root.querySelector("[data-search]");
    var sort = root.querySelector("[data-sort]");
    var countN = root.querySelector(".result-count__n");
    var noun = root.querySelector("[data-count-noun]");
    var live = root.querySelector("[data-announce]");
    var empty = root.querySelector("[data-empty]");
    var groups = $$("[data-group]", root);
    var roll = root.hasAttribute("data-roll");
    var keys = [], state = { q: "", f: {} }, last = -1, tAnn = 0, tSearch = 0;
    var sortDefault = sort ? sort.value : "";
    chips.forEach(function (c) {
      var k = c.getAttribute("data-filter-key");
      if (keys.indexOf(k) < 0) { keys.push(k); state.f[k] = ""; }
    });
    var data = items.map(function (el) {
      var d = { el: el, text: norm(el.getAttribute("data-text") || el.textContent), v: {} };
      keys.forEach(function (k) { d.v[k] = words(el.getAttribute("data-" + k)); });
      return d;
    });
    function match(d, skip) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], want = state.f[k];
        if (k !== skip && want && d.v[k].indexOf(want) < 0) return false;
      }
      if (state.q) {
        var t = state.q.split(" ");
        for (var j = 0; j < t.length; j++) if (d.text.indexOf(t[j]) < 0) return false;
      }
      return true;
    }
    function isActive() { return !!state.q || keys.some(function (k) { return !!state.f[k]; }); }
    function announce(n) {
      if (!live) return;
      clearTimeout(tAnn);
      tAnn = setTimeout(function () {
        var head = empty && empty.querySelector("[data-empty-title]");
        live.textContent = n === 0 && head ? head.textContent.trim() : n + " " + label(n) + " shown";
      }, 450);
    }
    function label(n) {
      if (!noun) return n === 1 ? "result" : "results";
      return n === 1 ? noun.getAttribute("data-one") : noun.getAttribute("data-many");
    }
    function reorder() {
      if (!sort) return;
      var spec = sort.value, dir = spec.charAt(0) === "-" ? -1 : 1, key = "data-sort-" + spec.replace(/^-/, "");
      var parents = [];
      items.forEach(function (el) { if (parents.indexOf(el.parentNode) < 0) parents.push(el.parentNode); });
      parents.forEach(function (p) {
        $$(":scope > [data-item]", p).sort(function (a, b) {
          var x = a.getAttribute(key) || "", y = b.getAttribute(key) || "";
          var nx = parseFloat(x), ny = parseFloat(y);
          var c = !isNaN(nx) && !isNaN(ny) && String(nx) === x && String(ny) === y ? nx - ny : x.localeCompare(y);
          return c * dir;
        }).forEach(function (el) { p.appendChild(el); });
      });
    }
    function apply(quiet) {
      var shown = 0, entering = [];
      data.forEach(function (d) {
        var ok = match(d);
        if (ok) shown++;
        if (d.el.hidden === ok) { d.el.hidden = !ok; if (ok) entering.push(d.el); }
      });
      groups.forEach(function (g) {
        g.hidden = !$$("[data-item]", g).some(function (el) { return !el.hidden; });
      });
      chips.forEach(function (c) {
        var k = c.getAttribute("data-filter-key"), v = c.getAttribute("data-filter-value") || "";
        var on = state.f[k] === v, n = 0;
        data.forEach(function (d) { if (match(d, k) && (!v || d.v[k].indexOf(v) >= 0)) n++; });
        c.setAttribute("aria-pressed", String(on));
        var cnt = c.querySelector(".chip__count");
        if (cnt) cnt.textContent = n;
        c.disabled = !on && n === 0;
      });
      if (empty) empty.hidden = shown > 0;
      var active = isActive();
      root.classList.toggle("is-filtered", active);
      $$("[data-reset]", root).forEach(function (b) { if (!empty || !empty.contains(b)) b.hidden = !active; });
      if (noun) noun.textContent = label(shown);
      if (shown !== last) {
        if (countN) {
          if (roll && !quiet && CCC.motion) CCC.motion.rollCount(countN, shown);
          else countN.textContent = shown;
        }
        if (!quiet) announce(shown);
        last = shown;
      }
      if (!quiet && motionOK()) {
        entering.slice(0, 8).forEach(function (el, i) {
          el.style.setProperty("--i", i);
          el.classList.remove("is-entering");
          void el.offsetWidth;
          el.classList.add("is-entering");
        });
      }
      if (!quiet && root.hasAttribute("data-url")) writeUrl();
    }
    function writeUrl() {
      try {
        var p = new URLSearchParams(location.search);
        keys.forEach(function (k) { state.f[k] ? p.set(k, state.f[k]) : p.delete(k); });
        state.q ? p.set("q", search.value.trim()) : p.delete("q");
        if (sort) sort.value !== sortDefault ? p.set("sort", sort.value) : p.delete("sort");
        var qs = p.toString();
        history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
      } catch (e) {  }
    }
    function load(params) {
      keys.forEach(function (k) {
        var v = params.get(k);
        if (v && chips.some(function (c) { return c.getAttribute("data-filter-key") === k && c.getAttribute("data-filter-value") === v; })) state.f[k] = v;
      });
      if (search && params.get("q")) { search.value = params.get("q"); state.q = norm(search.value); }
      if (sort && params.get("sort") && $$("option", sort).some(function (o) { return o.value === params.get("sort"); })) sort.value = params.get("sort");
    }
    function set(k, v) { if (k in state.f) { state.f[k] = v || ""; apply(); } }
    function query(q) { if (search) search.value = q; state.q = norm(q); apply(); }
    function reset(focus) {
      keys.forEach(function (k) { state.f[k] = ""; });
      state.q = "";
      if (search) search.value = "";
      if (sort && sort.value !== sortDefault) { sort.value = sortDefault; reorder(); }
      apply();
      if (focus) (search || chips[0] || root).focus();
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var k = c.getAttribute("data-filter-key"), v = c.getAttribute("data-filter-value") || "";
        set(k, state.f[k] === v ? "" : v);
      });
    });
    if (search) {
      search.addEventListener("input", function () {
        clearTimeout(tSearch);
        tSearch = setTimeout(function () { state.q = norm(search.value); apply(); }, 120);
      });
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && search.value) { e.preventDefault(); query(""); }
      });
      var form = search.form;
      if (form) form.addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(tSearch); query(search.value); });
    }
    if (sort) sort.addEventListener("change", function () { reorder(); apply(); });
    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-reset]");
      if (b && root.contains(b)) reset(true);
    });
    if (root.hasAttribute("data-preset")) load(new URLSearchParams(root.getAttribute("data-preset")));
    if (root.hasAttribute("data-url")) load(new URLSearchParams(location.search));
    reorder();
    apply(true);
    root.classList.add("is-live");
    return { set: set, query: query, reset: reset, refresh: function () { apply(); } };
  }
  var lists = (CCC.lists = {});
  $$("[data-list]").forEach(function (el, i) { lists[el.getAttribute("data-list") || "list-" + i] = el.cccList = SmartList(el); });
})();
}catch(e){console.error('filters.js',e)}
try{
// Membership pages: billing toggle, EN/PT/ES switch on the tier ladder, and ?tier= prefill on the join form.
// Vanilla, no network. The markup holds every language and both billing periods, so this file only sets
// attributes (data-billing, data-lang) that the CSS reads. It does nothing on pages without those hooks.
(function () {
  "use strict";
  var doc = document;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function motionOn() {
    if (window.CCC && window.CCC.motion && window.CCC.motion.allowed) return window.CCC.motion.allowed();
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }
  // ---------------------------------------------------------------- sliding thumb on a segmented control
  function place(seg, animate) {
    var th = $(".segmented__thumb", seg), on = $('[aria-pressed="true"]', seg);
    if (!th || !on) return;
    if (!animate) th.style.transition = "none";
    th.style.width = on.offsetWidth + "px";
    th.style.transform = "translateX(" + on.offsetLeft + "px)";
    if (!animate) { void th.offsetWidth; th.style.transition = ""; }
  }
  function prepareSegmented(seg) {
    var th = doc.createElement("span");
    th.className = "segmented__thumb";
    th.setAttribute("aria-hidden", "true");
    seg.insertBefore(th, seg.firstChild);
    seg.classList.add("has-thumb");
    place(seg, false);
    if (window.ResizeObserver) new ResizeObserver(function () { place(seg, false); }).observe(seg);
    window.addEventListener("resize", function () { place(seg, false); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { place(seg, false); });
  }
  // ---------------------------------------------------------------- tier ladder
  var NOTE = {
    en: { monthly: "Showing monthly prices, billed each month.", annual: "Showing annual prices, billed once a year. Each annual price is ten times the monthly price." },
    pt: { monthly: "Mostrando os preços mensais, cobrados todo mês.", annual: "Mostrando os preços anuais, cobrados uma vez por ano. Cada preço anual equivale a dez vezes o preço mensal." },
    es: { monthly: "Mostrando los precios mensuales, cobrados cada mes.", annual: "Mostrando los precios anuales, cobrados una vez al año. Cada precio anual equivale a diez veces el precio mensual." }
  };
  var TAG = { en: "en", pt: "pt-BR", es: "es" };
  function initLadder(ladder) {
    var note = $("[data-ladder-note]", ladder), body = $("[data-ladder-body]", ladder);
    var segs = $$("[data-segmented]", ladder), swapToken = 0;
    function paintNote() {
      if (!note) return;
      var lang = ladder.getAttribute("data-lang"), b = ladder.getAttribute("data-billing");
      note.textContent = NOTE[lang][b];
      note.setAttribute("lang", TAG[lang]);
    }
    function replaceAll(animate) { segs.forEach(function (s) { place(s, animate); }); }
    function press(attr, value) {
      $$("[" + attr + "]", ladder).forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.getAttribute(attr) === value));
      });
    }
    function setBilling(value) {
      if (value !== "monthly" && value !== "annual") return;
      ladder.setAttribute("data-billing", value);
      press("data-set-billing", value);
      $$("[data-join-link]", ladder).forEach(function (a) {
        var href = a.getAttribute("href").replace(/&billing=[a-z]+/, "");
        a.setAttribute("href", value === "annual" ? href + "&billing=annual" : href);
      });
      paintNote();
      replaceAll(true);
    }
    function setLang(value) {
      if (!NOTE[value] || ladder.getAttribute("data-lang") === value) return;
      var token = ++swapToken;
      function apply() {
        if (token !== swapToken) return;
        ladder.setAttribute("data-lang", value);
        press("data-set-lang", value);
        paintNote();
        replaceAll(false);
        if (body) body.classList.remove("is-swapping");
      }
      if (!motionOn() || !body) { apply(); return; }
      press("data-set-lang", value);
      replaceAll(true);
      body.classList.add("is-swapping");
      window.setTimeout(apply, 80);
    }
    segs.forEach(prepareSegmented);
    ladder.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-set-billing], [data-set-lang]") : null;
      if (!b || !ladder.contains(b)) return;
      if (b.hasAttribute("data-set-billing")) setBilling(b.getAttribute("data-set-billing"));
      else setLang(b.getAttribute("data-set-lang"));
    });
    var preset = query("billing");
    if (preset === "annual") setBilling("annual");
    paintNote();
  }
  // ---------------------------------------------------------------- join form: ?tier= and ?billing= prefill, running summary
  function initJoin(form) {
    var select = $("[data-join-tier]", form), sum = $("[data-join-summary]", form);
    var radios = $$('input[name="billing"]', form);
    if (!select) return;
    function billing() {
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
      return "monthly";
    }
    function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
    function paint() {
      if (!sum) return;
      var echoes = $$("[data-join-echo]", form);
      function write(text, chosen) {
        sum.textContent = text;
        echoes.forEach(function (el) { el.textContent = chosen ? text : ""; });
      }
      var opt = select.options[select.selectedIndex];
      if (!opt || !opt.value) { write("Choose a tier to see your price.", false); return; }
      var annual = billing() === "annual";
      var amount = annual ? opt.getAttribute("data-annual") : opt.getAttribute("data-monthly");
      write(opt.getAttribute("data-name") + ": " + money(amount) + (annual ? " per year, billed once a year." : " per month, billed each month."), true);
    }
    var tier = query("tier"), period = query("billing");
    if (tier) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === tier) { select.selectedIndex = i; break; }
      }
    }
    if (period === "annual" || period === "monthly") {
      radios.forEach(function (r) { r.checked = r.value === period; });
    }
    select.addEventListener("change", paint);
    radios.forEach(function (r) { r.addEventListener("change", paint); });
    // The demo form's reset button restores the markup defaults, so repaint the summary after it.
    form.addEventListener("reset", function () { window.setTimeout(paint, 0); });
    paint();
  }
  var ladder = $("[data-ladder]");
  if (ladder) initLadder(ladder);
  var join = $("[data-join-form]");
  if (join) initJoin(join);
})();
}catch(e){console.error('tiers.js',e)}
try{
(function () {
  var forms = document.querySelectorAll("form[data-demo-form]");
  if (!forms.length) return;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var DELAY = 900;
  var qs = "";
  try { qs = new URLSearchParams(location.search).get("state") || ""; } catch (e) { qs = ""; }
  [].forEach.call(forms, init);
  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.style.display = on ? "" : "none";
  }
  function labelOf(el) {
    var l = el.id && document.querySelector('label[for="' + el.id + '"]');
    var t = l ? l.textContent : el.getAttribute("aria-label") || el.name || "this field";
    return t.replace(/\(.*?\)|\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function check(el) {
    var v = el.type === "checkbox" ? el.checked : el.value.trim();
    if (el.required && !v) {
      return el.getAttribute("data-msg-required") || (el.type === "checkbox" ? "Confirm to continue." : "Enter " + labelOf(el) + ".");
    }
    if (v && el.type === "email" && !EMAIL.test(v)) {
      return el.getAttribute("data-msg-email") || "Enter an email address like name@company.com.";
    }
    return "";
  }
  function mark(el, msg) {
    var box = el.closest(".field-set") || el.parentNode;
    var err = box.querySelector(".field-error");
    if (el.__base === undefined) el.__base = el.getAttribute("aria-describedby") || "";
    if (msg) {
      if (!err) {
        err = document.createElement("p");
        err.className = "field-error";
        err.id = (el.id || el.name) + "-error";
        box.appendChild(err);
      }
      err.textContent = msg;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", (el.__base + " " + err.id).trim());
      box.classList.add("is-error");
    } else {
      if (err) err.remove();
      el.removeAttribute("aria-invalid");
      if (el.__base) el.setAttribute("aria-describedby", el.__base); else el.removeAttribute("aria-describedby");
      box.classList.remove("is-error");
    }
    return msg;
  }
  function init(form) {
    var btn = form.querySelector('[type="submit"]');
    var label = btn ? btn.textContent : "";
    var live = form.querySelector("[data-form-live]");
    var summary = form.querySelector("[data-form-summary]");
    var panels = {};
    var sent = false, busy = false;
    if (!live) {
      live = document.createElement("p");
      live.className = "visually-hidden";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      form.insertBefore(live, form.firstChild);
    }
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "form-summary";
      summary.setAttribute("data-form-summary", "");
      summary.tabIndex = -1;
      form.insertBefore(summary, form.firstChild);
    }
    show(summary, false);
    [].forEach.call(form.querySelectorAll("[data-form-state]"), function (p) {
      panels[p.getAttribute("data-form-state")] = p;
      show(p, false);
    });
    function fields() {
      return [].filter.call(form.querySelectorAll("input, select, textarea"), function (c) {
        return c.name && !c.disabled && c.type !== "hidden" && c.type !== "radio" && c.type !== "submit";
      });
    }
    function invalid() {
      return fields().filter(function (c) { return c.getAttribute("aria-invalid") === "true"; });
    }
    function say(t) {
      live.textContent = "";
      setTimeout(function () { live.textContent = t; }, 30);
    }
    function bodyShow(on) {
      [].forEach.call(form.children, function (c) {
        if (c.hasAttribute("data-form-state") || c.hasAttribute("data-form-summary") || c.hasAttribute("data-form-live")) return;
        show(c, on);
      });
    }
    function load(on) {
      if (!btn) return;
      btn.disabled = on;
      btn.classList.toggle("is-loading", on);
      btn.classList.toggle("btn--loading", on);
      btn.setAttribute("aria-busy", on ? "true" : "false");
      btn.textContent = on ? btn.getAttribute("data-loading") || "Sending" : label;
    }
    function setState(name, quiet) {
      var k;
      for (k in panels) show(panels[k], k === name);
      bodyShow(name !== "success" && name !== "closed");
      show(summary, false);
      if (name && panels[name]) {
        panels[name].tabIndex = -1;
        panels[name].focus({ preventScroll: !!quiet });
        say(panels[name].getAttribute("data-live") || panels[name].textContent.replace(/\s+/g, " ").trim());
      }
    }
    function renderSummary(bad) {
      var n = bad.length, h = document.createElement("h3"), ul = document.createElement("ul");
      h.id = (form.id || "form") + "-summary-title";
      h.textContent = summary.getAttribute("data-title") || (n === 1 ? "1 field needs attention" : n + " fields need attention");
      bad.forEach(function (c) {
        var li = document.createElement("li"), a = document.createElement("a"), e = c.closest(".field-set");
        a.href = "#" + c.id;
        a.textContent = (e && e.querySelector(".field-error") ? e.querySelector(".field-error").textContent : "");
        a.addEventListener("click", function (ev) { ev.preventDefault(); c.focus(); });
        li.appendChild(a);
        ul.appendChild(li);
      });
      summary.textContent = "";
      summary.setAttribute("aria-labelledby", h.id);
      summary.setAttribute("role", "group");
      summary.appendChild(h);
      summary.appendChild(ul);
    }
    function refresh() {
      var bad = invalid();
      if (summary.hidden) return;
      if (bad.length) renderSummary(bad); else show(summary, false);
    }
    function done() {
      var clip = form.querySelector(".impulse-rule__clip"), m = window.CCC && window.CCC.motion, shown = false;
      function go() { if (!shown) { shown = true; setState("success"); } }
      var run = clip && m && m.impulse ? m.impulse(clip, { done: go }) : null;
      if (run) setTimeout(go, 2400); else go();
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      sent = true;
      var bad = fields().filter(function (c) { return mark(c, check(c)); });
      if (bad.length) {
        renderSummary(bad);
        show(summary, true);
        summary.focus();
        say(summary.querySelector("h3").textContent + ". " + bad[0].closest(".field-set").querySelector(".field-error").textContent);
        return;
      }
      show(summary, false);
      show(panels.error, false);
      busy = true;
      load(true);
      say("Sending.");
      setTimeout(function () { busy = false; load(false); done(); }, DELAY);
    });
    form.addEventListener("focusout", function (e) {
      var c = e.target;
      if (!sent || fields().indexOf(c) < 0) return;
      var msg = mark(c, check(c));
      if (msg) say(msg);
      refresh();
    });
    function change(e) {
      var c = e.target;
      if (sent && c.getAttribute("aria-invalid") === "true" && !check(c)) { mark(c, ""); refresh(); }
    }
    form.addEventListener("input", change);
    form.addEventListener("change", change);
    form.addEventListener("click", function (e) {
      var r = e.target.closest ? e.target.closest("[data-form-reset]") : null;
      if (!r) return;
      e.preventDefault();
      form.reset();
      fields().forEach(function (c) { mark(c, ""); });
      sent = false;
      setState("", true);
      var first = fields()[0];
      if (first) first.focus();
    });
    var forced = form.getAttribute("data-demo-state") || qs;
    if (forced === "loading") load(true);
    else if (forced && panels[forced]) setState(forced, true);
  }
})();
}catch(e){console.error('forms-demo.js',e)}
window.CCC_SIG=window.CCC_SIG||{"field":{"width":1672.0,"height":941.0,"background":"#F1E8D8","gold":"#9C7C46","nodes":[{"cx":1254.5,"cy":152.5,"r":23.0,"outerR":31.976553910638962},{"cx":469.0,"cy":191.5,"r":23.0,"outerR":31.698100557729553},{"cx":84.0,"cy":381.0,"r":39.5,"outerR":49.51767361255979},{"cx":1581.0,"cy":479.5,"r":40.0,"outerR":49.51009997970111},{"cx":1137.0,"cy":670.5,"r":23.0,"outerR":31.80015723231569},{"cx":222.0,"cy":681.5,"r":24.0,"outerR":32.72995569810628}],"routes":[{"d":"M 84 -100 C 84 52.4, 84 204.9, 84 357.3 C 84 372.5, 90 387, 100.8 397.8 C 132.4 429.4, 164.1 461.1, 195.7 492.7 C 212.5 509.5, 222 532.4, 222 556.2 C 222 593.1, 222 630.1, 222 667.1 C 222 676.3, 225.7 685.2, 232.2 691.7 C 334.5 794, 436.9 896.4, 539.2 998.7 C 544.9 1004.4, 548 1012, 548 1019.9 C 548 1024.9, 548 1030, 548 1035","color":"#2D432B","direction":1},{"d":"M 1150 -100 C 1171.6 -78.4, 1193.3 -56.7, 1214.9 -35.1 C 1240.3 -9.7, 1254.5 24.6, 1254.5 60.5 C 1254.5 86.6, 1254.5 112.6, 1254.5 138.7 C 1254.5 147.5, 1258 156, 1264.3 162.3 C 1369.8 268, 1475.4 373.7, 1581 479.5 C 1618.7 517.2, 1656.4 554.9, 1694.1 592.6 C 1697.9 596.4, 1700 601.5, 1700 606.8 C 1700 751.2, 1700 895.6, 1700 1040","color":"#2D432B","direction":-1},{"d":"M 345 -100 C 345 -51.5, 345 -3, 345 45.4 C 345 93.2, 326 139, 292.3 172.7 C 222.9 242.1, 153.4 311.6, 84 381 C 57.1 407.9, 30.2 434.8, 3.4 461.6 C -14.2 479.2, -37.9 489, -62.7 489 C -78.5 489, -94.2 489, -110 489","color":"#2A5D5B","direction":-1},{"d":"M 1780 354 C 1746 388, 1711.9 422.1, 1677.9 456.1 C 1662.9 471.1, 1642.6 479.5, 1621.4 479.5 C 1616 479.5, 1610.5 479.5, 1605 479.5 C 1591.7 479.5, 1581 490.2, 1581 503.5 C 1581 585.1, 1581 666.8, 1581 748.4 C 1581 796.2, 1562 842, 1528.3 875.7 C 1473.5 930.5, 1418.8 985.2, 1364 1040","color":"#2A5D5B","direction":1},{"d":"M 600 -100 C 600 -70.6, 600 -41.2, 600 -11.7 C 600 34.5, 581.6 78.9, 548.9 111.6 C 522.3 138.2, 495.6 164.9, 469 191.5 C 414.7 245.8, 360.3 300.2, 306 354.5 C 289 371.5, 266 381, 242 381 C 189.3 381, 136.7 381, 84 381 C 19.3 381, -45.3 381, -110 381","color":"#D06E53","direction":1},{"d":"M 980 1040 C 980 938.5, 980 837, 980 735.5 C 980 699.6, 1009.1 670.5, 1045 670.5 C 1075.7 670.5, 1106.3 670.5, 1137 670.5 C 1196.5 670.5, 1256 670.5, 1315.4 670.5 C 1363.2 670.5, 1409 651.5, 1442.7 617.8 C 1483.2 577.3, 1523.6 536.9, 1564 496.5 C 1574.9 485.6, 1589.6 479.5, 1605 479.5 C 1663.3 479.5, 1721.7 479.5, 1780 479.5","color":"#D06E53","direction":-1}]},"player":{"length":5.5,"weight":24.0,"speed":0.65,"guides":0.0,"body":0.8,"gap":2960.0,"lines":0.65,"dots":0.65,"back":"bullet","front":"nose","cup":0.5},"groups":{"home-hero":{"shape":"V1","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"clock":"time","startPhase":4.2,"transparent":true,"avoid":false,"reduced":"static t=4.2"},"home-network":{"shape":"V4","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"clock":"scroll","scrollIdle":0.3,"startPhase":4.2,"reduced":"static t=4.2"},"events":{"shape":"V9","kind":"field","crop":{"cx":0.78,"cy":0.5,"scale":1.25},"routes":"all","dir":-1,"clock":"scroll","startPhase":4.2,"reduced":"static t=4.2"},"chapter-detail":{"shape":"V2","kind":"field","crop":{"cx":0.5,"cy":0.78,"scale":1.35},"routes":"all","dir":1,"clock":"scroll","startPhase":4.2,"reduced":"static t=4.2"},"about":{"shape":"V7","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1.1},"routes":"all","dir":1,"impulseColors":["forest"],"clock":"scroll","startPhase":4.2,"reduced":"static t=4.2"},"board":{"shape":"V3","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"quietCentre":{"from":0.33,"to":0.67},"clock":"scroll","startPhase":4.2,"reduced":"static t=4.2"},"not-found":{"shape":"V5","kind":"field","crop":{"cx":0.82,"cy":0.22,"scale":1.4},"routes":[1],"dir":1,"clock":"scroll","startPhase":4.2,"reduced":"static t=4.2"},"contact-band":{"shape":"V11","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","clock":"scroll","heightPx":96,"reduced":"same static frame"},"portrait":{"shape":"P1","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"clock":"time","startPhase":4.2,"hover":true,"hoverTarget":".person","avoid":false,"nodeSafe":false,"transparent":true,"reduced":"static t=4.2"},"lab-hero":{"shape":"V1","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"clock":"time","startPhase":4.2,"transparent":true,"avoid":false,"reduced":"static t=4.2"},"lab-network":{"shape":"V4","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","dir":1,"clock":"scroll","scrollIdle":0.3,"startPhase":4.2,"reduced":"static t=4.2"},"lab-contact":{"shape":"V11","kind":"field","crop":{"cx":0.5,"cy":0.5,"scale":1},"routes":"all","clock":"scroll","heightPx":96,"reduced":"same static frame","scrollIdle":0.3}},"staticPhase":4.2,"budget":{"maxLive":3,"maxLoop":3,"dprCap":1.5,"pixels":2100000},"limits":{"length":[1,12],"weight":[4,64],"speed":[0.25,2.5],"guides":[0,0.4],"body":[0,0.95],"gap":[0,2400]}};
(function () {
  "use strict";
  var SIG = window.CCC_SIG;
  if (!SIG || !window.Path2D) return;
  var CCC = (window.CCC = window.CCC || {});
  var FIELD = SIG.field;
  var PLAYER = SIG.player;
  var GROUPS = SIG.groups || {};
  var LIMITS = SIG.limits || {};
  var REST = typeof SIG.staticPhase === "number" ? SIG.staticPhase : 4.2;
  var BUDGET = SIG.budget || {};
  var MAX_LIVE = BUDGET.maxLive || 2;
  var MAX_LOOP = BUDGET.maxLoop || 1;
  var DPR_CAP = BUDGET.dprCap || 1.5;
  var PIXELS = BUDGET.pixels || 2100000;
  var NAMED = { forest: "#2D432B", teal: "#2A5D5B", coral: "#D06E53" };
  var CYCLES = [17, 19, 23, 21, 19, 17];
  var EXPOSURE = [0.78, 0.3, 0.12];
  var ONCE_SECONDS = 4.2;
  var root = document.documentElement;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var conn = navigator.connection;
  function motionAllowed() {
    return !reduceMQ.matches && !(conn && conn.saveData) && root.getAttribute("data-motion") !== "off";
  }
  var ROUTES = FIELD.routes.map(function (route, index) {
    var n = route.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    var x = n[0], y = n[1], total = 0;
    var xs = [x], ys = [y], ss = [0];
    for (var k = 2; k < n.length; k += 6) {
      var ax = n[k], ay = n[k + 1], bx = n[k + 2], by = n[k + 3], cx = n[k + 4], cy = n[k + 5];
      for (var j = 1; j <= 160; j++) {
        var t = j / 160, u = 1 - t;
        var px = u * u * u * x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * cx;
        var py = u * u * u * y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * cy;
        var last = xs.length - 1;
        total += Math.hypot(px - xs[last], py - ys[last]);
        xs.push(px); ys.push(py); ss.push(total);
      }
      x = cx; y = cy;
    }
    return {
      index: index,
      color: route.color,
      direction: route.direction,
      xs: Float64Array.from(xs),
      ys: Float64Array.from(ys),
      ss: Float64Array.from(ss),
      total: total,
      path: new Path2D(route.d)
    };
  });
  var NODE_ROUTES = FIELD.nodes.map(function (node) {
    var hits = [];
    ROUTES.forEach(function (r) {
      for (var i = 0; i < r.xs.length; i++) {
        if (Math.hypot(r.xs[i] - node.cx, r.ys[i] - node.cy) <= node.r) { hits.push(r.index); break; }
      }
    });
    return hits;
  });
  var PX = 0, PY = 0;
  function at(r, s) {
    if (s < 0) s = 0; else if (s > r.total) s = r.total;
    var ss = r.ss, lo = 0, hi = ss.length - 1;
    while (hi - lo > 1) {
      var m = (lo + hi) >> 1;
      if (ss[m] < s) lo = m; else hi = m;
    }
    var span = ss[hi] - ss[lo], t = (s - ss[lo]) / (span || 1);
    PX = r.xs[lo] + (r.xs[hi] - r.xs[lo]) * t;
    PY = r.ys[lo] + (r.ys[hi] - r.ys[lo]) * t;
  }
  // Each end of a streak has its own shape. "taper" thins and fades that end;
  // every other shape keeps it at full width and draws the end as a cap.
  var ENDS = ["taper", "round", "flat", "nose", "bullet", "cup"];
  function profile(t, body, back, front) {
    var cb = back !== "taper", cf = front !== "taper";
    if (body === 0) {
      return { width: (cb ? 1 : Math.pow(t, 0.7)) * (cf ? 1 : Math.min(1, (1 - t) / 0.11)),
               alpha: (cb ? 1 : Math.pow(t, 0.6)) * (cf ? 1 : Math.min(1, (1 - t) / 0.06)) };
    }
    var tail = (1 - body) * 0.8, head = (1 - body) * 0.2;
    return {
      width: Math.min(1, cb ? 1 : Math.pow(t / tail, 0.7), cf ? 1 : (1 - t) / head),
      alpha: Math.min(1, cb ? 1 : Math.pow(t / tail, 0.6), cf ? 1 : (1 - t) / (head * 0.55))
    };
  }
  // Draws one end of a streak at (x, y); (ux, uy) points out of the streak.
  function cap(lc, shape, x, y, ux, uy, w, cup) {
    var h = w / 2, k;
    if (shape === "round") {
      lc.beginPath(); lc.arc(x, y, h, 0, Math.PI * 2); lc.fill();
    } else if (shape === "nose" || shape === "bullet") {
      // "nose" is a square train front with rounded corners, "bullet" a long rounded one.
      lc.save(); lc.translate(x, y); lc.rotate(Math.atan2(uy, ux)); lc.beginPath();
      if (shape === "bullet") { lc.moveTo(-1, -h); lc.ellipse(0, 0, h * 1.6, h, 0, -Math.PI / 2, Math.PI / 2); lc.lineTo(-1, h); }
      else { k = h * 0.6; lc.moveTo(-1, -h); lc.arcTo(k, -h, k, h, k); lc.arcTo(k, h, -1, h, k); lc.lineTo(-1, h); }
      lc.closePath(); lc.fill(); lc.restore();
    } else if (shape === "cup") {
      // A concave end, like the arcs of the mark cupping a dot. The bite passes
      // through both corners and goes cup * half the width deep.
      var d = h * cup, c = (h * h - d * d) / (2 * d);
      lc.save(); lc.globalCompositeOperation = "destination-out";
      lc.beginPath(); lc.arc(x + ux * c, y + uy * c, c + d, 0, Math.PI * 2); lc.fill(); lc.restore();
    }
  }
  var profileCache = {};
  function profileTable(samples, body, back, front) {
    var key = samples + ":" + body + ":" + back + ":" + front;
    if (profileCache[key]) return profileCache[key];
    var W = new Float32Array(samples), A = new Float32Array(samples);
    var bestS = -1, bestE = -1, runS = -1;
    for (var j = 0; j <= samples; j++) {
      var full = false;
      if (j < samples) {
        var e = profile((j + 0.5) / samples, body, back, front);
        W[j] = e.width; A[j] = e.alpha;
        full = e.width >= 1 && e.alpha >= 1;
      }
      if (full && runS < 0) runS = j;
      if (!full && runS >= 0) {
        if (j - runS > bestE - bestS) { bestS = runS; bestE = j; }
        runS = -1;
      }
    }
    return (profileCache[key] = { W: W, A: A, plateauStart: bestS, plateauEnd: bestE });
  }
  function clamp(v, range) {
    if (typeof v !== "number" || !isFinite(v)) return undefined;
    return range ? Math.min(range[1], Math.max(range[0], v)) : v;
  }
  function params(overrides) {
    var p = {};
    ["length", "weight", "speed", "guides", "body", "gap"].forEach(function (k) {
      var v = overrides && clamp(overrides[k], LIMITS[k]);
      p[k] = v === undefined ? PLAYER[k] : v;
    });
    ["front", "back"].forEach(function (k) {
      var v = overrides && overrides[k];
      p[k] = ENDS.indexOf(v) >= 0 ? v : ENDS.indexOf(PLAYER[k]) >= 0 ? PLAYER[k] : "taper";
    });
    ["lines", "dots"].forEach(function (k) {
      var v = overrides && clamp(overrides[k], [0, 1]);
      p[k] = v === undefined ? (typeof PLAYER[k] === "number" ? PLAYER[k] : 1) : v;
    });
    var cup = overrides && clamp(overrides.cup, [0.1, 1]);
    p.cup = cup === undefined ? (typeof PLAYER.cup === "number" ? PLAYER.cup : 0.5) : cup;
    return p;
  }
  var instances = [];
  var live = [];
  var waiting = [];
  var rafId = 0;
  var lastNow = 0;
  // Scrolling wakes "scroll" fields up to the speed setting, never past it; the push fades
  // out within about a second.
  var scrollBoost = 0, lastY = window.scrollY;
  addEventListener("scroll", function () {
    var y = window.scrollY;
    scrollBoost = Math.min(1, scrollBoost + Math.abs(y - lastY) / 120);
    lastY = y;
  }, { passive: true });
  function loop(now) {
    rafId = 0;
    var delta = lastNow ? Math.min((now - lastNow) / 1000, 0.1) : 0;
    lastNow = now;
    scrollBoost *= Math.pow(0.04, delta);
    for (var i = live.length - 1; i >= 0; i--) if (live[i]) live[i].step(delta);
    if (live.length && !document.hidden) rafId = requestAnimationFrame(loop);
    else lastNow = 0;
  }
  function ensureLoop() {
    if (!rafId && live.length && !document.hidden) rafId = requestAnimationFrame(loop);
  }
  function canStart(inst) {
    if (live.length >= MAX_LIVE) return false;
    if (!inst.loops) return true;
    var loops = 0;
    for (var i = 0; i < live.length; i++) if (live[i].loops) loops++;
    return loops < MAX_LOOP;
  }
  function request(inst) {
    if (inst.playing) return;
    if (canStart(inst)) { inst.begin(); live.push(inst); ensureLoop(); }
    else if (waiting.indexOf(inst) < 0) waiting.push(inst);
  }
  function release(inst) {
    var i = live.indexOf(inst);
    if (i >= 0) live.splice(i, 1);
    i = waiting.indexOf(inst);
    if (i >= 0) waiting.splice(i, 1);
    inst.playing = false;
    for (var k = 0; k < waiting.length; k++) {
      var w = waiting[k];
      if (canStart(w)) { waiting.splice(k, 1); k--; w.begin(); live.push(w); }
    }
    ensureLoop();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = 0; lastNow = 0; }
    else ensureLoop();
  });
  var hasIO = "IntersectionObserver" in window;
  var prepareIO = hasIO && new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      prepareIO.unobserve(entry.target);
      var inst = entry.target.__cccSignature;
      if (inst) inst.prepare();
    });
  }, { rootMargin: "300px 0px" });
  var visibleIO = hasIO && new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var inst = entry.target.__cccSignature;
      if (!inst) return;
      inst.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
      inst.evaluate();
    });
  }, { threshold: [0, 0.1, 0.35] });
  var resizeRO = "ResizeObserver" in window && new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var inst = entry.target.__cccAvoidFor || (entry.target.parentNode && entry.target.parentNode.__cccSignature);
      if (inst && inst.prepared) inst.resize();
    });
  });
  function Field(el, opts) {
    var self = this;
    this.el = el;
    this.canvas = el.querySelector(".field__canvas");
    this.poster = el.querySelector(".field__poster");
    this.ctx = this.canvas.getContext("2d");
    this.layer = null;
    this.lc = null;
    this.P = params(opts.params);
    this.crop = opts.crop || { cx: 0.5, cy: 0.5, scale: 1 };
    this.dir = opts.dir === -1 ? -1 : 1;
    this.mask = opts.quietCentre || null;
    // Transparent fields draw lines only, so a photo can sit under them and a cutout over them.
    this.transparent = !!opts.transparent;
    this.nodeSafe = opts.nodeSafe !== false;
    var scope = el.closest("section, header, footer, aside") || el.parentNode;
    this.avoidEls = opts.avoid === false ? [] : Array.prototype.filter.call(
      scope.querySelectorAll(opts.avoid || ".panel, [data-field-avoid]"),
      function (a) { return !a.contains(el) && !el.contains(a); });
    var clock = opts.clock || "once";
    this.mq = opts.mobile && window.matchMedia("(max-width: " + opts.mobile.maxWidth + "px)");
    this.mcrop = opts.mobile && opts.mobile.crop;
    if (this.mq && this.mq.matches) clock = opts.mobile.clock || clock;
    this.clock = clock;
    // "time" drifts on its own; "scroll" drifts too and speeds up while the page scrolls.
    this.loops = clock === "time" || clock === "scroll";
    this.startPhase = typeof opts.startPhase === "number" ? opts.startPhase : REST;
    if (this.mq && this.mq.matches && typeof opts.mobile.startPhase === "number") this.startPhase = opts.mobile.startPhase;
    this.rampMs = opts.rampMs || 0;
    // A "scroll" field drifts at this share of the speed setting at rest and reaches the setting while the page scrolls.
    this.idle = typeof opts.scrollIdle === "number" ? Math.min(1, Math.max(0, opts.scrollIdle)) : 1;
    this.span = (this.P.speed * ONCE_SECONDS) / 3;
    var all = opts.routes === "all" || !opts.routes;
    this.routes = ROUTES.filter(function (r) { return all || opts.routes.indexOf(r.index) >= 0; });
    var picked = this.routes.map(function (r) { return r.index; });
    this.nodes = FIELD.nodes.filter(function (node, i) {
      return all || NODE_ROUTES[i].some(function (ri) { return picked.indexOf(ri) >= 0; });
    });
    var colors = (opts.impulseColors || []).map(function (c) { return NAMED[c] || c; });
    this.routes = this.routes.map(function (r, i) {
      return { r: r, guide: r.color, impulse: colors.length ? colors[i % colors.length] : r.color, dir: r.direction * self.dir };
    });
    this.samples = Math.ceil(96 * this.P.length);
    this.table = profileTable(this.samples, this.P.body, this.P.back, this.P.front);
    this.time = this.restingTime();
    this.elapsed = 0;
    this.onceElapsed = 0;
    this.started = false;
    this.done = false;
    this.playing = false;
    this.prepared = false;
    // Hover fields rest on their first frame until the card is hovered or focused.
    this.userPaused = !!opts.hover;
    this.degraded = false;
    this.throttled = false;
    this.skip = false;
    this.ratio = 0;
    this.frames = 0;
    this.ema = 0;
    this.lastCost = 0;
    this.prevBox = null;
    this.s = 1; this.dx = 0; this.dy = 0;
    this.button = el.id ? document.querySelector('[data-pause-for="' + el.id + '"]') : null;
    if (this.button) {
      this.onPress = function () {
        self.userPaused = !self.userPaused;
        self.button.setAttribute("aria-pressed", String(self.userPaused));
        if (self.userPaused) release(self); else self.evaluate();
      };
      this.button.addEventListener("click", this.onPress);
    }
    this.syncButton();
    el.__cccSignature = this;
    if (prepareIO) prepareIO.observe(el); else this.prepare();
    if (visibleIO) visibleIO.observe(el);
    if (resizeRO) {
      resizeRO.observe(this.canvas);
      this.avoidEls.forEach(function (a) { a.__cccAvoidFor = self; resizeRO.observe(a); });
    }
  }
  Field.prototype.restingTime = function () {
    if (!motionAllowed() || this.clock === "static" || this.degraded) return REST;
    if (this.loops || this.done) return this.startPhase;
    return this.startPhase - this.span;
  };
  Field.prototype.syncButton = function () {
    if (!this.button) return;
    this.button.hidden = !(this.loops && motionAllowed() && !this.degraded);
  };
  Field.prototype.prepare = function () {
    if (this.prepared) return;
    this.layer = document.createElement("canvas");
    this.lc = this.layer.getContext("2d");
    this.prepared = true;
    this.resize();
    this.el.classList.add("is-live");
    this.evaluate();
  };
  Field.prototype.resize = function () {
    var cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    var ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP, Math.sqrt(PIXELS / (cw * ch)));
    var w = Math.round(cw * ratio), h = Math.round(ch * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = this.layer.width = w;
      this.canvas.height = this.layer.height = h;
      this.prevBox = null;
    }
    this.ratio_ = ratio;
    this.place(w, h);
    this.render();
  };
  Field.prototype.place = function (w, h) {
    var Wf = FIELD.width, Hf = FIELD.height, c = (this.mq && this.mq.matches && this.mcrop) || this.crop;
    var base = Math.max(w / Wf, h / Hf), scale = c.scale || 1;
    var s = base * scale;
    var dx = w / 2 - (c.cx == null ? 0.5 : c.cx) * Wf * s;
    var dy = h / 2 - (c.cy == null ? 0.5 : c.cy) * Hf * s;
    var minX = w - Wf * s, minY = h - Hf * s;
    dx = Math.min(0, Math.max(minX, dx));
    dy = Math.min(0, Math.max(minY, dy));
    if (this.nodeSafe && this.nodes.length) dy += this.nodeShift(s, dy, h, minY);
    var rects = this.nodeSafe && this.nodes.length ? this.avoidRects(w, h) : [];
    if (this.nodeSafe && this.nodes.length && this.fit(s, dx, dy, w, h, rects) < 0) {
      var best = this.solve(w, h, c, base, scale, rects);
      if (best) { s = best[0]; dx = best[1]; dy = best[2]; }
    }
    this.s = s; this.dx = dx; this.dy = dy;
    if (this.poster) {
      this.poster.setAttribute("viewBox", [-dx / s, -dy / s, w / s, h / s].map(function (v) { return v.toFixed(2); }).join(" "));
      this.poster.setAttribute("preserveAspectRatio", "none");
    }
  };
  Field.prototype.avoidRects = function (w, h) {
    if (!this.avoidEls.length) return [];
    var cb = this.canvas.getBoundingClientRect(), k = this.ratio_ || 1, g = 6 * k, out = [];
    this.avoidEls.forEach(function (a) {
      var r = a.getBoundingClientRect(), t = getComputedStyle(a).transform, m = t && t !== "none" && t.match(/-?[\d.e]+/g);
      if (!r.width || !r.height) return;
      var tx = m && m.length === 6 ? +m[4] : 0, ty = m && m.length === 6 ? +m[5] : 0;
      var L = (r.left - tx - cb.left) * k - g, T = (r.top - ty - cb.top) * k - g, R = (r.right - tx - cb.left) * k + g, B = (r.bottom - ty - cb.top) * k + g;
      if (R > 0 && B > 0 && L < w && T < h) out.push([L, T, R, B]);
    });
    return out;
  };
  Field.prototype.fit = function (s, dx, dy, w, h, rects) {
    var m = 6 * (this.ratio_ || 1), seen = 0;
    for (var i = 0; i < this.nodes.length; i++) {
      var n = this.nodes[i], x = n.cx * s + dx, y = n.cy * s + dy, R = n.outerR * s;
      if (x + R <= 0 || x - R >= w || y + R <= 0 || y - R >= h) continue;
      if (y - R < m || y + R > h - m || x - R < m || x + R > w - m) return -1;
      for (var j = 0; j < rects.length; j++) {
        var q = rects[j], px = Math.max(q[0], Math.min(x, q[2])), py = Math.max(q[1], Math.min(y, q[3]));
        if ((px - x) * (px - x) + (py - y) * (py - y) < R * R) return -1;
      }
      seen++;
    }
    return seen;
  };
  function stops(lo, hi, pos, R, size, m, rects, a, b, k) {
    var out = [lo, hi], e = 0.5 * k;
    for (var i = 0; i < pos.length; i++) {
      var p = pos[i], r = R[i];
      out.push(m + r - p + e, -r - p - e, size - m - r - p - e, size + r - p + e);
      for (var j = 0; j < rects.length; j++) out.push(rects[j][b] + r - p + e, rects[j][a] - r - p - e);
    }
    for (var g = lo; g < hi; g += 24 * k) out.push(g);
    return out.filter(function (v) { return v >= lo && v <= hi; });
  }
  Field.prototype.solve = function (w, h, c, base, scale, rects) {
    var Wf = FIELD.width, Hf = FIELD.height, k = this.ratio_ || 1, nodes = this.nodes;
    for (var z = scale; z <= Math.max(scale, 1.5) + 1e-6; z += 0.05) {
      var s = base * z, minX = w - Wf * s, minY = h - Hf * s;
      var dx0 = Math.min(0, Math.max(minX, w / 2 - (c.cx == null ? 0.5 : c.cx) * Wf * s));
      var dy0 = Math.min(0, Math.max(minY, h / 2 - (c.cy == null ? 0.5 : c.cy) * Hf * s));
      var R = nodes.map(function (n) { return n.outerR * s; });
      var xs = stops(minX, 0, nodes.map(function (n) { return n.cx * s; }), R, w, 6 * k, rects, 0, 2, k).concat(dx0);
      var ys = stops(minY, 0, nodes.map(function (n) { return n.cy * s; }), R, h, 6 * k, rects, 1, 3, k).concat(dy0);
      var best = null, bestCost = Infinity;
      for (var i = 0; i < xs.length; i++) {
        for (var j = 0; j < ys.length; j++) {
          var seen = this.fit(s, xs[i], ys[j], w, h, rects);
          if (seen < 1) continue;
          var cost = Math.abs(xs[i] - dx0) + Math.abs(ys[j] - dy0) - 80 * k * seen;
          if (cost < bestCost) { bestCost = cost; best = [s, xs[i], ys[j]]; }
        }
      }
      if (best) return best;
    }
    return null;
  };
  Field.prototype.nodeShift = function (s, dy, h, minY) {
    var m = 6 * (this.ratio_ || 1);
    var nodes = this.nodes.map(function (n) { return { y: n.cy * s + dy, R: n.outerR * s }; });
    function clean(shift) {
      for (var i = 0; i < nodes.length; i++) {
        var top = nodes[i].y + shift - nodes[i].R, bottom = nodes[i].y + shift + nodes[i].R;
        var cutTop = top < m && bottom > -m;
        var cutBottom = bottom > h - m && top < h + m;
        var fullyOut = bottom <= 0 || top >= h;
        if ((cutTop || cutBottom) && !fullyOut) return false;
      }
      return true;
    }
    if (clean(0)) return 0;
    var candidates = [];
    nodes.forEach(function (n) {
      candidates.push(m - n.y + n.R, -n.y - n.R, h - m - n.y - n.R, h - n.y + n.R);
    });
    var lo = minY - dy, hi = -dy, best = 0, bestAbs = Infinity;
    candidates.forEach(function (c) {
      if (c < lo || c > hi || Math.abs(c) >= bestAbs) return;
      if (clean(c)) { best = c; bestAbs = Math.abs(c); }
    });
    return best;
  };
  Field.prototype.maskFill = function (w) {
    if (this.maskW === w && this.maskGrad) return this.maskGrad;
    var m = this.mask, ramp = m.ramp == null ? 0.12 : m.ramp;
    var a = Math.max(0, m.from - ramp), b = Math.min(1, m.to + ramp);
    var g = this.lc.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(a, "rgba(255,255,255,0)");
    g.addColorStop(m.from, "rgba(255,255,255,1)");
    g.addColorStop(m.to, "rgba(255,255,255,1)");
    g.addColorStop(b, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    this.maskW = w; this.maskGrad = g;
    return g;
  };
  Field.prototype.render = function () {
    if (!this.prepared || !this.canvas.width) return;
    var t0 = performance.now();
    this.draw(this.time);
    this.lastCost = performance.now() - t0;
  };
  Field.prototype.draw = function (time) {
    var ctx = this.ctx, lc = this.lc, P = this.P;
    var w = this.canvas.width, h = this.canvas.height, s = this.s, dx = this.dx, dy = this.dy;
    var table = this.table, W = table.W, A = table.A, pS = table.plateauStart, pE = table.plateauEnd;
    var samples = this.samples;
    var trail = 260 * P.length, travel = trail + P.gap;
    var pad = P.weight / 2 + 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    this.ink = 0;
    if (this.transparent) ctx.clearRect(0, 0, w, h);
    else { ctx.fillStyle = FIELD.background; ctx.fillRect(0, 0, w, h); }
    ctx.setTransform(s, 0, 0, s, dx, dy);
    var guideWidth = Math.max(2, (this.ratio_ || 1) / s);
    for (var ri = 0; ri < this.routes.length; ri++) {
      var entry = this.routes[ri], r = entry.r, i = r.index, dir = entry.dir, total = r.total;
      ctx.globalAlpha = P.guides;
      ctx.lineWidth = guideWidth;
      ctx.strokeStyle = entry.guide;
      ctx.stroke(r.path);
      ctx.globalAlpha = 1;
      for (var exposure = 0; exposure < 3; exposure++) {
        lc.setTransform(1, 0, 0, 1, 0, 0);
        if (this.prevBox) lc.clearRect(this.prevBox[0], this.prevBox[1], this.prevBox[2], this.prevBox[3]);
        else lc.clearRect(0, 0, w, h);
        lc.setTransform(s, 0, 0, s, dx, dy);
        lc.strokeStyle = entry.impulse;
        lc.lineCap = "round";
        lc.lineJoin = "round";
        var distance = ((time / 12 - (exposure * 0.22) / 720) * CYCLES[i] + i * 0.173) * (total + 260);
        var head = ((distance % travel) + travel) % travel;
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        var laps = Math.ceil((total + trail) / travel);
        for (var lap = 0; lap <= laps; lap++) {
          var start = head + lap * travel - trail;
          var first = Math.max(0, Math.floor((-start / trail) * samples));
          var end = Math.min(samples, Math.ceil(((total - start) / trail) * samples));
          if (end <= first) continue;
          var a = start + (first / samples) * trail;
          at(r, dir === 1 ? a : total - a);
          var a0x = PX, a0y = PY, px = PX, py = PY, inRun = false, ox = px, oy = py, tx = 0, ty = 0;
          if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
          for (var j = first; j < end; j++) {
            var b = start + ((j + 1) / samples) * trail;
            at(r, dir === 1 ? b : total - b);
            var qx = PX, qy = PY;
            if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
            if (j === first) { tx = qx; ty = qy; }
            if (j >= pS && j < pE) {
              if (!inRun) {
                lc.lineWidth = P.weight; lc.globalAlpha = 1; lc.lineCap = "butt";
                lc.beginPath(); lc.moveTo(px, py); inRun = true;
              }
              lc.lineTo(qx, qy);
            } else {
              if (inRun) { lc.stroke(); inRun = false; }
              lc.lineCap = "round";
              var wj = W[j], aj = A[j];
              if (aj >= 0.001 && wj >= 0.001) {
                lc.lineWidth = P.weight * wj; lc.globalAlpha = aj;
                lc.beginPath(); lc.moveTo(px, py); lc.lineTo(qx, qy); lc.stroke();
              }
            }
            ox = px; oy = py; px = qx; py = qy;
          }
          if (inRun) lc.stroke();
          lc.globalAlpha = 1; lc.fillStyle = entry.impulse;
          var ul;
          if (end === samples && (ul = Math.hypot(px - ox, py - oy))) cap(lc, P.front, px, py, (px - ox) / ul, (py - oy) / ul, P.weight, P.cup);
          if (first === 0 && (ul = Math.hypot(tx - a0x, ty - a0y))) cap(lc, P.back, a0x, a0y, (a0x - tx) / ul, (a0y - ty) / ul, P.weight, P.cup);
        }
        if (x0 === Infinity) { this.prevBox = null; continue; }
        var bx0 = Math.max(0, Math.floor((x0 - pad) * s + dx));
        var by0 = Math.max(0, Math.floor((y0 - pad) * s + dy));
        var bx1 = Math.min(w, Math.ceil((x1 + pad) * s + dx));
        var by1 = Math.min(h, Math.ceil((y1 + pad) * s + dy));
        if (bx1 <= bx0 || by1 <= by0) { this.prevBox = null; continue; }
        var box = [bx0, by0, bx1 - bx0, by1 - by0];
        if (exposure === 0) this.ink += box[2] * box[3];
        if (this.mask) {
          lc.setTransform(1, 0, 0, 1, 0, 0);
          lc.globalCompositeOperation = "destination-out";
          lc.globalAlpha = 1;
          lc.fillStyle = this.maskFill(w);
          lc.fillRect(box[0], box[1], box[2], box[3]);
          lc.globalCompositeOperation = "source-over";
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = EXPOSURE[exposure] * P.lines;
        ctx.drawImage(this.layer, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
        ctx.restore();
        this.prevBox = box;
      }
    }
    // The ring stays solid so lines never show through; only the gold fades into it.
    ctx.globalAlpha = 1;
    for (var n = 0; n < this.nodes.length; n++) {
      var node = this.nodes[n];
      ctx.globalAlpha = 1;
      if (this.transparent) {
        // Over a photo the ring is painted in the field colour too, so nothing shows under the
        // dot, and the gold is pre-mixed into that colour so the dot itself is never see-through.
        ctx.fillStyle = FIELD.background;
        ctx.beginPath(); ctx.arc(node.cx, node.cy, node.outerR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mixHex(FIELD.background, FIELD.gold, P.dots);
      } else {
        ctx.fillStyle = FIELD.background;
        ctx.beginPath(); ctx.arc(node.cx, node.cy, node.outerR, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = P.dots;
        ctx.fillStyle = FIELD.gold;
      }
      ctx.beginPath(); ctx.arc(node.cx, node.cy, node.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  function mixHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = "#";
    for (var k = 16; k >= 0; k -= 8) {
      var c = Math.round(((x >> k) & 255) * (1 - t) + ((y >> k) & 255) * t);
      out += (c < 16 ? "0" : "") + c.toString(16);
    }
    return out;
  }
  Field.prototype.begin = function () {
    this.playing = true;
    this.elapsed = 0;
    if (this.clock === "once" && !this.started) { this.started = true; this.onceElapsed = 0; }
  };
  Field.prototype.step = function (delta) {
    if (this.loops) {
      this.elapsed += delta * 1000;
      var k = this.rampMs ? Math.min(1, this.elapsed / this.rampMs) : 1;
      k = k * k * (3 - 2 * k);
      this.time += delta * this.P.speed * k * (this.clock === "scroll" ? Math.max(this.idle, scrollBoost) : 1);
    } else {
      this.onceElapsed += delta;
      var p = Math.min(1, this.onceElapsed / ONCE_SECONDS);
      this.time = this.startPhase - this.span * Math.pow(1 - p, 3);
      if (p >= 1) {
        this.time = this.startPhase;
        this.done = true;
        this.render();
        release(this);
        return;
      }
    }
    if (this.throttled) { this.skip = !this.skip; if (this.skip) return; }
    this.render();
    if (this.settling) {
      // A hover field keeps running after the pointer leaves until lines fill the frame, then holds.
      this.settleLeft -= delta;
      if (this.ink >= 0.2 * this.canvas.width * this.canvas.height || this.settleLeft <= 0) { this.api().pause(); return; }
    }
    this.guard();
  };
  Field.prototype.guard = function () {
    this.frames++;
    this.ema = this.frames === 1 ? this.lastCost : this.ema * 0.9 + this.lastCost * 0.1;
    if (this.frames < 30) return;
    if (this.ema > 12 && !this.loops) {
      this.degraded = true;
      this.el.setAttribute("data-degraded", "");
      if (this.clock === "once") { this.time = this.startPhase; this.done = true; this.render(); }
      release(this);
      this.syncButton();
    } else if (this.ema > 8 && !this.throttled) {
      this.throttled = true;
      this.el.setAttribute("data-throttled", "");
    }
  };
  Field.prototype.evaluate = function () {
    if (!this.prepared) return;
    if (!motionAllowed() || this.clock === "static" || this.degraded || this.done) { release(this); return; }
    if (this.loops) {
      if (this.ratio >= 0.1 && !this.userPaused) request(this); else release(this);
      return;
    }
    if (this.playing) { if (this.ratio < 0.1) release(this); return; }
    if (this.ratio >= (this.started ? 0.1 : 0.35)) request(this);
  };
  Field.prototype.motionChanged = function (allowed) {
    if (!allowed) {
      release(this);
      if (this.clock === "once") this.done = true;
      this.time = REST;
      this.render();
    } else {
      this.evaluate();
    }
    this.syncButton();
  };
  Field.prototype.api = function () {
    var self = this;
    return {
      play: function () { self.settling = false; self.userPaused = false; if (self.button) self.button.setAttribute("aria-pressed", "false"); self.evaluate(); },
      pause: function () { self.settling = false; self.userPaused = true; if (self.button) self.button.setAttribute("aria-pressed", "true"); release(self); },
      settle: function () {
        if (!self.playing) { self.api().pause(); return; }
        self.settling = true; self.settleLeft = 4;
      },
      seek: function (t) { self.time = +t; self.render(); },
      replay: function () { self.done = false; self.started = false; self.time = self.restingTime(); self.render(); self.evaluate(); },
      progress: function () {
        return self.clock === "once" ? Math.min(1, self.onceElapsed / ONCE_SECONDS) : self.time;
      },
      stats: function () {
        return {
          clock: self.clock, time: self.time, playing: self.playing, frames: self.frames,
          emaMs: +self.ema.toFixed(3), lastMs: +self.lastCost.toFixed(3),
          throttled: self.throttled, degraded: self.degraded,
          canvas: [self.canvas.width, self.canvas.height], transform: [self.s, self.dx, self.dy]
        };
      },
      destroy: function () {
        release(self);
        if (prepareIO) prepareIO.unobserve(self.el);
        if (visibleIO) visibleIO.unobserve(self.el);
        if (resizeRO) {
          resizeRO.unobserve(self.canvas);
          self.avoidEls.forEach(function (a) { resizeRO.unobserve(a); delete a.__cccAvoidFor; });
        }
        if (self.button) self.button.removeEventListener("click", self.onPress);
        var i = instances.indexOf(self);
        if (i >= 0) instances.splice(i, 1);
        delete self.el.__cccSignature;
      }
    };
  };
  function onMotionChange() {
    var allowed = motionAllowed();
    instances.forEach(function (inst) { inst.motionChanged(allowed); });
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onMotionChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onMotionChange);
  document.addEventListener("ccc:motion", onMotionChange);
  function init(el, opts) {
    if (!el || el.__cccSignature) return el && el.__cccSignature && el.__cccSignature.api();
    var canvas = el.querySelector(".field__canvas");
    if (!canvas || !canvas.getContext) return null;
    var group = GROUPS[el.getAttribute("data-signature")] || {};
    var merged = {};
    Object.keys(group).forEach(function (k) { merged[k] = group[k]; });
    if (opts) Object.keys(opts).forEach(function (k) { merged[k] = opts[k]; });
    if (el.hasAttribute("data-crop-x")) {
      merged.crop = Object.assign({}, merged.crop, { cx: +el.getAttribute("data-crop-x") });
    }
    var inst = new Field(el, merged);
    instances.push(inst);
    var api = inst.api();
    var target = merged.hover && el.closest(merged.hoverTarget || "li, article, figure");
    if (target) {
      // After the first hover the lines stay on the card, frozen where they stopped.
      var wake = function () { target.classList.add("is-signed"); api.play(); };
      target.addEventListener("pointerenter", wake);
      target.addEventListener("pointerleave", api.settle);
      target.addEventListener("focusin", wake);
      target.addEventListener("focusout", api.settle);
    }
    return api;
  }
  function initAll(scope) {
    var list = (scope || document).querySelectorAll(".field[data-signature]");
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(init(list[i]));
    return out;
  }
  CCC.signature = { init: init, initAll: initAll, allowed: motionAllowed };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { initAll(); });
  else initAll();
})();

/* Chapters world map: zoom buttons, ctrl or pinch wheel, two-finger pinch and drag to pan.
   Zoom rewrites the SVG viewBox; --z keeps pins and labels at screen size. A region hash opens its accordion. */
(function () {
  var fig = document.querySelector("[data-world]");
  if (!fig) return;
  var svg = fig.querySelector("svg");
  var W = +svg.getAttribute("data-w"), H = +svg.getAttribute("data-h");
  var z = 1, cx = W / 2, cy = H / 2, MAX = 8;
  // First zoom heads for the chapter cluster rather than the middle of the ocean
  var home = null, pins = svg.querySelectorAll(".ch-pin");
  if (pins.length) {
    var xs = [], ys = [];
    pins.forEach(function (p) { var t = p.transform.baseVal.consolidate(); if (t) { xs.push(t.matrix.e); ys.push(t.matrix.f); } });
    var mid = function (a) { a.sort(function (m, n) { return m - n; }); return a[a.length >> 1]; };
    if (xs.length) home = [mid(xs), mid(ys)];
  }
  function apply() {
    z = Math.min(Math.max(z, 1), MAX);
    var vw = W / z, vh = H / z;
    cx = Math.min(Math.max(cx, vw / 2), W - vw / 2);
    cy = Math.min(Math.max(cy, vh / 2), H - vh / 2);
    svg.setAttribute("viewBox", (cx - vw / 2).toFixed(1) + " " + (cy - vh / 2).toFixed(1) + " " + vw.toFixed(1) + " " + vh.toFixed(1));
    svg.style.setProperty("--z", z.toFixed(3));
    fig.classList.toggle("is-zoomed", z > 1.6);
  }
  function toUnits(clientX, clientY) {
    var r = svg.getBoundingClientRect();
    return [cx + ((clientX - r.left) / r.width - .5) * W / z, cy + ((clientY - r.top) / r.height - .5) * H / z];
  }
  function zoomAt(f, ux, uy) {
    var nz = Math.min(Math.max(z * f, 1), MAX), k = z / nz;
    cx = ux + (cx - ux) * k; cy = uy + (cy - uy) * k; z = nz; apply();
  }
  // Buttons and double-click glide to the new view; drag, wheel and pinch stay direct
  var still = window.matchMedia("(prefers-reduced-motion: reduce)"), raf = 0;
  function glide(nz, ux, uy) {
    nz = Math.min(Math.max(nz, 1), MAX);
    var k = z / nz, tx = ux + (cx - ux) * k, ty = uy + (cy - uy) * k;
    cancelAnimationFrame(raf);
    if (still.matches || document.documentElement.getAttribute("data-motion") === "off") { z = nz; cx = tx; cy = ty; apply(); return; }
    var z0 = z, x0 = cx, y0 = cy, t0 = performance.now(), MS = 560;
    (function step(now) {
      var p = Math.min((now - t0) / MS, 1), e = 1 - Math.pow(1 - p, 3);
      z = z0 * Math.pow(nz / z0, e); cx = x0 + (tx - x0) * e; cy = y0 + (ty - y0) * e; apply();
      if (p < 1) raf = requestAnimationFrame(step);
    })(t0);
  }
  fig.addEventListener("click", function (e) {
    var b = e.target.closest("[data-zoom]");
    if (!b) return;
    var m = b.getAttribute("data-zoom");
    if (m === "reset") glide(1, W / 2, H / 2);
    else if (m === "in" && z === 1 && home) { cx = home[0]; cy = home[1]; glide(1.6, cx, cy); }
    else glide(z * (m === "in" ? 1.6 : 1 / 1.6), cx, cy);
  });
  // Double-click zooms in on that spot; shift double-click zooms out
  svg.addEventListener("dblclick", function (e) {
    e.preventDefault();
    var u = toUnits(e.clientX, e.clientY);
    glide(e.shiftKey ? z / 2 : z * 2, u[0], u[1]);
  });
  // Plain wheel keeps scrolling the page; ctrl or cmd wheel (and trackpad pinch) zooms
  svg.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var u = toUnits(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * .01), u[0], u[1]);
  }, { passive: false });
  var pts = {}, last = null, moved = 0;
  svg.addEventListener("pointerdown", function (e) {
    cancelAnimationFrame(raf);
    pts[e.pointerId] = [e.clientX, e.clientY]; last = { x: e.clientX, y: e.clientY }; moved = 0;
    if (z > 1) e.preventDefault();
  });
  window.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    var ids = Object.keys(pts), r = svg.getBoundingClientRect();
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      var d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (last && last.d) { var u = toUnits(m[0], m[1]); zoomAt(d / last.d, u[0], u[1]); }
      last = { d: d };
    } else if (z > 1) {
      if (last && last.x != null) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        cx -= dx / r.width * W / z; cy -= dy / r.height * H / z; apply();
      }
      last = { x: e.clientX, y: e.clientY };
    }
  });
  function up(e) { delete pts[e.pointerId]; last = null; }
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  // A drag that panned the map should not follow the pin link under the pointer
  svg.addEventListener("click", function (e) { if (moved > 6) { e.preventDefault(); moved = 0; } }, true);
  svg.style.touchAction = "pan-y";
  apply();
  function openHash() {
    var d = location.hash && document.getElementById(location.hash.slice(1));
    if (d && d.tagName === "DETAILS") d.open = true;
  }
  window.addEventListener("hashchange", openHash);
  openHash();
})();
// Animated mark in the site header. The lockup is inlined so the Three-C mark can
// play the brand loop: every 10 s the lines draw into the brass dot while the mark
// turns counterclockwise, the dot bounces once with a glint, and the lines draw
// straight back out. It always rests on the locked lockup. Reduced motion keeps the image.
(function () {
  "use strict";
  var img = document.querySelector(".site-header .brand-link img");
  if (!img || !window.fetch || !window.DOMParser) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var NS = "http://www.w3.org/2000/svg";
  var W = 95.49, A = 250, R = 202.255, DUR = 1.8, SLOW = 1.25, EVERY = 10000, FIRST = 3000;
  var COLORS = ["#2D432B", "#2A5D5B", "#D06E53"];
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pt(deg) { var a = deg * Math.PI / 180; return (500 + R * Math.cos(a)).toFixed(2) + " " + (291.7 + R * Math.sin(a)).toFixed(2); }
  // One circle around the forest C's arc center, starting inside the dot clearance.
  // pathLength 360 makes dash units degrees; the locked C runs from 0 to 250.
  var RING = "M " + pt(95) + " A " + R + " " + R + " 0 1 1 " + pt(275) + " A " + R + " " + R + " 0 1 1 " + pt(95);
  function clamp(p) { return p < 0 ? 0 : p > 1 ? 1 : p; }
  function seg(t, start, dur) { return clamp((t - start) / dur); }
  function cin(p) { return p * p * p; }
  function cout(p) { return 1 - Math.pow(1 - p, 3); }
  function cinout(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function backOut(p) { var s = 2.6; p -= 1; return 1 + (s + 1) * p * p * p + s * p * p; }

  fetch(img.src).then(function (r) { return r.text(); }).then(function (text) {
    var svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    if (svg.nodeName !== "svg") return;
    // The first four shapes are the mark (three Cs and the dot); the rest is the wordmark.
    var shapes = svg.querySelectorAll("path");
    for (var i = 0; i < 4; i++) shapes[i].parentNode.removeChild(shapes[i]);
    svg = document.importNode(svg, true);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("width", img.getAttribute("width"));
    svg.setAttribute("height", img.getAttribute("height"));
    var defs = el("defs", {}), first = svg.firstChild;
    svg.insertBefore(defs, first);
    var mask = el("mask", { id: "hm-clr", maskUnits: "userSpaceOnUse", x: -1000, y: -1000, width: 3000, height: 3000 }, defs);
    el("rect", { x: -1000, y: -1000, width: 3000, height: 3000, fill: "#fff" }, mask);
    el("circle", { cx: 500, cy: 500, r: 88, fill: "#000" }, mask);
    var shine = el("linearGradient", { id: "hm-shine" }, defs);
    [[0, 0], [0.5, 0.85], [1, 0]].forEach(function (s) { el("stop", { offset: s[0], "stop-color": "#FFF6DF", "stop-opacity": s[1] }, shine); });
    var clipDot = el("circle", { cx: 500, cy: 500, r: 61 }, el("clipPath", { id: "hm-face" }, defs));
    var root = el("g", {});
    svg.insertBefore(root, first);
    var cs = el("g", { mask: "url(#hm-clr)" }, root);
    var arcs = COLORS.map(function (c, i) {
      return el("path", { d: RING, pathLength: 360, fill: "none", stroke: c, "stroke-width": W, transform: "rotate(" + i * 120 + " 500 500)" }, cs);
    });
    var dot = el("circle", { cx: 500, cy: 500, r: 61, fill: "#9C7C46" }, root);
    var glint = el("rect", { x: -26, y: -120, width: 52, height: 240, fill: "url(#hm-shine)" });
    svg.insertBefore(el("g", { "clip-path": "url(#hm-face)" }), first).appendChild(glint);

    // The whole loop as a function of time; t = DUR is the locked lockup.
    function render(t) {
      var rot = t < 0.74 ? -200 * cin(seg(t, 0, 0.7)) : 0;
      var d = t < 0.86 ? 1 + 0.14 * cout(seg(t, 0.7, 0.16)) : 1.14 - 0.14 * backOut(seg(t, 0.86, 0.45));
      var g = t < 0.9 || t > 1.4 ? 0 : cinout(seg(t, 0.9, 0.5));
      var r = (61 * d).toFixed(3);
      root.setAttribute("transform", "rotate(" + rot.toFixed(3) + " 500 500)");
      dot.setAttribute("r", r);
      clipDot.setAttribute("r", r);
      glint.setAttribute("transform", "translate(" + (500 + (g * 2 - 1) * r * 1.6).toFixed(2) + " 500) rotate(28)");
      glint.style.visibility = g > 0 && g < 1 ? "visible" : "hidden";
      arcs.forEach(function (p, i) {
        var len = t < 0.8 ? A * (1 - cin(seg(t, 0.03 + 0.05 * i, 0.6))) : A * cout(seg(t, 0.8, 0.5));
        len = Math.max(0, Math.min(360, len));
        p.style.visibility = len > 0.01 ? "visible" : "hidden";
        p.setAttribute("stroke-dasharray", len.toFixed(3) + " " + (360 - len).toFixed(3));
      });
    }
    render(DUR);
    img.parentNode.replaceChild(svg, img);

    var running = false;
    function play() {
      if (running || document.hidden) return;
      running = true;
      var t0 = null;
      window.requestAnimationFrame(function step(now) {
        if (t0 === null) t0 = now;
        var t = (now - t0) / (1000 * SLOW); // the header plays 25% slower than the 1.8 s master
        render(Math.min(t, DUR));
        if (t < DUR) window.requestAnimationFrame(step); else running = false;
      });
    }
    window.setTimeout(function () { play(); window.setInterval(play, EVERY); }, FIRST);
  }).catch(function () {});
})();
