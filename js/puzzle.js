/* =====================================================================
   puzzle.js — the contact card assembles itself like a jigsaw
   =====================================================================
   WHAT IT DOES
   - Builds the contact card out of 6 jigsaw pieces (3x2, or 2x3 on
     phones). As you scroll down, the pieces fly in from all sides and
     lock together. It finishes after only ~half a screen of scrolling,
     so your contact links show up quickly.
   - A button under the card ("Solve the puzzle" / "Shuffle the pieces")
     lets visitors solve it instantly or scatter it again.
   - Tabbing into the card also solves it, so keyboard users never get
     stuck behind a scattered card. Reduced motion: no puzzle at all.
   EDIT HERE: SCROLL_SPAN (how much scrolling it takes) and the piece
   counts in build().
   ===================================================================== */
(function () {
  'use strict';
  var scene = document.querySelector('.contact-scene');
  var card = scene && scene.querySelector('.contact-card');
  var tilt = scene && scene.querySelector('.tilt3d');
  if (!card || !tilt) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SCROLL_SPAN = 0.5;   // fraction of the screen height you scroll to finish the puzzle

  var overlay = null, pieces = [], btn = null;
  var cur = 0, override = null, raf = 0, lastW = 0, lastH = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function sign() { return Math.random() < 0.5 ? 1 : -1; }

  /* One side of a piece, from (x1,y1) to (x2,y2), with a round tab (dir 1), a blank (dir -1) or flat (0) */
  function side(x1, y1, x2, y2, dir, t) {
    if (!dir) return 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' ';
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy);
    var ex = dx / L, ey = dy / L, nx = ey, ny = -ex, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    function P(u, v) { return (cx + ex * u + nx * v * t * dir).toFixed(1) + ' ' + (cy + ey * u + ny * v * t * dir).toFixed(1); }
    var nw = t * 0.28, hw = t * 0.62;
    return 'L' + P(-nw, 0) + ' C' + P(-nw, 0.45) + ' ' + P(-hw, 0.5) + ' ' + P(-hw, 0.95) +
           ' C' + P(-hw, 1.5) + ' ' + P(hw, 1.5) + ' ' + P(hw, 0.95) +
           ' C' + P(hw, 0.5) + ' ' + P(nw, 0.45) + ' ' + P(nw, 0) +
           ' L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' ';
  }

  function build() {
    var W = card.offsetWidth, H = card.offsetHeight;
    if (!W || !H) return;
    lastW = W; lastH = H;
    var cols = W < 520 ? 2 : 3, rows = W < 520 ? 3 : 2;
    var cw = W / cols, ch = H / rows, t = Math.min(cw, ch) * 0.15;

    var sh = [], sv = [], r, c;                       // random tab/blank for every shared edge
    for (r = 0; r <= rows; r++) { sh[r] = []; for (c = 0; c < cols; c++) sh[r][c] = sign(); }
    for (r = 0; r < rows; r++) { sv[r] = []; for (c = 0; c <= cols; c++) sv[r][c] = sign(); }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'pz-overlay'; overlay.setAttribute('aria-hidden', 'true');
      tilt.appendChild(overlay);
    }
    overlay.innerHTML = ''; pieces = [];

    var order = [], n = rows * cols, k;
    for (k = 0; k < n; k++) order.push(k);
    order.sort(function () { return Math.random() - 0.5; });

    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var x0 = c * cw, y0 = r * ch, x1 = x0 + cw, y1 = y0 + ch;
      var top = r > 0 ? sh[r][c] : 0, bottom = r < rows - 1 ? -sh[r + 1][c] : 0;
      var left = c > 0 ? sv[r][c] : 0, right = c < cols - 1 ? -sv[r][c + 1] : 0;
      var d = 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' +
        side(x0, y0, x1, y0, top, t) + side(x1, y0, x1, y1, right, t) +
        side(x1, y1, x0, y1, bottom, t) + side(x0, y1, x0, y0, left, t) + 'Z';

      var piece = document.createElement('div'); piece.className = 'pz-piece';
      var cut = document.createElement('div'); cut.className = 'pz-cut';
      cut.style.clipPath = cut.style.webkitClipPath = 'path("' + d + '")';
      var clone = card.cloneNode(true);
      clone.classList.add('pz-clone');
      Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
      clone.removeAttribute('id');
      Array.prototype.forEach.call(clone.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
      cut.appendChild(clone); piece.appendChild(cut); overlay.appendChild(piece);
      pieces.push({
        el: piece, d: order[r * cols + c] / Math.max(1, n - 1),
        x: sign() * rnd(260, 520), y: sign() * rnd(180, 380),
        rot: sign() * rnd(25, 110), s: rnd(0.55, 0.95)
      });
    }
    scene.classList.add('is-puzzle');
    render();
  }

  function scrollP() {
    var rect = scene.getBoundingClientRect(), vh = window.innerHeight;
    return clamp((vh * 0.95 - rect.top) / (vh * SCROLL_SPAN), 0, 1);
  }
  function render() {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var pr = clamp(cur * 1.6 - p.d * 0.6, 0, 1), inv = 1 - (1 - Math.pow(1 - pr, 3));
      inv = Math.pow(1 - pr, 3);
      p.el.style.transform = 'translate3d(' + (p.x * inv).toFixed(1) + 'px,' + (p.y * inv).toFixed(1) + 'px,0) rotate(' +
        (p.rot * inv).toFixed(1) + 'deg) scale(' + (1 - (1 - p.s) * inv).toFixed(3) + ')';
      p.el.style.opacity = Math.min(1, pr * 4).toFixed(2);
    }
    scene.classList.toggle('is-solved', cur >= 0.999);
  }
  function frame() {
    raf = 0;
    var target = override !== null ? override : scrollP();
    cur += (target - cur) * 0.12;
    if (Math.abs(target - cur) < 0.002) cur = target;
    render();
    updateBtn();
    if (cur !== target) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function isSolvedGoal() { return override !== null ? override === 1 : scrollP() >= 0.999; }
  function updateBtn() {
    if (!btn) return;
    var label = isSolvedGoal() ? 'Shuffle the pieces' : 'Solve the puzzle';
    if (btn.textContent !== label) btn.textContent = label;
  }

  /* ---------- Button ---------- */
  var bar = document.createElement('div');
  bar.className = 'puzzle-bar';
  btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn--small'; btn.id = 'puzzle-btn';
  btn.setAttribute('aria-live', 'polite');
  bar.appendChild(btn);
  scene.insertAdjacentElement('afterend', bar);
  btn.addEventListener('click', function () { override = isSolvedGoal() ? 0 : 1; kick(); });

  /* ---------- Events ---------- */
  window.addEventListener('scroll', function () {
    if (override !== null) {            // scrolling the card away hands control back to the scroll
      var r = scene.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) override = null;
    }
    kick();
  }, { passive: true });
  card.addEventListener('focusin', function () { override = 1; kick(); });

  var rt;
  function rebuildSoon() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (card.offsetWidth !== lastW || card.offsetHeight !== lastH) build();
    }, 150);
  }
  if ('ResizeObserver' in window) new ResizeObserver(rebuildSoon).observe(card);
  window.addEventListener('resize', rebuildSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuildSoon);

  build();
  cur = scrollP();
  render(); updateBtn(); kick();
})();