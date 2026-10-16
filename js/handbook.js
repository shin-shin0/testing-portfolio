/* =====================================================================
   handbook.js — the Adventurer's Handbook (project index as a book)
   =====================================================================
   WHAT IT DOES
   - Builds a book from the <ol class="hb-source"> list in index.html:
       cover → Table of Contents (by category) → Project Index
       (by year) → one page per project → notes → closing page → back cover
   - Click the cover (or "Open the handbook") to open it. Turn pages with
     the arrows, the Left/Right keys, a swipe, or by clicking a line in the
     contents or index (it flips straight to that project).
   - The filter chips (Writing, Coding, Design, Research, Leadership) and
     the Order menu rebuild the book on the spot.
   - Wide screens show a two-page spread with a real page-turn; narrow
     screens (phones) show one page at a time.
   - Reduced motion: pages change instantly.
   EDIT HERE: the CONFIG object below, and the list in index.html.
   ===================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('handbook');
  var stage = section && section.querySelector('[data-handbook]');
  var book = stage && stage.querySelector('.hb-book');
  var srcList = stage && stage.querySelector('.hb-source');
  if (!book || !srcList) return;

  var leftEl = book.querySelector('.hb-left');
  var rightEl = book.querySelector('.hb-right');
  var prevBtn = stage.querySelector('[data-hb-prev]');
  var nextBtn = stage.querySelector('[data-hb-next]');
  var toggleBtn = stage.querySelector('[data-hb-toggle]');
  var statusEl = stage.querySelector('[data-hb-status]');
  var sortEl = stage.querySelector('[data-hb-sort]');
  var filterBtns = Array.prototype.slice.call(stage.querySelectorAll('[data-hb-filter]'));

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    flipMs: 900,              // page turn (two-page spread)
    singleMs: 460,            // page turn (phone, single page)
    swipePx: 50,              // swipe distance that turns a page
    singleBreakpoint: 760,    // px: below this width, show one page at a time
    maxPerCat: { research: 2 },   // most projects shown per category (research: 2 only)
    cats: {                   // category name + icon (add your own; also add a chip in index.html)
      writing:    { name: 'Writing',    icon: '✎' },
      coding:     { name: 'Coding',     icon: '⌘' },
      design:     { name: 'Design',     icon: '◈' },
      research:   { name: 'Research',   icon: '⚗' },
      leadership: { name: 'Leadership', icon: '♛' }
    },
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };
  var CAT_ORDER = Object.keys(CONFIG.cats);

  var EMBLEM = '<svg class="hb-emblem" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
    '<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="70"/>' +
    '<path d="M100 28 112 88 172 100 112 112 100 172 88 112 28 100 88 88Z"/>' +
    '<path class="s" d="M100 64 106 94 136 100 106 106 100 136 94 106 64 100 94 94Z"/>' +
    '<circle cx="100" cy="100" r="5"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- read the project list ---------- */
  var all = Array.prototype.map.call(srcList.children, function (li, i) {
    var cat = String(li.getAttribute('data-cat') || 'coding').toLowerCase().replace(/[^a-z0-9]/g, '') || 'coding';
    if (!CONFIG.cats[cat]) {
      CONFIG.cats[cat] = { name: cat.charAt(0).toUpperCase() + cat.slice(1), icon: '✦' };
      CAT_ORDER.push(cat);
    }
    var parts = String(li.getAttribute('data-date') || '').split('-');
    var y = parseInt(parts[0], 10) || 2000;
    var m = Math.min(12, Math.max(1, parseInt(parts[1], 10) || 1));
    var link = li.querySelector('a');
    var thumb = li.querySelector('.hb-src-thumb');
    function text(sel) { var n = li.querySelector(sel); return n ? n.textContent.trim() : ''; }
    return {
      id: i, cat: cat, y: y, m: m, key: y * 12 + m,
      stars: Math.min(5, Math.max(1, parseInt(li.getAttribute('data-stars'), 10) || 4)),
      tags: String(li.getAttribute('data-tags') || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      title: text('h3'), role: text('.hb-role'), sum: text('.hb-sum'),
      thumb: thumb ? thumb.innerHTML : '[PROJECT IMAGE]',
      href: link ? link.getAttribute('href') : '', linkText: link ? link.textContent.trim() : 'Open project'
    };
  });

  /* ---------- state ---------- */
  var filter = 'all', sortMode = 'new';
  var shown = [], pages = [], pageOf = {};
  var mq = window.matchMedia('(max-width: ' + CONFIG.singleBreakpoint + 'px)');
  var mode = mq.matches ? 'single' : 'spread';
  var cur = 0;               // spread index (spread mode) or page index (single mode)
  var anim = false;

  /* ---------- order + pages ---------- */
  function byDateDesc(a, b) { return b.key - a.key; }
  function sortList(list) {
    return list.slice().sort(function (a, b) {
      if (sortMode === 'cat') {
        var d = CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat);
        return d || (b.key - a.key);
      }
      return sortMode === 'old' ? a.key - b.key : b.key - a.key;
    });
  }

  function buildPages() {
    shown = sortList(all.filter(function (e) { return filter === 'all' || e.cat === filter; }));
    var pgs = [{ t: 'cover' }, { t: 'toc' }, { t: 'index' }];
    shown.forEach(function (e) { pgs.push({ t: 'entry', e: e }); });
    if (shown.length % 2 === 0) pgs.push({ t: 'notes' });   // keeps the page count even so the back cover lands on its own
    pgs.push({ t: 'end' }, { t: 'back' });
    pageOf = {};
    pgs.forEach(function (p, i) { if (p.e) pageOf[p.e.id] = i; });
    return pgs;
  }

  /* ---------- page content ---------- */
  function chip(cat) {
    var c = CONFIG.cats[cat];
    return '<span class="hb-chip hb-cat--' + esc(cat) + '">' + c.icon + ' ' + esc(c.name) + '</span>';
  }
  function dateText(e) { return CONFIG.months[e.m - 1] + ' ' + e.y; }

  function tocHTML() {
    var h = '<div class="hb-body"><h3 class="hb-h">Table of Contents</h3><p class="hb-sub">Chapters of my adventures, by category</p>';
    if (!shown.length) h += '<p class="hb-empty">No adventures in this category yet.</p>';
    CAT_ORDER.forEach(function (cat) {
      var items = shown.filter(function (e) { return e.cat === cat; }).sort(byDateDesc);
      if (!items.length) return;
      h += '<h4 class="hb-toc-cat">' + CONFIG.cats[cat].icon + ' ' + esc(CONFIG.cats[cat].name) + '</h4>';
      items.forEach(function (e) {
        h += '<button type="button" class="hb-toc-item" data-hb-goto="' + pageOf[e.id] + '"><span class="t">' + esc(e.title) +
          '</span><span class="dots" aria-hidden="true"></span><span class="p">' + pageOf[e.id] + '</span></button>';
      });
    });
    return h + '</div>';
  }

  function indexHTML() {
    var h = '<div class="hb-body"><h3 class="hb-h">Project Index</h3><p class="hb-sub">In order of adventure · ' +
      shown.length + ' of ' + all.length + ' shown</p>';
    if (!shown.length) h += '<p class="hb-empty">Nothing here yet.</p>';
    var asc = sortMode === 'old';
    var years = [];
    shown.forEach(function (e) { if (years.indexOf(e.y) < 0) years.push(e.y); });
    years.sort(function (a, b) { return asc ? a - b : b - a; });
    years.forEach(function (y) {
      h += '<h4 class="hb-year">' + y + '</h4><ul class="hb-index">';
      shown.filter(function (e) { return e.y === y; })
        .sort(function (a, b) { return asc ? a.key - b.key : b.key - a.key; })
        .forEach(function (e) {
          h += '<li><button type="button" class="hb-toc-item" data-hb-goto="' + pageOf[e.id] + '"><span class="m">' + CONFIG.months[e.m - 1] +
            '</span><span class="t">' + CONFIG.cats[e.cat].icon + ' ' + esc(e.title) + '</span><span class="dots" aria-hidden="true"></span><span class="p">' +
            pageOf[e.id] + '</span></button></li>';
        });
      h += '</ul>';
    });
    return h + '</div>';
  }

  function entryHTML(e) {
    var stars = new Array(e.stars + 1).join('★');
    var tags = e.tags.map(function (t) { return '<li>#' + esc(t) + '</li>'; }).join('');
    return '<div class="hb-body hb-entry"><div class="hb-entry-top">' + chip(e.cat) + '<span class="hb-date">' + dateText(e) + '</span></div>' +
      '<h3 class="hb-title">' + esc(e.title) + '</h3><p class="hb-role">' + esc(e.role) + '</p>' +
      '<div class="hb-thumb">' + e.thumb + '</div><p class="hb-sum">' + esc(e.sum) + '</p>' +
      (tags ? '<ul class="hb-tags" aria-label="Tags">' + tags + '</ul>' : '') +
      '<p class="hb-stars" aria-label="' + e.stars + ' out of 5 stars">' + stars + '</p>' +
      (e.href ? '<a class="btn btn--small" href="' + esc(e.href) + '" target="_blank" rel="noopener">' + esc(e.linkText) + ' <span aria-hidden="true">→</span></a>' : '') +
      '</div>';
  }

  function inner(i) {
    var p = pages[i];
    switch (p.t) {
      case 'cover':
        return '<div class="hb-cover-in" data-hb-act="open">' + EMBLEM + '<p class="hb-cover-kicker">Student Portfolio</p>' +
          '<h3 class="hb-cover-title">Adventurer\'s<br>Handbook</h3><p class="hb-cover-name">' + esc(stage.getAttribute('data-owner') || '[YOUR NAME]') +
          '</p><p class="hb-cover-hint">Click to open ✦</p></div>';
      case 'toc': return tocHTML();
      case 'index': return indexHTML();
      case 'entry': return entryHTML(p.e);
      case 'notes':
        return '<div class="hb-body"><h3 class="hb-h">Notes</h3><div class="hb-lines"></div><p class="hb-sub">[Space for your next adventure]</p></div>';
      case 'end':
        return '<div class="hb-end">' + EMBLEM + '<h3 class="hb-h">To be continued ✦</h3><p class="hb-sub">[A closing line: what you are working on next.]</p>' +
          '<button type="button" class="btn btn--small" data-hb-act="close">Close the handbook</button></div>';
      default:
        return '<div class="hb-cover-in">' + EMBLEM + '</div>';
    }
  }

  function wrap(i, side) {
    if (i == null || i < 0 || i >= pages.length) return '';
    var t = pages[i].t;
    var numbered = t !== 'cover' && t !== 'back';
    return '<div class="hb-page hb-page--' + t + ' hb-page--' + side + '">' + inner(i) +
      (numbered ? '<span class="hb-pageno">' + i + '</span>' : '') + '</div>';
  }

  /* ---------- spread maths ---------- */
  function maxIdx() { return mode === 'single' ? pages.length - 1 : pages.length / 2; }
  function pageAt(s, side) {
    var T = pages.length, p;
    if (s === 0) p = side === 'R' ? 0 : null;
    else p = side === 'L' ? 2 * s - 1 : 2 * s;
    return (p != null && p < T) ? p : null;
  }
  function spreadOfPage(p) { return p === 0 ? 0 : Math.ceil(p / 2); }

  /* ---------- drawing ---------- */
  function setPos(s) {
    book.setAttribute('data-pos', s === 0 ? 'front' : (s === maxIdx() ? 'back' : 'mid'));
  }

  function updateUI() {
    var T = pages.length, last = maxIdx();
    var txt;
    if (cur === 0) txt = 'Cover';
    else if (cur === last) txt = 'Back cover';
    else if (mode === 'single') txt = 'Page ' + cur;
    else txt = 'Pages ' + (2 * cur - 1) + '–' + (2 * cur);
    statusEl.textContent = txt;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === last;
    toggleBtn.textContent = cur === 0 ? 'Open the handbook' : 'Close the handbook';
    book.classList.toggle('is-single', mode === 'single');
    if (T < 1) return;
  }

  function renderStatic() {
    if (mode === 'single') {
      leftEl.innerHTML = '';
      rightEl.innerHTML = wrap(cur, 'right');
      book.removeAttribute('data-pos');
    } else {
      leftEl.innerHTML = wrap(pageAt(cur, 'L'), 'left');
      rightEl.innerHTML = wrap(pageAt(cur, 'R'), 'right');
      setPos(cur);
    }
    updateUI();
  }

  function clearLayers() {
    Array.prototype.forEach.call(book.querySelectorAll('.hb-flipper, .hb-ghost'), function (n) { n.remove(); });
    anim = false;
  }

  /* ---------- page turning ---------- */
  function go(to) {
    to = Math.max(0, Math.min(maxIdx(), to));
    if (anim || to === cur) return;
    if (reduce || !book.animate) { cur = to; renderStatic(); return; }
    if (mode === 'single') flipSingle(to); else flipSpread(to);
  }

  function goPage(p) {
    go(mode === 'single' ? p : spreadOfPage(p));
  }

  // Two-page spread: a "flipper" (one page with a front and a back) rotates around the spine.
  function flipSpread(to) {
    var from = cur, fwd = to > from, finished = false;
    var hadFocus = book.contains(document.activeElement);
    anim = true;

    var fl = document.createElement('div');
    fl.className = 'hb-flipper ' + (fwd ? 'is-fwd' : 'is-back');
    var f = document.createElement('div'), b = document.createElement('div');
    f.className = 'hb-fl-face hb-fl-front';
    b.className = 'hb-fl-face hb-fl-back';

    if (fwd) {   // the right page lifts and lands on the left
      f.innerHTML = wrap(pageAt(from, 'R'), 'right');
      b.innerHTML = wrap(pageAt(to, 'L'), 'left');
      leftEl.innerHTML = wrap(pageAt(from, 'L'), 'left');
      rightEl.innerHTML = wrap(pageAt(to, 'R'), 'right');
    } else {     // the left page lifts and lands on the right
      f.innerHTML = wrap(pageAt(from, 'L'), 'left');
      b.innerHTML = wrap(pageAt(to, 'R'), 'right');
      leftEl.innerHTML = wrap(pageAt(to, 'L'), 'left');
      rightEl.innerHTML = wrap(pageAt(from, 'R'), 'right');
    }
    fl.appendChild(f); fl.appendChild(b);
    book.appendChild(fl);
    setPos(to);   // the whole book slides to centre the cover / back cover while the page turns

    var a = fl.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(' + (fwd ? -180 : 180) + 'deg)' }],
      { duration: CONFIG.flipMs, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }
    );
    function done() {
      if (finished) return;
      finished = true;
      cur = to;
      renderStatic();   // identical to the flipper's final picture, so swapping is invisible
      fl.remove();
      anim = false;
      if (hadFocus) book.focus({ preventScroll: true });
    }
    a.onfinish = done; a.oncancel = done;
  }

  // Phone: the old page swings away, the new one fades in.
  function flipSingle(to) {
    var from = cur, fwd = to > from;
    anim = true;
    var ghost = document.createElement('div');
    ghost.className = 'hb-ghost';
    ghost.style.transformOrigin = fwd ? 'left center' : 'right center';
    ghost.innerHTML = wrap(from, 'right');
    book.appendChild(ghost);
    cur = to;
    renderStatic();
    var d = CONFIG.singleMs;
    var a = ghost.animate(
      [{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: 'rotateY(' + (fwd ? -75 : 75) + 'deg)', opacity: 0 }],
      { duration: d, easing: 'ease-in', fill: 'forwards' }
    );
    rightEl.animate(
      [{ opacity: 0, transform: 'translateX(' + (fwd ? '18px' : '-18px') + ')' }, { opacity: 1, transform: 'none' }],
      { duration: d, easing: 'ease-out' }
    );
    function done() { ghost.remove(); anim = false; }
    a.onfinish = done; a.oncancel = done;
  }

  /* ---------- rebuild (filter / order / layout change) ---------- */
  function rebuild() {
    clearLayers();
    pages = buildPages();
    cur = cur > 0 ? 1 : 0;     // if the book is open, show the refreshed contents + index
    renderStatic();
  }

  /* ---------- events ---------- */
  prevBtn.addEventListener('click', function () { go(cur - 1); });
  nextBtn.addEventListener('click', function () { go(cur + 1); });
  toggleBtn.addEventListener('click', function () { go(cur === 0 ? 1 : 0); });

  book.addEventListener('click', function (e) {
    if (anim) return;
    var g = e.target.closest('[data-hb-goto]');
    if (g) { goPage(parseInt(g.getAttribute('data-hb-goto'), 10)); return; }
    var act = e.target.closest('[data-hb-act]');
    if (act) {
      var v = act.getAttribute('data-hb-act');
      if (v === 'open' && cur === 0) go(1);
      else if (v === 'close') go(0);
    }
  });

  book.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(maxIdx()); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === book && cur === 0) { e.preventDefault(); go(1); }
  });

  // swipe to turn pages
  var sx = null, sy = 0;
  book.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || e.target.closest('a, button')) { sx = null; return; }
    sx = e.clientX; sy = e.clientY;
  });
  book.addEventListener('pointerup', function (e) {
    if (sx == null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > CONFIG.swipePx && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? cur + 1 : cur - 1);
  });

  filterBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-hb-filter');
      filterBtns.forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-pressed', String(on));
      });
      rebuild();
    });
  });
  if (sortEl) sortEl.addEventListener('change', function () { sortMode = sortEl.value; rebuild(); });

  // phone <-> desktop switch: keep the reader on the same page
  function onLayoutChange() {
    var p = mode === 'single' ? cur : (cur === 0 ? 0 : pageAt(cur, 'L'));
    mode = mq.matches ? 'single' : 'spread';
    clearLayers();
    cur = mode === 'single' ? p : spreadOfPage(p);
    renderStatic();
  }
  if (mq.addEventListener) mq.addEventListener('change', onLayoutChange);
  else if (mq.addListener) mq.addListener(onLayoutChange);

  /* ---------- start ---------- */
  pages = buildPages();
  renderStatic();
  section.classList.add('hb-ready');
})();
