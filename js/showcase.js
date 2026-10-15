/* =====================================================================
   showcase.js — project cards: auto-sliding belt + "pull out" + "present"
   =====================================================================
   WHAT IT DOES
   - The project cards slide slowly and loop forever (the set is cloned
     so there is no visible jump). They overlap a little, like a hand
     of playing cards.
   - Hover a card: it is pulled up and out of the stack (CSS), and the
     belt pauses.
   - CLICK a card (or press Enter on it): it flies out of the stack and
     is presented big in the middle of the screen while the rest of the
     page blurs. Click outside, press Esc or the X to put it back.
     (Links inside a card still work.)
   - Drag / swipe to scroll by hand (with momentum); auto-sliding
     resumes afterwards. Prev/Next buttons and Left/Right arrow keys work.
   - Cards near the centre scale up and glow.
   - Reduced motion: no auto-slide; everything else still works.
   EDIT HERE: the CONFIG object below, and the cards in work.html.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-showcase]');
  if (!root) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    maxScale: 0.06,          // extra scale for the card at the centre (0.06 = +6%)
    focusZone: 0.3,          // how wide the "centre" zone is (fraction of viewport width)
    resumeDelayMouse: 800,   // ms before auto-slide resumes after releasing a drag
    resumeDelayTouch: 1500,
    friction: 0.04,          // momentum decay after a drag (lower = stops sooner)
    presentScale: 2,         // biggest zoom when a card is presented
    presentMs: 760           // how long the fly-out takes
  };

  var presenting = false;    // true while a card is presented (belt pauses)

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
    this.base = Array.prototype.slice.call(this.track.children);
    this.slots = [];
    this.lefts = [];

    this.measure();
    this.bind();
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
        c.setAttribute('data-clone', '');
        c.setAttribute('aria-hidden', 'true');
        // the copies must not be reachable by keyboard
        Array.prototype.forEach.call(c.querySelectorAll('a, button, [tabindex]'), function (n) { n.tabIndex = -1; });
        track.appendChild(c);
      });
    }
    addSet();
    var firstClone = track.querySelector('[data-clone]');
    this.setW = firstClone.offsetLeft - first.offsetLeft;
    this.step = this.setW / this.base.length;

    var total = Math.ceil(this.vw / this.setW) + 2;
    for (var i = 2; i < total; i++) addSet();
    track.style.marginLeft = (-this.setW) + 'px';

    this.slots = Array.prototype.slice.call(track.children);
    this.lefts = this.slots.map(function (s) { return s.offsetLeft; });
    this.render();
  };

  Row.prototype.render = function () {
    var m = mod(this.pos, this.setW);
    this.track.style.transform = 'translate3d(' + (-m).toFixed(2) + 'px,0,0)';

    var centre = this.vw / 2;
    var zone = this.vw * CONFIG.focusZone;
    for (var i = 0; i < this.slots.length; i++) {
      var cx = this.lefts[i] + this.slotW / 2 - this.setW - m;
      var slot = this.slots[i];
      if (cx < -this.slotW || cx > this.vw + this.slotW) {
        if (slot._k !== 0) { slot.style.transform = ''; slot.style.zIndex = ''; slot.style.setProperty('--glow', '0'); slot._k = 0; }
        continue;
      }
      var k = Math.max(0, 1 - Math.abs(cx - centre) / zone);
      k = Math.round(k * 100) / 100;
      if (slot._k === k) continue;
      slot._k = k;
      slot.style.transform = 'scale(' + (1 + CONFIG.maxScale * k).toFixed(3) + ')';
      slot.style.zIndex = String(Math.round(k * 10));          // the card in the middle sits in front
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

    // A drag must not count as a click (neither a link click nor "present this card")
    vp.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // Click on a card (not on its link) = present it
    vp.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var card = e.target.closest('.project-card');
      if (card) presentCard(card, false);
    });

    // Keyboard
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
    vp.addEventListener('focusout', function (e) {
      self.focus = !!(e.relatedTarget && vp.contains(e.relatedTarget));
    });
  };

  /* ---------- Set up the rows ---------- */
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-row]')).map(function (v) { return new Row(v); });

  var prev = root.querySelector('[data-prev]');
  var next = root.querySelector('[data-next]');
  function nudgeAll(sign) { rows.forEach(function (r) { r.nudge(sign * r.step); }); }
  if (prev) prev.addEventListener('click', function () { nudgeAll(-1); });
  if (next) next.addEventListener('click', function () { nudgeAll(1); });

  var rt;
  function remeasure() { rows.forEach(function (r) { r.measure(); }); }
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (!presenting) remeasure(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* =====================================================================
     PRESENT A CARD: it flies out of the belt into the middle of the
     screen, the page behind it blurs
     ===================================================================== */
  var stage = null, closeBtn = null, current = null;

  function ensureStage() {
    if (stage) return;
    stage = document.createElement('div');
    stage.className = 'card-stage';
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', 'Project details');
    stage.innerHTML =
      '<button class="stage-close" type="button" aria-label="Close project">✕</button>' +
      '<p class="stage-hint">Click anywhere outside the card or press Esc to put it back</p>';
    document.body.appendChild(stage);
    closeBtn = stage.querySelector('.stage-close');

    closeBtn.addEventListener('click', function () { closeCard(true); });
    stage.addEventListener('click', function (e) {
      if (!e.target.closest('.stage-card')) closeCard(false);   // click on the blurred background
    });
  }

  function presentCard(cardEl, byKeyboard) {
    if (presenting || current) return;
    ensureStage();

    var slot = cardEl.closest('.project-slot');
    var r = cardEl.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;

    // a copy of the card, placed exactly over the original
    var wrap = document.createElement('div');
    wrap.className = 'stage-card';
    wrap.style.left = r.left + 'px'; wrap.style.top = r.top + 'px';
    wrap.style.width = r.width + 'px'; wrap.style.height = r.height + 'px';
    var copy = cardEl.cloneNode(true);
    copy.removeAttribute('tabindex');
    copy.removeAttribute('aria-haspopup');
    Array.prototype.forEach.call(copy.querySelectorAll('a'), function (a) { a.tabIndex = 0; });
    wrap.appendChild(copy);
    stage.insertBefore(wrap, closeBtn);

    var s = Math.min(CONFIG.presentScale, (vh * 0.8) / r.height, (vw * 0.9) / r.width);
    s = Math.max(1, s);
    var dx = vw / 2 - (r.left + r.width / 2);
    var dy = vh / 2 - (r.top + r.height / 2);
    var finalT = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';

    current = { slot: slot, card: cardEl, wrap: wrap, finalT: finalT, byKeyboard: byKeyboard };
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

  function closeCard(fromButton) {
    if (!current) return;
    var c = current;
    current = 'closing';
    stage.classList.remove('is-open');

    function done() {
      c.wrap.remove();
      c.slot.classList.remove('is-lifted');
      document.documentElement.classList.remove('stage-open');
      presenting = false;
      current = null;
      rows.forEach(function (row) { row.resumeAt = performance.now() + 600; });
      if (c.byKeyboard) { try { c.card.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    if (c.wrap.animate && !reduce) {
      var a = c.wrap.animate([
        { transform: c.finalT },
        { transform: 'translate(0,0) scale(1)' }
      ], { duration: 480, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' });
      a.onfinish = done;
    } else {
      done();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && current !== 'closing') closeCard(false);
    // keep Tab inside the presented card
    if (e.key === 'Tab' && current && current !== 'closing') {
      var f = Array.prototype.slice.call(stage.querySelectorAll('a, button'));
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });

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
