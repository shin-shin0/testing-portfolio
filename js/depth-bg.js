/* =====================================================================
   depth-bg.js — a 3D, immersive background for BOTH themes
   =====================================================================
   WHAT IT DOES
   - Camera: the mouse (plus a slow idle sway) moves a virtual camera.
     It publishes --bx / --by (-1..1) on the background layers, and style.css
     shifts each layer by a different amount = real parallax depth.
   - DARK  : a starfield you drift through. Stars sit at different depths
             (near ones are bigger and move more) and stretch into warp
             streaks when you scroll fast.
   - LIGHT : drifting wind with soft motes, petals and big blurry clouds at
             different depths; scrolling makes the breeze rush past.
   - Theme-aware (listens to "themechange"), pauses when the tab is hidden,
     and does nothing with "reduce motion".
   EDIT HERE: the CONFIG object.
   ===================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    camX: 0.3, camY: 0.22,      // how far the camera moves with the mouse (world units)
    smooth: 0.06,               // camera easing (lower = floatier)
    sway: 0.12,                 // idle sway amount
    boostGain: 0.0009,          // scroll speed -> forward speed
    maxBoost: 1.5,
    starsDesktop: 230, starsMobile: 110,
    starSpeed: 0.035,           // dark: forward drift (depth units per second)
    motesDesktop: 90, petalsDesktop: 45, puffs: 7, lightMobileScale: 0.55,
    lightSpeed: 0.02,           // light: forward drift
    wind: 0.05,                 // light: sideways breeze
    mobileWidth: 768,
    starColors: ['255,255,255', '190,215,255', '255,232,200', '200,170,255', '150,235,225'],
    petalColors: ['255,255,255', '160,210,140', '150,205,130', '245,215,120']
  };

  var cv = document.createElement('canvas');
  cv.id = 'depth-canvas';
  cv.setAttribute('aria-hidden', 'true');
  var anchor = document.getElementById('wind-canvas');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(cv, anchor.nextSibling);
  else document.body.appendChild(cv);
  var ctx = cv.getContext('2d');

  var layers = ['bg-galaxy', 'bg-constellation', 'bg-clouds', 'bg-scenery', 'meteor-canvas', 'wind-canvas']
    .map(function (id) { return document.getElementById(id); }).filter(Boolean);

  var w = 0, h = 0, dpr = 1, P = [], builtLight = null;
  var mx = 0, my = 0, bx = 0, by = 0, vel = 0, lastY = window.scrollY;
  var running = false, raf = 0, last = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

  /* ---------- particles ---------- */
  // kind: 0 star, 1 mote, 2 petal, 3 cloud puff
  function spawn(p, initial) {
    p.z = initial ? rand(0.12, 1) : 1;
    p.x = rand(-1.8, 1.8);
    p.y = p.k === 3 ? rand(-1.3, 0.3) : rand(-1.8, 1.8);
  }
  function make(k) {
    var p = { k: k, v: rand(0.6, 1.4), a: rand(0.4, 1), r: rand(0.6, 1.4), rot: rand(0, 6.28), rs: rand(-2, 2),
              t: rand(0, 10), ph: rand(0.8, 2), c: '255,255,255', big: Math.random() < 0.06 };
    if (k === 0) p.c = pick(CONFIG.starColors);
    if (k === 2) p.c = pick(CONFIG.petalColors);
    if (k === 3) { p.r = rand(0.3, 0.6); p.a = rand(0.6, 1); }
    spawn(p, true);
    return p;
  }
  function build() {
    builtLight = isLight();
    var small = w < CONFIG.mobileWidth, i, n;
    P = [];
    if (!builtLight) {
      n = small ? CONFIG.starsMobile : CONFIG.starsDesktop;
      for (i = 0; i < n; i++) P.push(make(0));
    } else {
      var s = small ? CONFIG.lightMobileScale : 1;
      for (i = 0; i < CONFIG.puffs * s; i++) P.push(make(3));
      for (i = 0; i < CONFIG.motesDesktop * s; i++) P.push(make(1));
      for (i = 0; i < CONFIG.petalsDesktop * s; i++) P.push(make(2));
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  /* ---------- drawing ---------- */
  function drawDark(dt, boost, cx, cy) {
    var fx = w * 0.3, fy = h * 0.3, sp = CONFIG.starSpeed + boost;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.z -= sp * dt * p.v;
      var sx = w / 2 + (p.x - cx) / p.z * fx, sy = h / 2 + (p.y - cy) / p.z * fy;
      if (p.z < 0.1 || sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) { spawn(p, false); continue; }
      var a = p.a * Math.min(1, (p.z - 0.1) / 0.12) * (1.15 - p.z);
      var size = Math.min(4, p.r * 0.7 / p.z);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      if (boost > 0.04) {                                   // warp streak
        var z2 = p.z + sp * 0.07 * p.v;
        var ox = w / 2 + (p.x - cx) / z2 * fx, oy = h / 2 + (p.y - cy) / z2 * fy;
        ctx.strokeStyle = 'rgb(' + p.c + ')'; ctx.lineWidth = size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(sx, sy); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgb(' + p.c + ')';
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        if (p.big && p.z < 0.55) {                          // near flare star
          var L = 5 + size * 3;
          ctx.strokeStyle = 'rgb(' + p.c + ')'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(sx - L, sy); ctx.lineTo(sx + L, sy); ctx.moveTo(sx, sy - L); ctx.lineTo(sx, sy + L); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawLight(dt, boost, cx, cy) {
    var fx = w * 0.3, fy = h * 0.3, wind = CONFIG.wind + boost * 0.35, i, p, sx, sy, a;
    for (var pass = 0; pass < 2; pass++) {                  // clouds first, then motes + petals in front
      for (i = 0; i < P.length; i++) {
        p = P[i];
        if ((pass === 0) !== (p.k === 3)) continue;
        p.t += dt;
        p.z -= (p.k === 3 ? 0.012 : CONFIG.lightSpeed + boost * 0.25) * dt * p.v;
        p.x += wind * dt * (p.k === 3 ? 0.5 : 1) * p.v;
        if (p.x > 2) p.x = -2;
        sx = w / 2 + (p.x - cx) / p.z * fx;
        sy = h / 2 + (p.y - cy) / p.z * fy + (p.k === 3 ? 0 : Math.sin(p.t * p.ph) * 14);
        var minZ = p.k === 3 ? 0.28 : 0.1;
        if (p.z < minZ || sy < -120 || sy > h + 120) { spawn(p, false); continue; }
        a = Math.min(1, (p.z - minZ) / 0.15) * (1.2 - p.z * 0.6);
        if (p.k === 3) {
          var R = p.r / p.z * fx;
          var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
          g.addColorStop(0, 'rgba(255,255,255,' + (0.2 * a * p.a) + ')');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();
        } else if (p.k === 1) {
          var s = Math.min(7, p.r * 1.1 / p.z);
          ctx.fillStyle = 'rgba(255,255,255,' + (0.2 * a) + ')'; ctx.beginPath(); ctx.arc(sx, sy, s * 3, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * a * p.a) + ')'; ctx.beginPath(); ctx.arc(sx, sy, s, 0, 6.2832); ctx.fill();
        } else {
          var ps = Math.min(14, p.r * 1.6 / p.z);
          p.rot += p.rs * dt;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
          ctx.fillStyle = 'rgba(' + p.c + ',' + (0.9 * a * p.a) + ')';
          ctx.beginPath(); ctx.ellipse(0, 0, ps, ps * 0.45, 0, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  /* ---------- camera + loop ---------- */
  function publish() {
    var X = bx.toFixed(3), Y = by.toFixed(3);
    for (var i = 0; i < layers.length; i++) { layers[i].style.setProperty('--bx', X); layers[i].style.setProperty('--by', Y); }
  }

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    var y = window.scrollY;
    vel += (Math.abs(y - lastY) / Math.max(dt, 0.001) - vel) * 0.12;
    lastY = y;

    var tx = mx + Math.sin(now * 0.00018) * CONFIG.sway, ty = my + Math.cos(now * 0.00023) * CONFIG.sway * 0.7;
    var k = 1 - Math.pow(1 - CONFIG.smooth, dt * 60);
    bx += (tx - bx) * k; by += (ty - by) * k;
    publish();

    if (builtLight !== isLight()) build();
    var boost = Math.min(vel * CONFIG.boostGain, CONFIG.maxBoost);
    ctx.clearRect(0, 0, w, h);
    if (builtLight) drawLight(dt, boost, bx * CONFIG.camX, by * CONFIG.camY);
    else drawDark(dt, boost, bx * CONFIG.camX, by * CONFIG.camY);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || document.hidden) return;
    running = true; last = 0; lastY = window.scrollY;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = (e.clientX / w - 0.5) * 2; my = (e.clientY / h - 0.5) * 2;
  }, { passive: true });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  window.addEventListener('themechange', build);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

  resize();
  start();
})();