/* =====================================================================
   puzzle.js — the contact card builds itself like a jigsaw puzzle
   =====================================================================
   WHAT IT DOES
   - When you scroll down to the contact card it starts as scattered
     jigsaw pieces, which fly in and lock together (about 2 seconds),
     and then the real, clickable card appears.
   - The "Solve the puzzle" button under the card finishes it
     immediately (it speeds the pieces up). Once solved, the same
     button becomes "Scatter the pieces" so you can watch it again.
   - The pieces are cut as real jigsaw shapes (knobs and sockets) from
     copies of the card, so the picture is always your real content.
   - Reduced motion (or a browser without the needed features): the
     card is simply shown, no puzzle.
   EDIT HERE: the CONFIG object below.
   ===================================================================== */
(function () {
  'use strict';

  var scene = document.querySelector('[data-puzzle]');
  if (!scene) return;
  var tilt = scene.querySelector('[data-tilt-card]');
  var card = scene.querySelector('.contact-card');
  var btn = document.querySelector('[data-puzzle-solve]');
  var label = btn && btn.querySelector('.pz-label');
  var controls = btn && btn.parentNode;
  if (!tilt || !card) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supported = !!(Element.prototype.animate && window.CSS && CSS.supports &&
    CSS.supports('clip-path', "path('M0 0 L10 0 L10 10Z')"));
  if (reduce || !supported) { if (controls) controls.hidden = true; return; }

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    colsWide: 4, colsNarrow: 3,     // pieces across (narrow = phone-sized card)
    rows: 3,                        // pieces down. 4 x 3 = 12 pieces: big enough to see the card quickly
    narrowWidth: 520,
    flyMs: 950,                     // how long each piece takes to fly in
    staggerMs: 70,                  // delay between pieces when auto-solving
    quickMs: 650,                   // piece flight time for the Solve button
    quickStaggerMs: 35,
    scatterMs: 800
  };

  var layer = null, pieces = [], anims = [];
  var state = 'idle';               // idle (waiting to be seen) | solving | scattered | solved
  var W = 0, H = 0, built = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ---------- jigsaw outline of one edge: a knob (sign +1 out, -1 in, 0 flat) ---------- */
  function edge(ax, ay, bx, by, s) {
    if (!s) return ' L' + r2(bx) + ' ' + r2(by);
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / L, uy = dy / L, nx = uy, ny = -ux;          // along the edge / outward normal
    function P(t, d) { return r2(ax + ux * L * t + nx * s * d * L) + ' ' + r2(ay + uy * L * t + ny * s * d * L); }
    return ' L' + P(0.40, 0) +
      ' C' + P(0.40, 0.05) + ' ' + P(0.34, 0.07) + ' ' + P(0.34, 0.14) +
      ' C' + P(0.34, 0.23) + ' ' + P(0.44, 0.26) + ' ' + P(0.50, 0.26) +
      ' C' + P(0.56, 0.26) + ' ' + P(0.66, 0.23) + ' ' + P(0.66, 0.14) +
      ' C' + P(0.66, 0.07) + ' ' + P(0.60, 0.05) + ' ' + P(0.60, 0) +
      ' L' + P(1, 0);
  }

  // returns one SVG path string per piece, row by row
  function jigsaw(w, h, cols, rows) {
    var cw = w / cols, ch = h / rows;
    var hs = [], vs = [], r, c;
    for (r = 0; r < rows; r++) {
      hs[r] = []; vs[r] = [];
      for (c = 0; c < cols; c++) { hs[r][c] = Math.random() < 0.5 ? 1 : -1; vs[r][c] = Math.random() < 0.5 ? 1 : -1; }
    }
    var paths = [];
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var x0 = c * cw, y0 = r * ch, x1 = x0 + cw, y1 = y0 + ch;
        var top = r === 0 ? 0 : -hs[r - 1][c];
        var right = c === cols - 1 ? 0 : vs[r][c];
        var bottom = r === rows - 1 ? 0 : hs[r][c];
        var left = c === 0 ? 0 : -vs[r][c - 1];
        paths.push('M' + r2(x0) + ' ' + r2(y0) +
          edge(x0, y0, x1, y0, top) + edge(x1, y0, x1, y1, right) +
          edge(x1, y1, x0, y1, bottom) + edge(x0, y1, x0, y0, left) + 'Z');
      }
    }
    return paths;
  }

  /* ---------- build the layer of pieces ---------- */
  function cleanClone(node) {
    var c = node.cloneNode(true);
    c.classList.add('puzzle-clone');
    c.removeAttribute('id');
    Array.prototype.forEach.call(c.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(c.querySelectorAll('a, button'), function (n) { n.tabIndex = -1; });
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function scatterFor() {
    var x = rand(-1, 1) * (W * 0.55 + 70), y = rand(-1, 1) * (H * 0.75 + 70);
    if (Math.abs(x) < 120 && Math.abs(y) < 90) { x += (x < 0 ? -1 : 1) * 160; y += (y < 0 ? -1 : 1) * 90; }
    return 'translate(' + r2(x) + 'px,' + r2(y) + 'px) rotate(' + r2(rand(-75, 75)) + 'deg)';
  }
  var HOME = 'translate(0px,0px) rotate(0deg)';

  function destroyLayer() {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    anims = [];
    if (layer) layer.remove();
    layer = null; pieces = [];
  }

  function build(asState) {
    destroyLayer();
    W = card.offsetWidth; H = card.offsetHeight;
    if (!W || !H) return false;

    var cols = W < CONFIG.narrowWidth ? CONFIG.colsNarrow : CONFIG.colsWide;
    var rows = CONFIG.rows;
    var paths = jigsaw(W, H, cols, rows);

    layer = document.createElement('div');
    layer.className = 'puzzle-layer';
    layer.setAttribute('aria-hidden', 'true');

    paths.forEach(function (d) {
      var wrap = document.createElement('div');
      wrap.className = 'puzzle-wrap';
      wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
      var piece = document.createElement('div');
      piece.className = 'puzzle-piece';
      var clip = "path('" + d + "')";
      piece.style.clipPath = clip; piece.style.webkitClipPath = clip;
      piece.appendChild(cleanClone(card));
      wrap.appendChild(piece);
      layer.appendChild(wrap);

      var p = { wrap: wrap, scatter: scatterFor() };
      if (asState === 'idle') { wrap.style.opacity = '0'; wrap.style.transform = p.scatter; }
      else if (asState === 'scattered') { wrap.style.opacity = '1'; wrap.style.transform = p.scatter; }
      else { wrap.style.opacity = '1'; wrap.style.transform = HOME; }
      pieces.push(p);
    });
    tilt.appendChild(layer);
    built = true;
    return true;
  }

  /* ---------- state + button ---------- */
  function setState(s) {
    state = s;
    if (!label) return;
    label.textContent = s === 'solved' ? '↻ Scatter the pieces' : '✦ Solve the puzzle';
  }

  function finishSolved() {
    setState('solved');
    scene.classList.remove('puzzle-on');            // the real card fades in
    if (layer) {
      var l = layer;
      l.classList.add('is-fading');
      setTimeout(function () { if (state === 'solved' && layer === l) destroyLayer(); }, 650);
    }
  }

  // fly every piece to its place
  function solve(quick) {
    if (state === 'solved') return;
    if (!layer && !build('scattered')) return;
    scene.classList.add('puzzle-on');
    setState('solving');
    var dur = quick ? CONFIG.quickMs : CONFIG.flyMs;
    var gap = quick ? CONFIG.quickStaggerMs : CONFIG.staggerMs;

    anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    anims = pieces.map(function (p, i) {
      var cs = getComputedStyle(p.wrap);
      var fromT = p.wrap.style.transform || p.scatter;
      var fromO = cs.opacity;
      var a = p.wrap.animate(
        [{ transform: fromT, opacity: fromO }, { transform: HOME, opacity: 1 }],
        { duration: dur, delay: i * gap, easing: 'cubic-bezier(.2,.9,.25,1.12)', fill: 'both' }
      );
      return a;
    });
    var all = anims.slice();
    Promise.all(all.map(function (a) { return a.finished; })).then(function () {
      if (anims.length !== all.length || anims[0] !== all[0]) return;   // superseded by a newer run
      pieces.forEach(function (p) { p.wrap.style.transform = HOME; p.wrap.style.opacity = '1'; });
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
      anims = [];
      finishSolved();
    }).catch(function () { /* cancelled: ignore */ });
  }

  // already solving? make the pieces hurry
  function hurry() {
    anims.forEach(function (a) { try { a.updatePlaybackRate(6); } catch (e) { a.playbackRate = 6; } });
  }

  function scatterAgain() {
    if (!build('solved')) return;
    scene.classList.add('puzzle-on');
    setState('scattered');
    var mine = [];
    pieces.forEach(function (p, i) {
      var a = p.wrap.animate(
        [{ transform: HOME }, { transform: p.scatter }],
        { duration: CONFIG.scatterMs, delay: i * 25, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' }
      );
      mine.push(a);
    });
    anims = mine;
  }

  if (btn) {
    btn.addEventListener('click', function () {
      if (state === 'solved') scatterAgain();
      else if (state === 'solving') hurry();
      else solve(true);
    });
  }

  /* ---------- start: pieces wait, scattered and invisible, until the card is scrolled into view ---------- */
  function init() {
    try {
      if (!build('idle')) return;
    } catch (err) { destroyLayer(); return; }       // anything goes wrong: just show the card
    scene.classList.add('puzzle-on');
    setState('idle');
    if (controls) controls.hidden = false;

    function go() { if (state === 'idle') solve(false); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); setTimeout(go, 250); }
      }, { threshold: 0.4 });
      io.observe(scene);
    } else {
      go();
    }
    // safety net: if the section was seen but nothing happened, never leave the card hidden
    setTimeout(function () { if (state === 'idle' && scene.getBoundingClientRect().top < window.innerHeight) go(); }, 6000);
  }

  // rebuild when the card changes size (window resize, fonts loading), unless an animation is running
  var rebuildTimer;
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () {
      if (state === 'solving' || state === 'solved') return;
      if (card.offsetWidth === W && card.offsetHeight === H) return;
      var keep = state;
      if (build(keep === 'scattered' ? 'scattered' : 'idle')) scene.classList.add('puzzle-on');
    }, 250);
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleRebuild).observe(card);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);
  else if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
