/* =====================================================================
   hero-tilt.js — 3D hover effect on the hero text
   =====================================================================
   WHAT IT DOES
   - Desktop: the hero text block rotates in 3D toward the mouse
     (up to MAX_TILT degrees). Each element with [data-depth] sits at
     its own translateZ depth, and [data-move] shifts it in X/Y for
     parallax (positive values move OPPOSITE the cursor — used by the
     gold/teal depth duplicates behind the name).
   - On mouse leave it eases smoothly back to rest.
   - Touch devices: a gentle auto-float; if the device-orientation
     sensor is available it tilts with the phone (iOS asks permission
     on first tap), otherwise the auto-float continues.
   - Reduced motion: effect disabled entirely.
   EDIT HERE: MAX_TILT, EASE and the float values below. Per-layer
   depth/move values are set in index.html (data-depth / data-move).
   ===================================================================== */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var block = hero && hero.querySelector('[data-tilt]');
  if (!block) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- CONFIG ---------- */
  var MAX_TILT = 15;      // degrees (rotateX / rotateY limit)
  var EASE = 0.08;        // smoothing: lower = floatier
  var FLOAT_X = 0.55;     // auto-float amplitude (0..1)
  var FLOAT_Y = 0.45;
  var FLOAT_SPEED = 0.0007;

  var layers = Array.prototype.slice.call(block.querySelectorAll('[data-depth]'));
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');

  var target = { x: 0, y: 0 };   // -1..1
  var current = { x: 0, y: 0 };
  var mouseMode = fineMQ.matches;
  var orientationActive = false;
  var visible = true, running = false, rafId = 0, last = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function apply(nx, ny) {
    block.style.transform = 'rotateX(' + (-ny * MAX_TILT).toFixed(2) + 'deg) rotateY(' + (nx * MAX_TILT).toFixed(2) + 'deg)';
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      var depth = parseFloat(el.getAttribute('data-depth')) || 0;
      var move = parseFloat(el.getAttribute('data-move')) || 0;
      el.style.transform = 'translate3d(' + (-nx * move).toFixed(2) + 'px,' + (-ny * move).toFixed(2) + 'px,' + depth + 'px)';
    }
  }

  /* ---------- Mouse (desktop) ---------- */
  hero.addEventListener('mousemove', function (e) {
    if (!mouseMode) return;
    var r = hero.getBoundingClientRect();
    target.x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    target.y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
  }, { passive: true });
  hero.addEventListener('mouseleave', function () {
    if (mouseMode) { target.x = 0; target.y = 0; }   // ease back to rest
  });

  /* ---------- Device orientation (touch) ---------- */
  function onOrientation(e) {
    if (mouseMode || e.gamma == null || e.beta == null) return;
    orientationActive = true;
    target.x = clamp(e.gamma / 30, -1, 1);
    target.y = clamp((e.beta - 45) / 30, -1, 1);
  }
  function listenOrientation() {
    window.addEventListener('deviceorientation', onOrientation);
  }
  function setupOrientation() {
    if (typeof window.DeviceOrientationEvent === 'undefined') return;   // fallback: auto-float
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      // iOS: needs a user gesture. Ask on the first tap inside the hero.
      hero.addEventListener('touchend', function ask() {
        hero.removeEventListener('touchend', ask);
        window.DeviceOrientationEvent.requestPermission()
          .then(function (state) { if (state === 'granted') listenOrientation(); })
          .catch(function () { /* keep auto-float */ });
      }, { passive: true });
    } else {
      listenOrientation();
    }
  }
  if (!mouseMode) setupOrientation();

  /* ---------- Animation loop ---------- */
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    if (!mouseMode && !orientationActive) {
      // Gentle auto-float
      target.x = Math.sin(now * FLOAT_SPEED) * FLOAT_X;
      target.y = Math.cos(now * FLOAT_SPEED * 1.3) * FLOAT_Y;
    }
    var k = 1 - Math.pow(1 - EASE, dt * 60);
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    apply(current.x, current.y);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true; last = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  // Only animate while the hero is on screen and the tab is visible
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  // Switch modes if the pointer type changes (e.g. hybrid devices)
  var onPointerChange = function () {
    mouseMode = fineMQ.matches;
    target.x = 0; target.y = 0;
    if (!mouseMode) setupOrientation();
  };
  if (fineMQ.addEventListener) fineMQ.addEventListener('change', onPointerChange);

  apply(0, 0);
  start();
})();