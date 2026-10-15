/* =====================================================================
   scenery.js — LIGHT MODE Mondstadt hills + spinning windmills
   =====================================================================
   WHAT IT DOES
   - Builds the rolling green hills at the bottom of the light-mode
     background (three layers that sway gently and drift with scroll)
     and two windmills whose fans turn.
   - The fans spin faster while you scroll, then settle back down.
   - Reduced motion: the scene is drawn but nothing moves.
   - (The sky, clouds and winds are CSS + wind.js.)
   EDIT HERE: the CONFIG object and the colors in the drawing
   functions below.
   ===================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('bg-scenery');
  if (!host) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    baseSpin: 28,          // degrees per second when idle (big windmill)
    scrollSpin: 0.22,      // extra degrees/second per px/second of scrolling
    maxSpin: 520           // cap
  };

  var NS = 'http://www.w3.org/2000/svg';
  var fans = [];           // { el, cx, cy, angle, speed }

  /* ---------- drawing helpers (SVG strings) ---------- */
  // A stone windmill. Local origin = middle of the base; the tower is 150 high.
  function windmill(id) {
    var hy = -158;   // hub height
    var blade = '' +
      '<rect x="-2" y="' + (hy - 74) + '" width="4" height="74" fill="#c99a45"/>' +
      '<rect x="2" y="' + (hy - 72) + '" width="21" height="50" fill="#fffaf0" stroke="#d4a64a" stroke-width="1.2"/>' +
      '<path d="M2 ' + (hy - 56) + ' H23 M2 ' + (hy - 40) + ' H23 M12.5 ' + (hy - 72) + ' V' + (hy - 22) + '" stroke="#d9bd7a" stroke-width=".9" fill="none"/>';
    return '' +
      '<path d="M-27 0 L27 0 L16 -150 L-16 -150Z" fill="#f6efdc" stroke="#d9c08a" stroke-width="1.4"/>' +
      '<path d="M-22 -40 H22 M-19 -80 H19 M-17 -118 H17" stroke="#e3d3a8" stroke-width="1" fill="none"/>' +
      '<path d="M-8 0 V-22 A8 8 0 0 1 8 -22 V0Z" fill="#7a5a30"/>' +
      '<rect x="-4" y="-104" width="8" height="14" rx="4" fill="#9fd3e6" stroke="#d9c08a" stroke-width="1"/>' +
      '<path d="M-21 -150 L0 -178 L21 -150Z" fill="#3aa3b8" stroke="#2a7f93" stroke-width="1.2"/>' +
      '<g id="' + id + '">' +
        blade +
        '<g transform="rotate(90 0 ' + hy + ')">' + blade + '</g>' +
        '<g transform="rotate(180 0 ' + hy + ')">' + blade + '</g>' +
        '<g transform="rotate(270 0 ' + hy + ')">' + blade + '</g>' +
      '</g>' +
      '<circle cx="0" cy="' + hy + '" r="6.5" fill="#d4a64a" stroke="#fff6df" stroke-width="1.5"/>';
  }

  function tree(x, y, s, shade) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<rect x="-3" y="-30" width="6" height="32" fill="#8a6a3c"/>' +
      '<g class="tree-top"><circle cx="0" cy="-48" r="20" fill="' + shade + '"/><circle cx="-12" cy="-38" r="13" fill="' + shade + '"/><circle cx="12" cy="-38" r="13" fill="' + shade + '"/></g>' +
      '</g>';
  }

  function layer(cls, inner) {
    var div = document.createElement('div');
    div.className = 'hill ' + cls;
    // xMaxYMax slice: keeps the right-hand side (the big windmill) in view on narrow phone screens
    div.innerHTML = '<svg viewBox="0 0 1440 360" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">' + inner + '</svg>';
    host.appendChild(div);
    return div;
  }

  /* ---------- build the three hill layers ---------- */
  layer('hill-far',
    '<g transform="translate(330 196) scale(.55)">' + windmill('fan-far') + '</g>' +
    '<path d="M0 190 C180 130 360 210 580 170 C800 130 980 210 1200 160 C1320 135 1400 175 1440 160 L1440 360 L0 360Z" fill="#c3e8cf" fill-opacity=".92"/>');

  layer('hill-mid',
    '<g transform="translate(1185 268)">' + windmill('fan-main') + '</g>' +
    '<path d="M0 245 C240 185 420 285 700 235 C960 190 1160 285 1440 220 L1440 360 L0 360Z" fill="#9bd6ab"/>');

  layer('hill-near',
    '<path d="M0 300 C260 250 520 330 800 290 C1060 255 1260 320 1440 280 L1440 360 L0 360Z" fill="#78bf8e"/>' +
    tree(110, 322, .9, '#5fae7a') + tree(190, 330, .65, '#6cb887') +
    tree(1290, 312, .8, '#5fae7a') + tree(1372, 306, 1.0, '#58a674'));

  /* ---------- windmill fans ---------- */
  function registerFan(id, cy, speedScale) {
    var el = host.querySelector('#' + id);
    if (el) fans.push({ el: el, cy: cy, angle: Math.random() * 90, speed: speedScale });
  }
  registerFan('fan-main', -158, 1);
  registerFan('fan-far', -158, 0.7);

  function paintFans() {
    for (var i = 0; i < fans.length; i++) {
      var f = fans[i];
      f.el.setAttribute('transform', 'rotate(' + f.angle.toFixed(2) + ' 0 ' + f.cy + ')');
    }
  }
  paintFans();
  if (reduce) return;

  /* ---------- animate: idle spin + scroll boost ---------- */
  var lastY = window.scrollY, vel = 0;
  var running = false, rafId = 0, last = 0;

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    var y = window.scrollY;
    var instant = dt > 0 ? Math.abs(y - lastY) / dt : 0;
    lastY = y;
    vel += (instant - vel) * 0.1;

    var spin = Math.min(CONFIG.baseSpin + vel * CONFIG.scrollSpin, CONFIG.maxSpin);
    for (var i = 0; i < fans.length; i++) fans[i].angle = (fans[i].angle + spin * fans[i].speed * dt) % 360;
    paintFans();
    rafId = requestAnimationFrame(loop);
  }
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function start() {
    if (running || document.hidden || !isLight()) return;
    running = true; last = 0; lastY = window.scrollY;
    rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  window.addEventListener('themechange', function () { if (isLight()) start(); else stop(); });
  start();
})();
