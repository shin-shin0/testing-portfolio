/* =====================================================================
   card-depth.js — the namecard and the handbook lean toward the mouse in 3D
   =====================================================================
   WHAT IT DOES
   - The floating itself is pure CSS (depthFloat in style.css).
   - This file adds the lean: move the mouse near the card or the book and
     it tilts toward you; leave and it eases back.
   - It only sets `transform` on the outer wrapper, so flipping the card,
     turning pages, tabs, buttons and links all keep working.
   - Desktop (mouse) only; off with "reduce motion".
   EDIT HERE: the TARGETS list (max = tilt in degrees) and CONFIG.
   ===================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var CONFIG = { perspective: 1600, ease: 0.1, reach: 60 };   // reach = px around the element that still tilts it
  var TARGETS = [
    { el: '.namecard',     max: 7 },
    { el: '.hb-book-wrap', max: 5 }
  ];

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  TARGETS.forEach(function (t) {
    var el = document.querySelector(t.el);
    if (!el || !el.parentElement) return;
    var area = el.parentElement;            // listen on the (still) parent so the tilt can't make the hover flicker
    var tx = 0, ty = 0, cx = 0, cy = 0, running = false, last = 0;

    function loop(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      var k = 1 - Math.pow(1 - CONFIG.ease, dt * 60);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      if (Math.abs(cx) < 0.002 && Math.abs(cy) < 0.002 && tx === 0 && ty === 0) {
        el.style.transform = ''; running = false; last = 0; return;
      }
      el.style.transform = 'perspective(' + CONFIG.perspective + 'px) rotateX(' + (-cy * t.max).toFixed(2) + 'deg) rotateY(' + (cx * t.max * 1.2).toFixed(2) + 'deg)';
      requestAnimationFrame(loop);
    }
    function run() { if (!running) { running = true; requestAnimationFrame(loop); } }

    area.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect(), R = CONFIG.reach;
      if (e.clientX < r.left - R || e.clientX > r.right + R || e.clientY < r.top - R || e.clientY > r.bottom + R) { tx = ty = 0; run(); return; }
      tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
      ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
      run();
    });
    area.addEventListener('pointerleave', function () { tx = ty = 0; run(); });
  });
})();