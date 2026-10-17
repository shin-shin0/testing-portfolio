/* showcase.js — Quest Log belt: auto-slide, pull-out hover, present a card, and an
   animated "tuck back into the deck" when it is closed. Reduced motion = instant. */
(function () {
  'use strict';

  var root = document.querySelector('[data-showcase]');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CONFIG = {
    maxScale: 0.06, focusZone: 0.3, resumeDelayMouse: 800, resumeDelayTouch: 1500, friction: 0.04,
    presentScale: 2, presentMs: 760, returnMs: 680, nudgeMs: 350, minSets: 3
  };

  var presenting = false, needsRemeasure = false;
  function mod(n, m) { return ((n % m) + m) % m; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function Row(viewport) {
    this.viewport = viewport;
    this.track = viewport.querySelector('.showcase-track');
    this.dir = viewport.getAttribute('data-dir') === 'reverse' ? -1 : 1;
    this.speed = reduce ? 0 : (parseFloat(viewport.getAttribute('data-speed')) || 40);
    this.pos = 0; this.pending = 0; this.vel = 0; this.factor = 1;
    this.hover = false; this.focus = false; this.touching = false; this.dragging = false; this.resumeAt = 0;
    this.setW = 0; this.vw = 0; this.slotW = 0; this.step = 0;
    this.base = Array.prototype.slice.call(this.track.children);
    this.slots = []; this.lefts = [];
    this.measure(); this.bind();
  }

  Row.prototype.measure = function () {
    var track = this.track;
    Array.prototype.slice.call(track.querySelectorAll('[data-clone]')).forEach(function (n) { n.remove(); });
    track.style.marginLeft = '0px';
    this.vw = this.viewport.clientWidth;
    var first = this.base[0];
    if (!first) return;
    this.slotW = first.offsetWidth;
    var self = this;
    function addSet() {
      self.base.forEach(function (li) {
        var c = li.cloneNode(true);
        c.setAttribute('data-clone', ''); c.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(c.querySelectorAll('a, button, [tabindex]'), function (n) { n.tabIndex = -1; });
        track.appendChild(c);
      });
    }
    addSet();
    var firstClone = track.querySelector('[data-clone]');
    this.setW = firstClone.offsetLeft - first.offsetLeft;
    this.step = this.setW / this.base.length;
    var total = Math.max(CONFIG.minSets, Math.ceil(this.vw / this.setW) + 2);
    for (var i = 2; i < total; i++) addSet();
    track.style.marginLeft = (-this.setW) + 'px';
    this.slots = Array.prototype.slice.call(track.children);
    this.lefts = this.slots.map(function (s) { return s.offsetLeft; });
    this.render();
  };

  Row.prototype.render = function () {
    var m = mod(this.pos, this.setW);
    this.track.style.transform = 'translate3d(' + (-m).toFixed(2) + 'px,0,0)';
    var centre = this.vw / 2, zone = this.vw * CONFIG.focusZone;
    for (var i = 0; i < this.slots.length; i++) {
      var cx = this.lefts[i] + this.slotW / 2 - this.setW - m, slot = this.slots[i];
      if (cx < -this.slotW || cx > this.vw + this.slotW) {
        if (slot._k !== 0) { slot.style.transform = ''; slot.style.zIndex = ''; slot.style.setProperty('--glow', '0'); slot._k = 0; }
        continue;
      }
      var k = Math.round(Math.max(0, 1 - Math.abs(cx - centre) / zone) * 100) / 100;
      if (slot._k === k) continue;
      slot._k = k;
      slot.style.transform = 'scale(' + (1 + CONFIG.maxScale * k).toFixed(3) + ')';
      slot.style.zIndex = String(Math.round(k * 10));
      slot.style.setProperty('--glow', k.toString());
    }
  };

  Row.prototype.nudge = function (px) { this.pending += px; this.vel = 0; };

  Row.prototype.tick = function (dt, now) {
    var paused = presenting || this.hover || this.focus || this.touching || this.dragging || now < this.resumeAt;
    this.factor += ((paused ? 0 : 1) - this.factor) * Math.min(1, dt * 4);
    var move = this.dir * this.speed * this.factor * dt;
    if (this.pending) {
      var part = this.pending * Math.min(1, dt * 6);
      this.pending -= part; move += part;
      if (Math.abs(this.pending) < 0.5) { move += this.pending; this.pending = 0; }
    }
    if (!this.dragging) {
      if (Math.abs(this.vel) > 2) { move += this.vel * dt; this.vel *= Math.pow(CONFIG.friction, dt); }
      else this.vel = 0;
    }
    if (move === 0 && !this.dragging) return;
    this.pos += move; this.render();
  };

  Row.prototype.bind = function () {
    var self = this, vp = this.viewport;
    var pid = null, startX = 0, lastX = 0, lastT = 0, moved = false, suppressClick = false;

    vp.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') self.hover = true; });
    vp.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') self.hover = false; });
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId; startX = lastX = e.clientX; lastT = performance.now();
      moved = false; self.touching = true; self.vel = 0; self.pending = 0;
    });
    vp.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid || !self.touching) return;
      if (!moved && Math.abs(e.clientX - startX) > 5) {
        moved = true; self.dragging = true; vp.classList.add('is-dragging');
        try { vp.setPointerCapture(pid); } catch (err) { /* ignore */ }
      }
      if (moved) {
        var now = performance.now(), dt = Math.max(1, now - lastT) / 1000, dx = e.clientX - lastX;
        self.pos -= dx; self.vel = self.vel * 0.6 + (-dx / dt) * 0.4;
        lastX = e.clientX; lastT = now; self.render();
      }
    });
    function end(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      var wasTouch = e.pointerType !== 'mouse';
      self.touching = false; self.dragging = false; vp.classList.remove('is-dragging');
      try { vp.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      self.resumeAt = performance.now() + (wasTouch ? CONFIG.resumeDelayTouch : CONFIG.resumeDelayMouse);
      if (moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      if (Math.abs(self.vel) > 1500) self.vel = self.vel > 0 ? 1500 : -1500;
    }
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('click', function (e) { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });
    vp.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var card = e.target.closest('.project-card');
      if (card) presentCard(card, false);
    });
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); self.nudge(self.step); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.nudge(-self.step); }
      else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('project-card')) {
        e.preventDefault(); presentCard(e.target, true);
      }
    });
    vp.addEventListener('focusin', function (e) {
      self.focus = true;
      var slot = e.target.closest && e.target.closest('.project-slot');
      var idx = slot ? self.slots.indexOf(slot) : -1;
      if (idx > -1 && !presenting) {
        var cx = self.lefts[idx] + self.slotW / 2 - self.setW - mod(self.pos, self.setW);
        self.pending = cx - self.vw / 2;
      }
    });
    vp.addEventListener('focusout', function (e) { self.focus = !!(e.relatedTarget && vp.contains(e.relatedTarget)); });
  };

  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-row]')).map(function (v) { return new Row(v); });
  var prev = root.querySelector('[data-prev]'), next = root.querySelector('[data-next]');
  function nudgeAll(sign) { rows.forEach(function (r) { r.nudge(sign * r.step); }); }
  if (prev) prev.addEventListener('click', function () { nudgeAll(-1); });
  if (next) next.addEventListener('click', function () { nudgeAll(1); });

  var rt;
  function remeasure() { rows.forEach(function (r) { r.measure(); }); }
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (!presenting) remeasure(); else needsRemeasure = true; }, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* ---------- present a card / put it back ---------- */
  var stage = null, closeBtn = null, current = null;

  function ensureStage() {
    if (stage) return;
    stage = document.createElement('div');
    stage.className = 'card-stage';
    stage.setAttribute('role', 'dialog'); stage.setAttribute('aria-modal', 'true'); stage.setAttribute('aria-label', 'Project details');
    stage.innerHTML = '<button class="stage-close" type="button" aria-label="Close project">✕</button>' +
      '<p class="stage-hint">Click anywhere outside the card or press Esc to put it back</p>';
    document.body.appendChild(stage);
    closeBtn = stage.querySelector('.stage-close');
    closeBtn.addEventListener('click', function () { closeCard(true); });
    stage.addEventListener('click', function (e) { if (!e.target.closest('.stage-card')) closeCard(false); });
  }

  function presentCard(cardEl, byKeyboard) {
    if (presenting || current) return;
    ensureStage();
    stage.style.transitionDuration = '';

    var slot = cardEl.closest('.project-slot');
    var r = cardEl.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var idx = 0;
    rows.forEach(function (row) { var i = row.slots.indexOf(slot); if (i > -1) idx = i % row.base.length; });

    var wrap = document.createElement('div');
    wrap.className = 'stage-card';
    wrap.style.left = r.left + 'px'; wrap.style.top = r.top + 'px';
    wrap.style.width = r.width + 'px'; wrap.style.height = r.height + 'px';
    var copy = cardEl.cloneNode(true);
    copy.removeAttribute('tabindex'); copy.removeAttribute('aria-haspopup');
    Array.prototype.forEach.call(copy.querySelectorAll('a'), function (a) { a.tabIndex = 0; });
    wrap.appendChild(copy);
    stage.insertBefore(wrap, closeBtn);

    var s = Math.max(1, Math.min(CONFIG.presentScale, (vh * 0.8) / r.height, (vw * 0.9) / r.width));
    var dx = vw / 2 - (r.left + r.width / 2), dy = vh / 2 - (r.top + r.height / 2);
    var finalT = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';

    current = { slot: slot, card: cardEl, wrap: wrap, finalT: finalT, byKeyboard: byKeyboard, idx: idx, s: s, dx: dx, dy: dy,
      box: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width } };
    presenting = true;
    slot.classList.add('is-lifted');
    document.documentElement.classList.add('stage-open');
    stage.classList.add('is-open');

    var tilt = 'rotate(' + (parseFloat(getComputedStyle(cardEl).rotate) || 0) + 'deg)';
    wrap.style.transform = finalT;
    if (wrap.animate && !reduce) {
      var a = wrap.animate([
        { transform: 'translate(0,0) scale(1) ' + tilt + ' rotateY(0deg)' },
        { transform: 'translate(' + dx.toFixed(1) + 'px,' + (dy - 30).toFixed(1) + 'px) scale(' + (s * 1.07).toFixed(3) + ') rotateY(-16deg)', offset: 0.7 },
        { transform: finalT + ' rotateY(0deg)' }
      ], { duration: CONFIG.presentMs, easing: 'cubic-bezier(.2,.9,.25,1)' });
      a.onfinish = a.oncancel = function () { wrap.style.transform = finalT; };
    }
    closeBtn.focus({ preventScroll: true });
  }

  function relocate(c) {   // the belt may have been re-measured while the card was open
    if (document.body.contains(c.slot)) return;
    var best = null, bestD = Infinity, mid = window.innerWidth / 2;
    rows.forEach(function (row) {
      row.slots.forEach(function (sl, i) {
        if (i % row.base.length !== c.idx) return;
        var b = sl.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid);
        if (d < bestD) { bestD = d; best = sl; }
      });
    });
    if (best) { c.slot = best; c.card = best.querySelector('.project-card') || c.card; best.classList.add('is-lifted'); }
  }

  function nudgeNeighbours(slot) {
    var p = slot.previousElementSibling, n = slot.nextElementSibling;
    if (p) p.classList.add('deck-nudge-l');
    if (n) n.classList.add('deck-nudge-r');
    setTimeout(function () {
      if (p) p.classList.remove('deck-nudge-l');
      if (n) n.classList.remove('deck-nudge-r');
    }, CONFIG.nudgeMs + 60);
  }

  function closeCard() {
    if (!current || current === 'closing') return;
    var c = current;
    current = 'closing';
    if (needsRemeasure) { remeasure(); needsRemeasure = false; }
    relocate(c);

    stage.style.transitionDuration = reduce ? '' : CONFIG.returnMs + 'ms';
    stage.classList.remove('is-open');
    document.documentElement.classList.remove('stage-open');

    function done() {
      c.wrap.remove();
      c.slot.classList.remove('is-lifted');
      stage.style.transitionDuration = '';
      presenting = false; current = null;
      rows.forEach(function (row) { row.resumeAt = performance.now() + 600; });
      if (!reduce) nudgeNeighbours(c.slot);
      if (c.byKeyboard) { try { c.card.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    if (!c.wrap.animate || reduce) { done(); return; }

    var r2 = c.card.getBoundingClientRect();
    var tx = (r2.left + r2.width / 2) - c.box.cx, ty = (r2.top + r2.height / 2) - c.box.cy;
    var ts = r2.width / c.box.w, tilt = parseFloat(getComputedStyle(c.card).rotate) || 0;
    function T(x, y, sc, rot) {
      return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') rotate(' + rot.toFixed(2) + 'deg)';
    }
    var a = c.wrap.animate([
      { transform: T(c.dx, c.dy, c.s, 0), offset: 0 },
      { transform: T(lerp(c.dx, tx, 0.55), lerp(c.dy, ty, 0.55) - 46, lerp(c.s, ts, 0.55) * 1.05, tilt * 0.5), offset: 0.55 },
      { transform: T(tx, ty + 7, ts * 0.975, tilt * 1.2), offset: 0.82 },
      { transform: T(tx, ty, ts, tilt), offset: 1 }
    ], { duration: CONFIG.returnMs, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    a.onfinish = done; a.oncancel = done;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && current !== 'closing') closeCard();
    if (e.key === 'Tab' && current && current !== 'closing') {
      var f = Array.prototype.slice.call(stage.querySelectorAll('a, button'));
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });

  var running = false, visible = true, rafId = 0, last = 0;
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    for (var i = 0; i < rows.length; i++) rows[i].tick(dt, now);
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (running || !visible || document.hidden) return; running = true; last = 0; rafId = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: '100px 0px' }).observe(root);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  start();
})();