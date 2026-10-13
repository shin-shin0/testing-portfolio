/* =====================================================================
   meteors.js — DARK MODE space background (canvas)
   =====================================================================
   WHAT IT DOES
   - Draws a deep-space sky: lots of colored twinkling stars in three
     depth layers that drift slowly, a few bright flare stars, and
     diagonal meteors (top-right to bottom-left at 45 degrees).
   - (The galaxy swirl and nebula glow behind it are CSS in style.css.)
   - Runs only in dark mode, pauses when the tab is hidden, uses fewer
     meteors on small screens, and shows static stars when
     "reduce motion" is on.
   EDIT HERE: the CONFIG object below.
   ===================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('meteor-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* ---------- CONFIG (tweak freely) ---------- */
  var CONFIG = {
    meteorsDesktop: 7,        // simultaneous meteors on desktop
    meteorsMobile: 3,         // ...on screens narrower than mobileWidth
    mobileWidth: 768,
    speedMin: 520,            // px per second
    speedMax: 1050,
    lengthMin: 140,           // tail length in px
    lengthMax: 340,
    sizeMin: 1.2,             // line thickness
    sizeMax: 2.6,
    delayMin: 0.6,            // seconds between a meteor leaving and respawning
    delayMax: 6,
    starDensity: 1 / 4200,    // stars per px^2
    starMax: 380,
    drift: [1.5, 4, 8],       // px/second star drift for the far / mid / near layers
    // Meteor colors as "r,g,b": gold, teal, violet, cream
    colors: ['231,194,125', '127,224,208', '169,139,255', '243,233,210']
  };

  var ANGLE = Math.PI / 4;                 // 45 degrees
  var DIR_X = -Math.cos(ANGLE);            // travels left...
  var DIR_Y = Math.sin(ANGLE);             // ...and down

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var w = 0, h = 0, dpr = 1;
  var stars = [], meteors = [];
  var rafId = 0, last = 0, time = 0, running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }

  /* ---------- Setup ---------- */
  function starColor() {
    var roll = Math.random();
    if (roll < 0.55) return '255,255,255';   // white
    if (roll < 0.75) return '190,215,255';   // blue-white
    if (roll < 0.87) return '255,232,200';   // warm
    if (roll < 0.95) return '200,170,255';   // violet
    return '150,235,225';                    // teal
  }

  function buildStars() {
    var count = Math.min(CONFIG.starMax, Math.max(90, Math.round(w * h * CONFIG.starDensity)));
    stars = [];
    for (var i = 0; i < count; i++) {
      var layer = Math.floor(Math.random() * 3);   // 0 far, 1 mid, 2 near
      stars.push({
        x: Math.random(), y: Math.random(),         // normalized 0..1
        layer: layer,
        r: [0.6, 0.9, 1.3][layer] * rand(0.7, 1.25),
        base: rand(0.35, 0.95),
        speed: rand(0.6, 2.4),
        phase: Math.random() * Math.PI * 2,
        color: starColor(),
        flare: layer === 2 && Math.random() < 0.06   // a few bright "cross" stars
      });
    }
  }

  function makeMeteor(initial) {
    var scale = w < CONFIG.mobileWidth ? 0.65 : 1;
    return {
      x: 0, y: 0,
      speed: rand(CONFIG.speedMin, CONFIG.speedMax) * scale,
      len: rand(CONFIG.lengthMin, CONFIG.lengthMax) * scale,
      size: rand(CONFIG.sizeMin, CONFIG.sizeMax),
      color: pick(CONFIG.colors),
      wait: initial ? rand(0, CONFIG.delayMax) : rand(CONFIG.delayMin, CONFIG.delayMax),
      active: false
    };
  }
  function launch(m) {
    m.x = rand(0, w + h);   // wide range so meteors also enter from the right side
    m.y = -30;
    m.active = true;
  }
  function buildMeteors() {
    var n = w < CONFIG.mobileWidth ? CONFIG.meteorsMobile : CONFIG.meteorsDesktop;
    meteors = [];
    for (var i = 0; i < n; i++) meteors.push(makeMeteor(true));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    buildMeteors();
    if (!running && isDark()) drawFrame(0, true);
  }

  /* ---------- Drawing ---------- */
  function drawStars(t, dt, still) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!still) {
        s.x -= (CONFIG.drift[s.layer] / w) * dt;   // slow drift to the left
        if (s.x < 0) s.x += 1;
      }
      var tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      var a = s.base * tw;
      var px = s.x * w, py = s.y * h;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgb(' + s.color + ')';
      var size = s.r * 1.6;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);

      if (s.flare) {   // soft glow + little cross
        var len = 5 + 5 * tw;
        ctx.strokeStyle = 'rgb(' + s.color + ')';
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath();
        ctx.moveTo(px - len, py); ctx.lineTo(px + len, py);
        ctx.moveTo(px, py - len); ctx.lineTo(px, py + len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteor(m) {
    var tx = m.x - DIR_X * m.len;   // tail sits behind the head
    var ty = m.y - DIR_Y * m.len;

    var g = ctx.createLinearGradient(m.x, m.y, tx, ty);
    g.addColorStop(0, 'rgba(' + m.color + ',1)');
    g.addColorStop(0.25, 'rgba(' + m.color + ',0.55)');
    g.addColorStop(1, 'rgba(' + m.color + ',0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = m.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    var r = m.size * 5;
    var hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    hg.addColorStop(0, 'rgba(255,255,255,0.95)');
    hg.addColorStop(0.3, 'rgba(' + m.color + ',0.45)');
    hg.addColorStop(1, 'rgba(' + m.color + ',0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFrame(dt, still) {
    ctx.clearRect(0, 0, w, h);
    drawStars(time, dt, still);
    if (still) return;

    for (var i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      if (!m.active) {
        m.wait -= dt;
        if (m.wait <= 0) launch(m);
        continue;
      }
      m.x += DIR_X * m.speed * dt;
      m.y += DIR_Y * m.speed * dt;
      if (m.x < -m.len - 40 || m.y > h + m.len + 40) {
        meteors[i] = makeMeteor(false);
        continue;
      }
      drawMeteor(m);
    }
  }

  /* ---------- Loop control ---------- */
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    time += dt;
    drawFrame(dt, false);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMQ.matches || !isDark() || document.hidden) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  /* ---------- Events ---------- */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  // Light/dark switch: stop in light mode (the canvas is hidden), restart in dark
  window.addEventListener('themechange', function () {
    if (!isDark()) { stop(); return; }
    if (reduceMQ.matches) drawFrame(0, true); else start();
  });
  function onMotionChange() {
    if (reduceMQ.matches) { stop(); if (isDark()) drawFrame(0, true); } else start();
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMotionChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onMotionChange);

  resize();
  start();
})();