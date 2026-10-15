/* =====================================================================
   loader.js — Genshin-style loading screen
   =====================================================================
   WHAT IT DOES
   - Shows a full-screen loading page (spinning emblem, your name, a
     rotating "tip", a gold progress bar with a star at its tip) while
     the page loads, then fades away and lets the hero text animate in.
   - This file is loaded WITHOUT "defer" in <head> so the loading
     screen is on screen from the very first paint.
   - The markup is the <div id="loader"> at the top of each page's
     <body>; edit your name / tips there. Tips are the data-tips
     attribute, separated by "|".
   EDIT HERE: the CONFIG object below.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    minTime: reduce ? 500 : 2600,   // ms the screen stays up at least (so the animation can be enjoyed)
    maxTime: 8000,                  // ms safety limit: always leave after this, even if something is slow
    tipEvery: 1500,                 // ms between tips
    skipOnRepeat: false             // true = only show once per browser tab session (not on every page)
  };

  // JS is running: turn on JS-only styles and lock scrolling behind the loader
  root.classList.remove('no-js');
  root.classList.add('js');

  var seen = false;
  try { seen = sessionStorage.getItem('portfolio-loaded') === '1'; } catch (e) { /* ignore */ }
  if (CONFIG.skipOnRepeat && seen) return;   // no loader: page just shows

  root.classList.add('js-loading');

  document.addEventListener('DOMContentLoaded', function () {
    var loader = document.getElementById('loader');
    if (!loader) { root.classList.remove('js-loading'); return; }

    var tipEl = document.getElementById('loader-tip');
    var tipWrap = tipEl && tipEl.parentNode;
    var textEl = document.getElementById('loader-text');
    var pctEl = document.getElementById('loader-pct');
    var tips = (loader.getAttribute('data-tips') || '').split('|').filter(Boolean);

    /* ---------- rotating tips ---------- */
    var tipIndex = Math.floor(Math.random() * Math.max(1, tips.length));
    function showTip() {
      if (!tipEl || !tips.length) return;
      tipWrap.classList.add('is-swap');
      setTimeout(function () {
        tipEl.textContent = tips[tipIndex % tips.length];
        tipIndex++;
        tipWrap.classList.remove('is-swap');
      }, 250);
    }
    if (tipEl && tips.length) { tipEl.textContent = tips[tipIndex % tips.length]; tipIndex++; }
    var tipTimer = setInterval(showTip, CONFIG.tipEvery);

    /* ---------- progress ---------- */
    var startTime = performance.now();
    var pageLoaded = document.readyState === 'complete';
    window.addEventListener('load', function () { pageLoaded = true; });

    var progress = 0, finished = false;

    function setProgress(p) {
      loader.style.setProperty('--p', p.toFixed(4));
      if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tipTimer);
      setProgress(1);
      if (textEl) textEl.textContent = 'Ready';
      try { sessionStorage.setItem('portfolio-loaded', '1'); } catch (e) { /* ignore */ }
      setTimeout(function () {
        loader.classList.add('is-done');          // fade + emblem flourish
        root.classList.remove('js-loading');      // un-pause the hero + unlock scrolling
        setTimeout(function () {
          loader.classList.add('is-gone');
          window.dispatchEvent(new Event('loaderdone'));
        }, 1100);
      }, 450);
    }

    function tick(now) {
      if (finished) return;
      var t = now - startTime;
      var target = (pageLoaded && t >= CONFIG.minTime) ? 1 : Math.min(0.92, (t / CONFIG.minTime) * 0.92);
      progress += (target - progress) * 0.07;
      if (target === 1 && progress > 0.992) { finish(); return; }
      setProgress(progress);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    setTimeout(finish, CONFIG.maxTime);   // safety net
  });
})();