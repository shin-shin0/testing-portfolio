/* =====================================================================
   wind.js — LIGHT MODE Mondstadt background: winds passing by (canvas)
   =====================================================================
   WHAT IT DOES
   - Draws soft, wavy wind streaks (some with a little curl at the
     head) that sweep from left to right across the sky, plus
     drifting petals and leaves carried by the breeze.
   - (The blue sky, clouds and green hills with a windmill are CSS in
     style.css.)
   - Runs only in light mode, pauses when the tab is hidden, uses
     fewer streaks on small screens, and draws nothing when
     "reduce motion" is on.
   EDIT HERE: the CONFIG object below.
   ===================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('wind-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* ---------- CONFIG (tweak freely) ---------- */
  var CONFIG = {
    streaksDesktop: 9,        // wind streaks on screen at once
    streaksMobile: 5,
    petalsDesktop: 18,        // drifting petals / leaves
    petalsMobile: 9,
    mobileWidth: 768,
    speedMin: 260,            // px per second
    speedMax: 560,
    lengthMin: 180,           // streak length in px
    lengthMax: 420,
    widthMin: 1.2,
    widthMax: 2.8,
    delayMin: 0,              // seconds between a streak leaving and respawning
    delayMax: 3.5,
    // Colors as "r,g,b"
    streakColors: ['255,255,255', '255,255,255', '190,240,235', '255,250,225'],
    petalColors: ['255,255,255', '160,210,140', '150,205,130', '245,215,120']
  };

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var w = 0, h = 0, dpr = 1;
  var streaks = [], petals = [];
  var rafId = 0, last = 0, time = 0, running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

  /* ---------- Setup ---------- */
  function makeStreak(initial) {
    var len = rand(CONFIG.lengthMin, CONFIG.lengthMax) * (w < CONFIG.mobileWidth ? 0.7 : 1);
    return {
      x: -len - 40,
      y: rand(h * 0.05, h * 0.8),
      len: len,
      speed: rand(CONFIG.speedMin, CONFIG.speedMax),
      width: rand(CONFIG.widthMin, CONFIG.widthMax),
      amp: rand(10, 34),                 // how wavy
      freq: rand(0.006, 0.012),
      phase: rand(0, Math.PI * 2),
      wob: rand(0.8, 1.8),               // how fast the wave undulates
      alpha: rand(0.45, 0.8),
      color: pick(CONFIG.streakColors),
      curl: Math.random() < 0.4,         // little spiral at the head
      curlR: rand(8, 16),
      wait: initial ? rand(0, CONFIG.delayMax) : rand(CONFIG.delayMin, CONFIG.delayMax),
      active: false
    };
  }

  function makePetal(initial) {
    return {
      x: initial ? rand(-30, w) : -30,
      y: rand(0, h),
      vx: rand(60, 180),
      size: rand(3, 6.5),
      rot: rand(0, Math.PI * 2),
      rs: rand(-2.5, 2.5),
      t: rand(0, 10),
      wf: rand(0.8, 2),
      wa: rand(10, 34),
      color: pick(CONFIG.petalColors),
      alpha: rand(0.6, 0.95)
    };
  }

  function build() {
    var small = w < CONFIG.mobileWidth;
    streaks = []; petals = [];
    var ns = small ? CONFIG.streaksMobile : CONFIG.streaksDesktop;
    var np = small ? CONFIG.petalsMobile : CONFIG.petalsDesktop;
    for (var i = 0; i < ns; i++) streaks.push(makeStreak(true));
    for (var j = 0; j < np; j++) petals.push(makePetal(true));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    ctx.clearRect(0, 0, w, h);
  }

  /* ---------- Drawing ---------- */
  function waveY(s, px) {
    return s.y + Math.sin(px * s.freq + s.phase + time * s.wob) * s.amp;
  }

  function drawStreak(s) {
    var steps = Math.max(8, Math.round(s.len / 14));

    var g = ctx.createLinearGradient(s.x, 0, s.x - s.len, 0);
    g.addColorStop(0, 'rgba(' + s.color + ',' + s.alpha + ')');
    g.addColorStop(0.6, 'rgba(' + s.color + ',' + (s.alpha * 0.4) + ')');
    g.addColorStop(1, 'rgba(' + s.color + ',0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var px = s.x - (s.len * i) / steps;
      var py = waveY(s, px);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (s.curl) {   // spiral that starts exactly at the head
      var hy = waveY(s, s.x);
      var cx = s.x, cy = hy - s.curlR;
      ctx.strokeStyle = 'rgba(' + s.color + ',' + (s.alpha * 0.7) + ')';
      ctx.lineWidth = Math.max(1, s.width * 0.8);
      ctx.beginPath();
      for (var a = 0; a <= 5; a += 0.25) {
        var r = s.curlR * (1 - a / 6.2);
        var x = cx + Math.cos(Math.PI / 2 + a) * r;
        var y = cy + Math.sin(Math.PI / 2 + a) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawPetal(p) {
    var y = p.y + Math.sin(p.t * p.wf) * p.wa;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = 'rgb(' + p.color + ')';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(dt) {
    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      if (!s.active) {
        s.wait -= dt;
        if (s.wait <= 0) s.active = true;
        continue;
      }
      s.x += s.speed * dt;
      if (s.x > w + 60) { streaks[i] = makeStreak(false); continue; }
      drawStreak(s);
    }

    for (var j = 0; j < petals.length; j++) {
      var p = petals[j];
      p.x += p.vx * dt;
      p.t += dt;
      p.rot += p.rs * dt;
      if (p.x > w + 30) { petals[j] = makePetal(false); continue; }
      drawPetal(p);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Loop control ---------- */
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    time += dt;
    drawFrame(dt);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMQ.matches || !isLight() || document.hidden) return;
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
  window.addEventListener('themechange', function () {
    if (isLight()) start(); else { stop(); ctx.clearRect(0, 0, w, h); }
  });
  function onMotionChange() {
    if (reduceMQ.matches) { stop(); ctx.clearRect(0, 0, w, h); } else start();
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMotionChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onMotionChange);

  resize();
  start();
})();