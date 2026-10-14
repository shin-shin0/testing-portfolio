/* =====================================================================
   scrollfx.js — letter levitation + scroll animations
   =====================================================================
   WHAT IT DOES
   - HERO NAME: splits the big name into letters so each one levitates
     in a wave (all three depth layers stay in sync).
   - SCROLL: a gold/teal progress bar at the top; the background
     (galaxy, clouds, hills, windmill) drifts at a different speed than
     the page (parallax); the hero lifts away as you scroll down.
   - REVEALS: gives each block its own entrance (slides in from the
     left / right, zooms, flips up, drops) — styled in style.css §15.
     (main.js still decides WHEN they appear.)
   - Star dividers draw themselves; section titles get a glowing underline.
   EDIT HERE: the REVEAL_MAP list below.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Letter levitation (hero name + the passing-by strips) ---------- */
  function split(el) {
    var text = el.textContent.trim(), i = 0;
    el.textContent = '';
    text.split(' ').forEach(function (word, wi, all) {
      var w = document.createElement('span'); w.className = 'w';
      for (var c = 0; c < word.length; c++) {
        var s = document.createElement('span');
        s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--i', i++); s.textContent = word[c];
        w.appendChild(s);
      }
      el.appendChild(w);
      if (wi < all.length - 1) { el.appendChild(document.createTextNode(' ')); i++; }
    });
  }
  var name = document.querySelector('.hero-name');
  if (!reduce) {
    if (name) {
      var main = name.querySelector('.layer-main');
      if (main) name.setAttribute('aria-label', main.textContent.trim());
      Array.prototype.forEach.call(name.querySelectorAll('.layer'), split);
      name.classList.add('is-split');
    }
    // must happen before marquee.js clones the strips (this file loads first)
    Array.prototype.forEach.call(document.querySelectorAll('.m-item'), split);
  }

  /* ---------- 2. Different entrance for different blocks ---------- */
  var REVEAL_MAP = [
    ['.section-head', 'drop'],
    ['.photo-scene', 'left'],
    ['.about-copy', 'right'],
    ['.stats > li', 'zoom'],
    ['.skill-scene', 'flip'],
    ['.page-cta', 'zoom']
  ];
  REVEAL_MAP.forEach(function (pair) {
    Array.prototype.forEach.call(document.querySelectorAll(pair[0]), function (el) {
      if (el.classList.contains('reveal')) el.setAttribute('data-fx', pair[1]);
    });
  });

  /* ---------- 3. Star dividers draw themselves ---------- */
  var dividers = Array.prototype.slice.call(document.querySelectorAll('.star-divider'));
  if (reduce || !('IntersectionObserver' in window)) {
    dividers.forEach(function (d) { d.classList.add('is-in'); });
  } else {
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); dio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    dividers.forEach(function (d) { dio.observe(d); });
  }

  /* ---------- 4. Scroll progress bar, parallax and hero fade ---------- */
  var barWrap = document.createElement('div');
  barWrap.id = 'scroll-progress'; barWrap.setAttribute('aria-hidden', 'true');
  barWrap.innerHTML = '<i></i>';
  document.body.appendChild(barWrap);
  var heroStage = document.querySelector('.hero-stage');
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY || 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--sy', Math.round(y));                       // used by background parallax in CSS
    barWrap.style.setProperty('--prog', Math.min(1, y / max).toFixed(4));
    if (heroStage && !reduce) {
      var p = Math.min(1, y / (window.innerHeight * 0.8));
      heroStage.style.transform = 'translate3d(0,' + (p * 70).toFixed(1) + 'px,0) scale(' + (1 - p * 0.1).toFixed(3) + ')';
      heroStage.style.opacity = (1 - p).toFixed(3);
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  /* ---------- 5. Floating particles around the skill cards ---------- */
  if (!reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.skill-scene .tilt3d'), function (box) {
      for (var i = 0; i < 10; i++) {
        var p = document.createElement('i');
        p.className = 'sp' + (i % 4 === 3 ? ' is-star' : '');
        p.setAttribute('aria-hidden', 'true');
        p.style.setProperty('--x', (4 + Math.random() * 92).toFixed(1) + '%');
        p.style.setProperty('--y', (30 + Math.random() * 70).toFixed(1) + '%');
        p.style.setProperty('--s', (5 + Math.random() * 9).toFixed(1) + 'px');
        p.style.setProperty('--z', Math.round(-30 + Math.random() * 110) + 'px');
        p.style.setProperty('--dx', Math.round(-14 + Math.random() * 28) + 'px');
        p.style.setProperty('--t', (4 + Math.random() * 4).toFixed(1) + 's');
        p.style.setProperty('--dl', (-Math.random() * 8).toFixed(1) + 's');
        box.appendChild(p);
      }
    });
  }
})();