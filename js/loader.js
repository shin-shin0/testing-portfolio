/* =====================================================================
   loader.js — Genshin-style loading screen
   =====================================================================
   WHAT IT DOES
   - Shows a full-screen loading page (spinning emblem, your name, a
     random "Tip:" line and a glowing progress bar) until the page,
     fonts and images are ready, then fades it out.
   - Loaded WITHOUT "defer" (in <head>) so the screen is up before the
     first paint. The markup is the #loader block at the top of <body>.
   - First visit of a session shows it for ~2 s; later pages ~0.5 s.
   EDIT HERE: TIPS, MIN_FIRST and MIN_NEXT below.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('is-loading');

  var TIPS = [
    'Tip: Hover over cards to make them lean toward you.',
    'Tip: Press the sun / moon button to travel between the galaxy and Mondstadt.',
    'Tip: Drag the project belt sideways to look around.',
    'Tip: Click anywhere for a burst of sparkles (or a gust of wind).',
    'Tip: Keep an eye on the sky. A traveler is out exploring.'
  ];
  var MIN_FIRST = 2000, MIN_NEXT = 500, MAX = 7000;   // ms

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('portfolio-seen') === '1'; sessionStorage.setItem('portfolio-seen', '1'); } catch (e) {}
  var MIN = reduce ? 0 : (seen ? MIN_NEXT : MIN_FIRST);

  var loaded = false, done = false, prog = 0, t0 = performance.now();
  window.addEventListener('load', function () { loaded = true; });
  setTimeout(function () { loaded = true; }, MAX);

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('loader');
    if (!el) { root.classList.remove('is-loading'); return; }
    var bar = document.getElementById('ld-bar'), pct = document.getElementById('ld-pct'), tip = document.getElementById('ld-tip');
    tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

    function finish() {
      if (done) return; done = true;
      setTimeout(function () {
        root.classList.add('is-ready');                       // CSS fades the screen out
        setTimeout(function () {
          root.classList.remove('is-loading', 'is-ready');
          el.remove();
        }, 950);
      }, 320);
    }
    function frame(now) {
      var t = now - t0;
      var target = (loaded && t >= MIN) ? 100 : Math.min(92, 92 * (1 - Math.exp(-t / (MIN * 0.45 + 1))));
      prog += (target - prog) * 0.09;
      if (target === 100 && prog > 99.4) prog = 100;
      bar.style.setProperty('--p', (prog / 100).toFixed(4));
      pct.textContent = Math.round(prog);
      if (prog >= 100) finish(); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();