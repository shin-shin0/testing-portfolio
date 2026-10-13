/* =====================================================================
   showcase.js — auto-sliding, infinitely looping project carousel
   =====================================================================
   WHAT IT DOES
   - Slides the project cards continuously and seamlessly (the card
     set is cloned as many times as needed, so there is no visible jump).
   - Pauses on hover, keyboard focus and touch; drag/swipe to scroll
     manually (with a little momentum), then auto-sliding resumes.
   - Cards near the centre scale up and glow.
   - Prev/Next buttons and Left/Right arrow keys (when the carousel
     is focused). Tabbing to a card link scrolls it to the centre.
   - Row 2 is an automatic reversed copy of row 1 (delete it in the
     HTML if you don't want it). Speed per row: data-speed (px/second).
   - Reduced motion: no auto-slide, manual controls still work.
   EDIT HERE: CONFIG below, and the cards in index.html.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-showcase]');
  if (!root) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    maxScale: 0.07,          // extra scale for the card at the centre (0.07 = +7%)
    focusZone: 0.3,          // how wide the "centre" zone is (fraction of viewport width)
    resumeDelayMouse: 800,   // ms before auto-slide resumes after releasing a drag
    resumeDelayTouch: 1500,
    friction: 0.04           // momentum decay after a drag (lower = stops sooner)
  };

  function mod(n, m) { return ((n % m) + m) % m; }

  /* ---------- One carousel row ---------- */
  function Row(viewport) {
    this.viewport = viewport;
    this.track = viewport.querySelector('.showcase-track');
    this.dir = viewport.getAttribute('data-dir') === 'reverse' ? -1 : 1;   // 1 = content moves left
    this.speed = reduce ? 0 : (parseFloat(viewport.getAttribute('data-speed')) || 40);
    this.pos = 0;           // scroll position in px (wrapped to one set width)
    this.pending = 0;       // smooth nudge remaining (arrow buttons / keyboard)
    this.vel = 0;           // drag momentum (px/s)
    this.factor = 1;        // 0..1 auto-slide speed multiplier (eases in/out)
    this.hover = false;
    this.focus = false;
    this.touching = false;
    this.dragging = false;
    this.resumeAt = 0;
    this.setW = 0; this.vw = 0; this.slotW = 0; this.step = 0;
    this.base = [];
    this.slots = [];
    this.lefts = [];

    // Row 2: build a reversed copy of another row's cards
    var mirrorSel = viewport.getAttribute('data-mirror');
    var source = mirrorSel && document.querySelector(mirrorSel);
    if (source) {
      // Only the original cards (not the loop clones), in reverse order
      var items = Array.prototype.slice.call(source.querySelectorAll('.showcase-track > .project-slot:not([data-clone])')).reverse();
      items.forEach(function (li) {
        var copy = li.cloneNode(true);
        copy.removeAttribute('style');
        this.track.appendChild(copy);
      }, this);
      this.makeInert(this.track);
    }
    this.base = Array.prototype.slice.call(this.track.children);

    this.measure();
    this.bind();
  }

  // Remove duplicated content from tab order / screen readers
  Row.prototype.makeInert = function (el) {
    Array.prototype.forEach.call(el.querySelectorAll('a, button, input'), function (n) { n.tabIndex = -1; });
    if (el.nodeType === 1 && el !== this.track) el.setAttribute('aria-hidden', 'true');
  };

  Row.prototype.measure = function () {
    var track = this.track;
    // Reset: remove old clones
    Array.prototype.slice.call(track.querySelectorAll('[data-clone]')).forEach(function (n) { n.remove(); });
    track.style.marginLeft = '0px';

    this.vw = this.viewport.clientWidth;
    var first = this.base[0];
    if (!first) return;
    this.slotW = first.offsetWidth;

    // Add one clone set to learn the exact set width (cards + gaps)
    var self = this;
    function addSet() {
      self.base.forEach(function (li) {
        var c = li.cloneNode(true);
        c.setAttribute('data-clone', '');
        c.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(c.querySelectorAll('a, button'), function (n) { n.tabIndex = -1; });
        track.appendChild(c);
      });
    }
    addSet();
    var firstClone = track.querySelector('[data-clone]');
    this.setW = firstClone.offsetLeft - first.offsetLeft;
    this.step = this.setW / this.base.length;

    // Enough sets to cover the viewport on both sides of the wrap point
    var total = Math.ceil(this.vw / this.setW) + 2;
    for (var i = 2; i < total; i++) addSet();     // base set + clones = total sets
    track.style.marginLeft = (-this.setW) + 'px';

    this.slots = Array.prototype.slice.call(track.children);
    this.lefts = this.slots.map(function (s) { return s.offsetLeft; });
    this.render();
  };

  Row.prototype.render = function () {
    var m = mod(this.pos, this.setW);
    this.track.style.transform = 'translate3d(' + (-m).toFixed(2) + 'px,0,0)';

    // Centre scale + glow (screen x of card centre = left + w/2 - setW - m)
    var centre = this.vw / 2;
    var zone = this.vw * CONFIG.focusZone;
    for (var i = 0; i < this.slots.length; i++) {
      var cx = this.lefts[i] + this.slotW / 2 - this.setW - m;
      var slot = this.slots[i];
      if (cx < -this.slotW || cx > this.vw + this.slotW) {
        if (slot._k !== 0) { slot.style.transform = ''; slot.style.setProperty('--glow', '0'); slot._k = 0; }
        continue;
      }
      var k = Math.max(0, 1 - Math.abs(cx - centre) / zone);
      k = Math.round(k * 100) / 100;
      if (slot._k === k) continue;
      slot._k = k;
      slot.style.transform = 'scale(' + (1 + CONFIG.maxScale * k).toFixed(3) + ')';
      slot.style.setProperty('--glow', k.toString());
    }
  };

  Row.prototype.nudge = function (px) { this.pending += px; this.vel = 0; };

  Row.prototype.tick = function (dt, now) {
    var paused = this.hover || this.focus || this.touching || this.dragging || now < this.resumeAt;
    this.factor += ((paused ? 0 : 1) - this.factor) * Math.min(1, dt * 4);

    var move = this.dir * this.speed * this.factor * dt;

    if (this.pending) {
      var part = this.pending * Math.min(1, dt * 6);
      this.pending -= part;
      move += part;
      if (Math.abs(this.pending) < 0.5) { move += this.pending; this.pending = 0; }
    }
    if (!this.dragging) {
      if (Math.abs(this.vel) > 2) {
        move += this.vel * dt;
        this.vel *= Math.pow(CONFIG.friction, dt);
      } else {
        this.vel = 0;
      }
    }
    if (move === 0 && !this.dragging) return;
    this.pos += move;
    this.render();
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
        moved = true; self.dragging = true;
        vp.classList.add('is-dragging');
        try { vp.setPointerCapture(pid); } catch (err) { /* ignore */ }
      }
      if (moved) {
        var now = performance.now();
        var dt = Math.max(1, now - lastT) / 1000;
        var dx = e.clientX - lastX;
        self.pos -= dx;
        self.vel = self.vel * 0.6 + (-dx / dt) * 0.4;
        lastX = e.clientX; lastT = now;
        self.render();
      }
    });
    function end(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      var wasTouch = e.pointerType !== 'mouse';
      self.touching = false; self.dragging = false;
      vp.classList.remove('is-dragging');
      try { vp.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      self.resumeAt = performance.now() + (wasTouch ? CONFIG.resumeDelayTouch : CONFIG.resumeDelayMouse);
      if (moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      if (Math.abs(self.vel) > 1500) self.vel = self.vel > 0 ? 1500 : -1500;
    }
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);

    // A drag must not trigger a link click
    vp.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // Keyboard
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); self.nudge(self.step); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.nudge(-self.step); }
    });
    vp.addEventListener('focusin', function (e) {
      self.focus = true;
      // Bring a focused card's link to the centre
      var slot = e.target.closest && e.target.closest('.project-slot');
      var idx = slot ? self.slots.indexOf(slot) : -1;
      if (idx > -1) {
        var cx = self.lefts[idx] + self.slotW / 2 - self.setW - mod(self.pos, self.setW);
        self.pending = cx - self.vw / 2;
      }
    });
    vp.addEventListener('focusout', function (e) {
      self.focus = !!(e.relatedTarget && vp.contains(e.relatedTarget));
    });
  };

  /* ---------- Set up all rows ---------- */
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-row]')).map(function (v) { return new Row(v); });

  var prev = root.querySelector('[data-prev]');
  var next = root.querySelector('[data-next]');
  function nudgeAll(sign) { rows.forEach(function (r) { r.nudge(sign * r.step); }); }
  if (prev) prev.addEventListener('click', function () { nudgeAll(-1); });
  if (next) next.addEventListener('click', function () { nudgeAll(1); });

  var rt;
  function remeasure() { rows.forEach(function (r) { r.measure(); }); }
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(remeasure, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* ---------- Shared animation loop (runs only while visible) ---------- */
  var running = false, visible = true, rafId = 0, last = 0;
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    for (var i = 0; i < rows.length; i++) rows[i].tick(dt, now);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true; last = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: '100px 0px' }).observe(root);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  start();
})();