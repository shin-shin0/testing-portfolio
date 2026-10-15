/* =====================================================================
   puzzle.js — the contact card is a real, playable jigsaw puzzle
   =====================================================================
   WHAT IT DOES
   - When you scroll to the contact card, it appears as scattered,
     rotated jigsaw pieces. They WAIT for you.
   - DRAG a piece to move it. ROTATE it with: the mouse wheel, the little
     ↻ handle that appears on a hovered piece (drag around the piece),
     the R / ] keys (and Shift+R / [ for the other way), a two-finger
     twist, or a double-tap (touch). Arrow keys move a focused piece.
   - A piece close enough to its spot (position AND angle) snaps in and
     locks. Lock them all and the real card appears with a shimmer.
   - "Solve the puzzle" flies all pieces home for you; afterwards the
     same button says "Scatter the pieces" and reshuffles.
   - Pieces are real jigsaw shapes cut from copies of the card.
   - Reduced motion (or an old browser): the card is simply shown.
   EDIT HERE: the CONFIG object below.
   ===================================================================== */
(function () {
  'use strict';

  var scene = document.querySelector('[data-puzzle]');
  if (!scene) return;
  var root = document.documentElement;
  var tilt = scene.querySelector('[data-tilt-card]');
  var card = scene.querySelector('.contact-card');
  var section = document.getElementById('contact') || scene.parentNode;
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
    rows: 3,                        // pieces down. 4 x 3 = 12 pieces
    narrowWidth: 520,
    quickMs: 650,                   // piece flight time for the Solve button
    quickStaggerMs: 35,
    scatterMs: 800,
    snapDist: 22,                   // px from home that still snaps
    snapAngle: 12,                  // degrees from upright that still snaps
    rotateStep: 15,                 // degrees per wheel notch / key press
    doubleTapRot: 45,               // degrees per double-tap (touch)
    doubleTapMs: 320,
    keyMove: 10, keyMoveBig: 40,    // px per arrow key (Shift = big)
    snapDelayMs: 350,               // wait after wheel/keys before checking for a snap
    shimmerOnAutoSolve: true,       // shimmer too when the Solve button is used (a softer one)
    shimmerMs: 1500,                // one sweep of light
    sparkleCount: 46,
    messageMs: 2600,
    hint: 'Drag to move · scroll wheel, R key or the ↻ handle to rotate · pieces snap when close'
  };

  var HOME = 'translate(0px,0px) rotate(0deg)';
  var layer = null, handle = null, handleP = null, hideT = 0, rotDrag = null;
  var pieces = [], anims = [], shape = null;
  var state = 'idle';               // idle | playing | solving | scattering | solved
  var W = 0, H = 0, zTop = 10;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function isLight() { return root.getAttribute('data-theme') === 'light'; }
  function tr(x, y, rot) { return 'translate(' + r2(x) + 'px,' + r2(y) + 'px) rotate(' + r2(rot) + 'deg)'; }
  function cancelAnim(a) { try { a.cancel(); } catch (e) { /* ignore */ } }

  /* ---------- hint + message (live region) ---------- */
  var hint = document.createElement('p');
  hint.className = 'puzzle-hint'; hint.textContent = CONFIG.hint; hint.hidden = true;
  var msg = document.createElement('p');
  msg.className = 'puzzle-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
  var host = (controls && controls.parentNode) || scene.parentNode;
  host.insertBefore(hint, controls || null);
  host.insertBefore(msg, controls || null);
  var msgT = 0;
  function showMsg(t) {
    msg.textContent = t; msg.classList.add('is-on');
    clearTimeout(msgT);
    msgT = setTimeout(function () {
      msg.classList.remove('is-on');
      setTimeout(function () { if (!msg.classList.contains('is-on')) msg.textContent = ''; }, 400);
    }, CONFIG.messageMs);
  }
  function setHint(on) { hint.hidden = !on; }
  function setLabel() { if (label) label.textContent = state === 'solved' ? '↻ Scatter the pieces' : '✦ Solve the puzzle'; }

  /* ---------- jigsaw outline ---------- */
  function edge(ax, ay, bx, by, s) {
    if (!s) return ' L' + r2(bx) + ' ' + r2(by);
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
    function P(t, d) { return r2(ax + ux * L * t + nx * s * d * L) + ' ' + r2(ay + uy * L * t + ny * s * d * L); }
    return ' L' + P(0.40, 0) +
      ' C' + P(0.40, 0.05) + ' ' + P(0.34, 0.07) + ' ' + P(0.34, 0.14) +
      ' C' + P(0.34, 0.23) + ' ' + P(0.44, 0.26) + ' ' + P(0.50, 0.26) +
      ' C' + P(0.56, 0.26) + ' ' + P(0.66, 0.23) + ' ' + P(0.66, 0.14) +
      ' C' + P(0.66, 0.07) + ' ' + P(0.60, 0.05) + ' ' + P(0.60, 0) +
      ' L' + P(1, 0);
  }
  function makeShape(cols, rows) {   // the knob/socket pattern is kept so resizing never changes the shapes
    var hs = [], vs = [], r, c;
    for (r = 0; r < rows; r++) {
      hs[r] = []; vs[r] = [];
      for (c = 0; c < cols; c++) { hs[r][c] = Math.random() < 0.5 ? 1 : -1; vs[r][c] = Math.random() < 0.5 ? 1 : -1; }
    }
    return { cols: cols, rows: rows, hs: hs, vs: vs };
  }
  function jigsaw(w, h, s) {
    var cols = s.cols, rows = s.rows, cw = w / cols, ch = h / rows, paths = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x0 = c * cw, y0 = r * ch, x1 = x0 + cw, y1 = y0 + ch;
        var top = r === 0 ? 0 : -s.hs[r - 1][c];
        var right = c === cols - 1 ? 0 : s.vs[r][c];
        var bottom = r === rows - 1 ? 0 : s.hs[r][c];
        var left = c === 0 ? 0 : -s.vs[r][c - 1];
        paths.push('M' + r2(x0) + ' ' + r2(y0) +
          edge(x0, y0, x1, y0, top) + edge(x1, y0, x1, y1, right) +
          edge(x1, y1, x0, y1, bottom) + edge(x0, y1, x0, y0, left) + 'Z');
      }
    }
    return paths;
  }

  function cleanClone(node) {
    var c = node.cloneNode(true);
    c.classList.add('puzzle-clone');
    c.removeAttribute('id');
    Array.prototype.forEach.call(c.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(c.querySelectorAll('a, button'), function (n) { n.tabIndex = -1; });
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  /* ---------- geometry: where can pieces go? ---------- */
  function origin() {   // top-left of the card on screen + its scale (the layer sits exactly over the card)
    var r = card.getBoundingClientRect();
    return { l: r.left, t: r.top, k: W ? r.width / W : 1 };
  }
  function bounds() {   // allowed area in card-local px: the contact section, limited to what is on screen
    var o = origin(), s = section.getBoundingClientRect();
    var l = Math.max(s.left, 0), r = Math.min(s.right, window.innerWidth);
    var t = Math.max(s.top, 0), b = Math.min(s.bottom, window.innerHeight);
    if (b - t < H * 1.3) { t = s.top; b = s.bottom; }
    return { l: (l - o.l) / o.k, r: (r - o.l) / o.k, t: (t - o.t) / o.k, b: (b - o.t) / o.k };
  }
  function range(lo, hi) { return lo > hi ? (lo + hi) / 2 : rand(lo, hi); }
  function clampPiece(p, b) {
    var h = Math.max(p.cw, p.ch) * 0.62;
    var minX = b.l + h - p.cx, maxX = b.r - h - p.cx, minY = b.t + h - p.cy, maxY = b.b - h - p.cy;
    p.x = minX > maxX ? (minX + maxX) / 2 : Math.min(maxX, Math.max(minX, p.x));
    p.y = minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, p.y));
  }
  function randomRot() {
    var r;
    do { r = (Math.floor(Math.random() * 24) - 12) * 15; } while (Math.abs(r) < 30);
    return r;
  }
  // every piece gets a spread-out spot (best of 40 random tries: far from the others and from home)
  function scatterAll() {
    var b = bounds(), placed = [];
    pieces.forEach(function (p) {
      var h = Math.max(p.cw, p.ch) * 0.62, best = null, bestScore = -1;
      for (var n = 0; n < 40; n++) {
        var x = range(b.l + h - p.cx, b.r - h - p.cx), y = range(b.t + h - p.cy, b.b - h - p.cy);
        var cx = p.cx + x, cy = p.cy + y, score = Math.hypot(x, y);
        for (var i = 0; i < placed.length; i++) score = Math.min(score, Math.hypot(cx - placed[i].x, cy - placed[i].y));
        if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
      }
      p.x = best.x; p.y = best.y; p.rot = randomRot();
      placed.push({ x: p.cx + p.x, y: p.cy + p.y });
    });
  }

  function apply(p) {
    p.wrap.style.transform = tr(p.x, p.y, p.rot);
    if (handleP === p) placeHandle(p);
  }
  function bringTop(p) { p.wrap.style.zIndex = String(++zTop); }
  function markLocked(p) {
    p.locked = true;
    p.wrap.classList.remove('is-held', 'is-focus');
    p.wrap.classList.add('is-locked');
    p.wrap.style.zIndex = '1';   // locked pieces sit below the loose ones
    p.piece.style.pointerEvents = 'none';
    p.piece.tabIndex = -1;
    p.piece.setAttribute('aria-disabled', 'true');
  }

  /* ---------- build the layer of pieces ---------- */
  function destroyLayer() {
    anims.forEach(cancelAnim); anims = [];
    pieces.forEach(function (p) { clearTimeout(p.snapT); });
    hideHandle();
    if (layer) layer.remove();
    layer = null; pieces = [];
    root.classList.remove('puzzle-dragging');
  }

  function snapshot() {
    return {
      W: W, H: H,
      s: pieces.map(function (p) { return { x: p.x, y: p.y, rot: p.rot, locked: p.locked, touched: p.touched }; })
    };
  }

  // mode: 'idle' (hidden, waiting) | 'visible' (scattered) | 'home' (assembled)  — keep: saved progress
  function build(mode, keep) {
    destroyLayer();
    W = card.offsetWidth; H = card.offsetHeight;
    if (!W || !H) return false;

    var cols = W < CONFIG.narrowWidth ? CONFIG.colsNarrow : CONFIG.colsWide, rows = CONFIG.rows;
    if (!shape || shape.cols !== cols) shape = makeShape(cols, rows);
    var paths = jigsaw(W, H, shape), cw = W / cols, ch = H / rows;

    layer = document.createElement('div');
    layer.className = 'puzzle-layer';   // (not aria-hidden: the pieces are focusable)

    paths.forEach(function (d, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var org = (col * cw + cw / 2) + 'px ' + (row * ch + ch / 2) + 'px';   // pivot = this piece's OWN centre

      var wrap = document.createElement('div');
      wrap.className = 'puzzle-wrap';
      wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
      wrap.style.transformOrigin = org;
      wrap.style.pointerEvents = 'none';          // only the (clipped) piece catches the pointer
      wrap.style.zIndex = String(10 + i);

      var piece = document.createElement('div');
      piece.className = 'puzzle-piece';
      var clip = "path('" + d + "')";
      piece.style.clipPath = clip; piece.style.webkitClipPath = clip;   // clip-path also shapes the hit area
      piece.style.transformOrigin = org;
      piece.style.pointerEvents = 'auto';
      piece.style.touchAction = 'none';           // ONLY the pieces block page scrolling
      piece.tabIndex = 0;
      piece.setAttribute('role', 'button');
      piece.setAttribute('aria-label', 'Puzzle piece ' + (i + 1) + ' of ' + paths.length);
      piece.appendChild(cleanClone(card));
      wrap.appendChild(piece);
      layer.appendChild(wrap);

      var p = { wrap: wrap, piece: piece, i: i, cx: col * cw + cw / 2, cy: row * ch + ch / 2, cw: cw, ch: ch,
                x: 0, y: 0, rot: 0, locked: false, touched: false, ptrs: {}, drag: null, twist: null, lastTap: 0, snapT: 0, focused: false };
      piece._p = p;
      bindPiece(p);
      pieces.push(p);
    });
    tilt.appendChild(layer);
    layer.appendChild(ensureHandle());

    if (keep && keep.s.length === pieces.length) {
      var sx = W / keep.W, sy = H / keep.H;
      pieces.forEach(function (p, i) {
        var k = keep.s[i];
        p.x = k.x * sx; p.y = k.y * sy; p.rot = k.rot; p.touched = k.touched;
        if (k.locked) { p.x = 0; p.y = 0; p.rot = 0; markLocked(p); }
      });
      var b = bounds();
      pieces.forEach(function (p) { if (!p.locked) clampPiece(p, b); });
    } else if (mode !== 'home') {
      scatterAll();
    }
    pieces.forEach(apply);
    if (mode === 'idle') pieces.forEach(function (p) { p.wrap.style.opacity = '0'; });
    return true;
  }

  /* ---------- rotate handle ---------- */
  function cellScreen(p) { var o = origin(); return { x: o.l + (p.cx + p.x) * o.k, y: o.t + (p.cy + p.y) * o.k }; }
  function placeHandle(p) {
    handle.style.left = (p.cx + p.x) + 'px';
    handle.style.top = (p.cy + p.y - p.ch * 0.55 - 18) + 'px';
  }
  function showHandle(p) {
    if (!p || p.locked || state !== 'playing') return;
    clearTimeout(hideT);
    handleP = p; placeHandle(p); handle.classList.add('is-on');
  }
  function hideHandle() {
    clearTimeout(hideT);
    if (handle) handle.classList.remove('is-on');
    handleP = null; rotDrag = null;
  }
  function hideHandleSoon() {
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      if (rotDrag || (handleP && (handleP.drag || handleP.focused))) return;
      hideHandle();
    }, 450);
  }
  function ensureHandle() {
    if (handle) return handle;
    handle = document.createElement('div');
    handle.className = 'puzzle-handle';
    handle.textContent = '↻';
    handle.setAttribute('aria-hidden', 'true');
    handle.style.position = 'absolute'; handle.style.pointerEvents = 'auto'; handle.style.zIndex = '99999'; handle.style.touchAction = 'none';
    handle.addEventListener('pointerenter', function () { clearTimeout(hideT); });
    handle.addEventListener('pointerleave', hideHandleSoon);
    handle.addEventListener('pointerdown', function (e) {
      if (!handleP || handleP.locked || state !== 'playing') return;
      e.preventDefault(); e.stopPropagation();
      var c = cellScreen(handleP);
      rotDrag = { id: e.pointerId, p: handleP, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), rot0: handleP.rot };
      try { handle.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      bringTop(handleP);
      root.classList.add('puzzle-dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (!rotDrag || e.pointerId !== rotDrag.id) return;
      var c = cellScreen(rotDrag.p);
      var a = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      rotDrag.p.rot = rotDrag.rot0 + (a - rotDrag.a0) * 180 / Math.PI;
      rotDrag.p.touched = true;
      apply(rotDrag.p);
    });
    function up(e) {
      if (!rotDrag || e.pointerId !== rotDrag.id) return;
      var p = rotDrag.p; rotDrag = null;
      try { handle.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      root.classList.remove('puzzle-dragging');
      trySnap(p);
    }
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    return handle;
  }

  /* ---------- piece interaction ---------- */
  function ptrCount(p) { return Object.keys(p.ptrs).length; }
  function twistAngle(p) {
    var ids = Object.keys(p.ptrs), a = p.ptrs[ids[0]], b = p.ptrs[ids[1]];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  function endDrag(p) {
    p.drag = null;
    p.wrap.classList.remove('is-held');
    if (!pieces.some(function (q) { return q.drag; })) root.classList.remove('puzzle-dragging');
  }

  function bindPiece(p) {
    var el = p.piece;

    el.addEventListener('pointerdown', function (e) {
      if (p.locked || state !== 'playing') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      p.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      bringTop(p); showHandle(p);
      var n = ptrCount(p);
      if (n === 1) {
        p.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
        p.wrap.classList.add('is-held');
        root.classList.add('puzzle-dragging');
      } else if (n === 2) {                       // two fingers: twist to rotate
        p.drag = null;
        p.twist = { a0: twistAngle(p), rot0: p.rot };
      }
    });

    el.addEventListener('pointermove', function (e) {
      var q = p.ptrs[e.pointerId];
      if (!q) return;
      var dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (p.twist && ptrCount(p) >= 2) {
        p.rot = p.twist.rot0 + (twistAngle(p) - p.twist.a0) * 180 / Math.PI;
        p.touched = true; apply(p); return;
      }
      if (p.drag && p.drag.id === e.pointerId) {
        if (!p.drag.moved && Math.hypot(e.clientX - p.drag.sx, e.clientY - p.drag.sy) > 4) p.drag.moved = true;
        if (!p.drag.moved) return;
        var k = origin().k;
        p.x += dx / k; p.y += dy / k;
        clampPiece(p, bounds());
        p.touched = true; apply(p);
      }
    });

    function up(e) {
      if (!p.ptrs[e.pointerId]) return;
      delete p.ptrs[e.pointerId];
      try { el.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      var n = ptrCount(p);
      if (p.twist) {
        if (n < 2) {
          p.twist = null;
          if (n === 1) {
            var id = Object.keys(p.ptrs)[0];
            p.drag = { id: +id, sx: p.ptrs[id].x, sy: p.ptrs[id].y, moved: true };
          } else endDrag(p);
        }
        if (n === 0) trySnap(p);
        return;
      }
      if (p.drag && p.drag.id === e.pointerId) {
        var moved = p.drag.moved;
        endDrag(p);
        if (!moved && e.pointerType === 'touch') {   // double-tap = rotate 45°
          var now = Date.now();
          if (now - p.lastTap < CONFIG.doubleTapMs) { p.rot += CONFIG.doubleTapRot; p.touched = true; apply(p); p.lastTap = 0; }
          else p.lastTap = now;
        }
        trySnap(p);
      }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') showHandle(p); });
    el.addEventListener('pointerleave', hideHandleSoon);

    el.addEventListener('wheel', function (e) {   // only prevents page scroll while over a loose piece
      if (p.locked || state !== 'playing') return;
      e.preventDefault();
      p.rot += (e.deltaY < 0 ? -1 : 1) * CONFIG.rotateStep;
      p.touched = true; apply(p); queueSnap(p);
    }, { passive: false });

    el.addEventListener('focus', function () { p.focused = true; p.wrap.classList.add('is-focus'); showHandle(p); });
    el.addEventListener('blur', function () { p.focused = false; p.wrap.classList.remove('is-focus'); hideHandleSoon(); });

    el.addEventListener('keydown', function (e) {
      if (p.locked || state !== 'playing') return;
      var step = e.shiftKey ? CONFIG.keyMoveBig : CONFIG.keyMove, ok = true;
      switch (e.key) {
        case 'ArrowLeft': p.x -= step; break;
        case 'ArrowRight': p.x += step; break;
        case 'ArrowUp': p.y -= step; break;
        case 'ArrowDown': p.y += step; break;
        case 'r': case ']': case '}': p.rot += CONFIG.rotateStep; break;
        case 'R': case '[': case '{': p.rot -= CONFIG.rotateStep; break;
        default: ok = false;
      }
      if (!ok) return;
      e.preventDefault();
      bringTop(p); clampPiece(p, bounds());
      p.touched = true; apply(p); queueSnap(p);
    });
  }

  /* ---------- snapping + winning ---------- */
  function queueSnap(p) {
    clearTimeout(p.snapT);
    p.snapT = setTimeout(function () { trySnap(p); }, CONFIG.snapDelayMs);
  }
  function trySnap(p) {
    if (p.locked || state !== 'playing') return;
    var m = ((p.rot % 360) + 360) % 360, ad = Math.min(m, 360 - m);
    if (Math.hypot(p.x, p.y) <= CONFIG.snapDist && ad <= CONFIG.snapAngle) lockPiece(p);
  }
  function lockPiece(p) {
    var m = ((p.rot % 360) + 360) % 360, rn = m > 180 ? m - 360 : m;
    var from = tr(p.x, p.y, rn);
    p.x = 0; p.y = 0; p.rot = 0;
    markLocked(p);
    apply(p);
    p.wrap.animate([{ transform: from }, { transform: HOME }], { duration: 180, easing: 'ease-out' });
    p.piece.animate(   // little "click" pulse + soft glow
      [{ filter: 'brightness(1.7) drop-shadow(0 0 10px rgba(255,226,140,.9))' }, { filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,226,140,0))' }],
      { duration: 520, delay: 100 });
    if (handleP === p) hideHandle();
    if (pieces.every(function (q) { return q.locked; })) setTimeout(function () { if (state === 'playing') finishSolved('manual'); }, 240);
  }

  /* ---------- states ---------- */
  function go() {   // visitor reached the card: reveal the scattered pieces (they do NOT assemble by themselves)
    if (state !== 'idle') return;
    state = 'playing';
    scatterAll();
    pieces.forEach(function (p, i) {
      apply(p);
      p.wrap.style.opacity = '1';
      p.wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: i * 50, fill: 'backwards' });
    });
    setHint(true); setLabel();
  }

  function solve() {   // auto-solve: every piece flies home
    if (state === 'solved' || state === 'solving' || state === 'scattering') return;
    if (!layer && !build('visible')) return;
    hideHandle(); setHint(false);
    scene.classList.add('puzzle-on');
    state = 'solving'; setLabel();
    anims.forEach(cancelAnim);
    anims = pieces.map(function (p, i) {
      p.drag = null; p.ptrs = {}; p.twist = null; p.wrap.classList.remove('is-held');
      var cs = getComputedStyle(p.wrap);
      var rot1 = Math.round(p.rot / 360) * 360;   // shortest way back to upright
      return p.wrap.animate(
        [{ transform: tr(p.x, p.y, p.rot), opacity: cs.opacity }, { transform: tr(0, 0, rot1), opacity: 1 }],
        { duration: CONFIG.quickMs, delay: i * CONFIG.quickStaggerMs, easing: 'cubic-bezier(.2,.9,.25,1.12)', fill: 'both' });
    });
    var all = anims.slice();
    Promise.all(all.map(function (a) { return a.finished; })).then(function () {
      if (state !== 'solving' || anims[0] !== all[0]) return;
      pieces.forEach(function (p) { p.x = 0; p.y = 0; p.rot = 0; markLocked(p); apply(p); p.wrap.style.opacity = '1'; });
      anims.forEach(cancelAnim); anims = [];
      finishSolved('auto');
    }).catch(function () { /* cancelled */ });
  }
  function hurry() {
    anims.forEach(function (a) { try { a.updatePlaybackRate(6); } catch (e) { a.playbackRate = 6; } });
  }

  function finishSolved(how) {
    state = 'solved'; setLabel(); setHint(false); hideHandle();
    root.classList.remove('puzzle-dragging');
    scene.classList.remove('puzzle-on');            // real card fades in, tilt works again
    if (layer) {
      var l = layer;
      l.classList.add('is-fading');
      setTimeout(function () { if (state === 'solved' && layer === l) destroyLayer(); }, 650);
    }
    if (how === 'manual' || CONFIG.shimmerOnAutoSolve) { shimmer(how === 'auto'); sparkBurst(how === 'auto'); }
    showMsg(how === 'manual' ? 'Puzzle solved ✦' : 'Pieces placed ✦');
  }

  function scatterAgain() {   // reshuffle (positions AND rotations) so the visitor can play again
    if (!build('home')) return;
    scene.classList.add('puzzle-on');
    state = 'scattering'; setLabel();
    msg.classList.remove('is-on');
    scatterAll();
    var targets = pieces.map(function (p) { return { x: p.x, y: p.y, rot: p.rot }; });
    pieces.forEach(function (p) { p.x = 0; p.y = 0; p.rot = 0; apply(p); });
    anims = pieces.map(function (p, i) {
      var t = targets[i];
      return p.wrap.animate([{ transform: HOME }, { transform: tr(t.x, t.y, t.rot) }],
        { duration: CONFIG.scatterMs, delay: i * 25, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
    });
    var all = anims.slice();
    Promise.all(all.map(function (a) { return a.finished; })).then(function () {
      if (state !== 'scattering' || anims[0] !== all[0]) return;
      pieces.forEach(function (p, i) { p.x = targets[i].x; p.y = targets[i].y; p.rot = targets[i].rot; apply(p); });
      anims.forEach(cancelAnim); anims = [];
      state = 'playing'; setHint(true); setLabel();
    }).catch(function () { /* cancelled */ });
  }

  if (btn) {
    btn.addEventListener('click', function () {
      if (state === 'solved') scatterAgain();
      else if (state === 'solving') hurry();
      else if (state === 'idle' || state === 'playing') solve();
    });
  }

  /* ---------- win effects: shimmer + sparkles ---------- */
  function shimmer(soft) {
    var sw = document.createElement('span');
    sw.className = 'shimmer-sweep' + (soft ? ' is-soft' : '');
    sw.setAttribute('aria-hidden', 'true');
    sw.style.setProperty('--shimmer-ms', CONFIG.shimmerMs + 'ms');
    card.appendChild(sw);
    card.classList.add('is-shimmer');
    setTimeout(function () { sw.remove(); card.classList.remove('is-shimmer'); }, CONFIG.shimmerMs * 2 + 200);
  }

  function sparkBurst(soft) {
    var pad = 70, w = card.offsetWidth + pad * 2, h = card.offsetHeight + pad * 2;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.className = 'puzzle-sparks'; cv.setAttribute('aria-hidden', 'true');
    cv.style.left = -pad + 'px'; cv.style.top = -pad + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    tilt.appendChild(cv);
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = isLight() ? ['255,255,255', '255,226,140', '150,205,130'] : ['255,226,140', '127,224,208', '255,255,255'];
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var n = Math.round(CONFIG.sparkleCount * (soft ? 0.6 : 1)), ps = [];
    for (var i = 0; i < n; i++) {
      var side = Math.floor(Math.random() * 4), t = Math.random(), x, y, ox = 0, oy = 0;
      if (side === 0) { x = t * cw; y = 0; oy = -1; } else if (side === 1) { x = cw; y = t * ch; ox = 1; }
      else if (side === 2) { x = t * cw; y = ch; oy = 1; } else { x = 0; y = t * ch; ox = -1; }
      var sp = rand(25, 90);
      ps.push({ x: x + pad, y: y + pad, vx: ox * sp + rand(-20, 20), vy: oy * sp + rand(-20, 20), life: 0, max: rand(0.8, 1.4),
                size: rand(1.5, 3.4), color: cols[Math.floor(Math.random() * cols.length)] });
    }
    var last = 0;
    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = isLight() ? 'source-over' : 'lighter';
      var alive = 0;
      for (var j = 0; j < ps.length; j++) {
        var p = ps[j]; p.life += dt;
        if (p.life >= p.max) continue;
        alive++;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
        var a = 1 - p.life / p.max, s = p.size;
        ctx.globalAlpha = a; ctx.fillStyle = 'rgb(' + p.color + ')';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 2); ctx.lineTo(p.x + s * 0.5, p.y - s * 0.5); ctx.lineTo(p.x + s * 2, p.y);
        ctx.lineTo(p.x + s * 0.5, p.y + s * 0.5); ctx.lineTo(p.x, p.y + s * 2); ctx.lineTo(p.x - s * 0.5, p.y + s * 0.5);
        ctx.lineTo(p.x - s * 2, p.y); ctx.lineTo(p.x - s * 0.5, p.y - s * 0.5); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (alive) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- start + resize ---------- */
  function init() {
    try { if (!build('idle')) return; } catch (err) { destroyLayer(); return; }   // anything goes wrong: just show the card
    scene.classList.add('puzzle-on');
    state = 'idle'; setLabel();
    if (controls) controls.hidden = false;

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); setTimeout(go, 250); }
      }, { threshold: 0.4 });
      io.observe(scene);
    } else { go(); }
    // safety net: if the section was seen but nothing happened, never leave the card hidden
    setTimeout(function () { if (state === 'idle' && scene.getBoundingClientRect().top < window.innerHeight) go(); }, 6000);
  }

  // Rebuild when the card changes size — but never wipe the visitor's progress.
  var rebuildTimer;
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () {
      if (state === 'solving' || state === 'solved' || state === 'scattering') return;
      if (card.offsetWidth === W && card.offsetHeight === H) return;
      if (state === 'idle') { if (build('idle')) scene.classList.add('puzzle-on'); return; }
      var progressed = pieces.some(function (p) { return p.touched || p.locked; });
      var keep = progressed ? snapshot() : null;
      if (build('visible', keep)) scene.classList.add('puzzle-on');
    }, 250);
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleRebuild).observe(card);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);
  else if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();