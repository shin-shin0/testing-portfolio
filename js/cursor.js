/* =====================================================================
   cursor.js — custom cursor (+ idle animations)
   =====================================================================
   DARK MODE  : a gold four-pointed star + a slow trailing ring;
                moving leaves a fading sparkle trail, clicking bursts.
   LIGHT MODE : a spinning windmill fan (it turns faster the faster
                you move the mouse) + a soft wind ring; the trail is
                curling WIND streaks and clicking blows out leaves
                and a ripple of wind.
   - Hovering links/buttons/cards: the cursor grows (and speeds up).
   - Only runs on devices with a real mouse (hover + fine pointer);
     on touch devices the normal cursor is left alone.
   - Reduced motion: no easing, no trail, no particles, no idle effects.

   IDLE (new)  ACTIVE -> MERGING -> IDLE -> RETURNING -> ACTIVE
   - Leave the mouse still for idleDelay ms:
       DARK : the star + ring dissolve into a glowing point which becomes
              a big COMET sweeping across the sky (behind the page content,
              next to the meteor canvas); another one every few seconds.
       LIGHT: the windmill spins up into a whirl of wind which condenses
              into a floating, blinking ANEMO-SLIME-style creature (an
              original drawing) that bobs and drifts near the cursor.
   - Any mouse move / click / scroll pops it away and the normal cursor
     re-forms right at the mouse.
   - Hovering links, an open quest card, the loader and puzzle dragging
     all count as activity.
   EDIT HERE: the CONFIG object and HOVER_SELECTOR below.
   ===================================================================== */
(function () {
  'use strict';

  // Skip entirely on touch / coarse-pointer devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    starEase: 0.35,        // 0..1 — higher = snappier cursor
    ringEase: 0.12,        // lower = more lag for the trailing ring
    trailEvery: 14,        // px of movement between trail particles
    burstCount: 16,        // particles per click
    fanIdleSpeed: 110,     // fan degrees/second when the mouse is still
    fanMouseGain: 9,       // extra fan speed per px of cursor lag
    fanMaxSpeed: 1500,
    colors: ['231,194,125', '127,224,208', '169,139,255', '243,233,210'],    // dark-mode sparkles
    leafColors: ['255,255,255', '150,205,130', '245,215,120', '120,200,170'],  // light-mode leaves

    /* --- idle: timings --- */
    idleDelay: 3500,       // ms without activity before the cursor starts merging
    mergeMs: 750,          // how long the cursor takes to dissolve / condense
    returnMs: 380,         // how long the normal cursor takes to re-form

    /* --- idle (dark): comet --- */
    cometSize: 9,          // head size / tail thickness (px). meteors.js lines are ~1-3px, so this is BIG
    cometTail: 1.5,        // seconds of trail kept = tail length (speed x this)
    cometSpeedMin: 380,    // px per second
    cometSpeedMax: 560,
    cometAccel: 0.9,       // seconds the first comet takes to pick up speed
    cometTurn: 0.28,       // max curve (radians per second) of the gentle arc
    cometGapMin: 4,        // seconds of waiting between comets
    cometGapMax: 9,
    cometAlpha: 0.85,      // overall translucency
    cometColors: ['255,236,190', '127,224,208', '169,139,255'],   // gold, teal, violet (as in meteors.js)

    /* --- idle (light): anemo slime --- */
    slimeSize: 84,         // px
    slimeBob: 7,           // px up/down
    slimeBobSpeed: 2.2,    // bob speed (radians/second)
    slimeDriftRadius: 26,  // px radius of its lazy loop around where the cursor stopped
    slimeDriftSpeed: 0.45, // speed of that loop
    blinkMin: 2, blinkMax: 5,       // seconds between blinks
    puffMin: 3, puffMax: 6.5        // seconds between little wind puffs
  };
  var HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, select, summary, .panel, .project-card, .skill-card, [data-cursor-hover]';

  function isLight() { return root.getAttribute('data-theme') === 'light'; }

  var STAR_PATH = 'M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z';

  // A 4-sailed windmill: each sail = a spar + a lattice panel
  function sail(deg) {
    return '<g transform="rotate(' + deg + ' 16 16)">' +
      '<line class="spar" x1="16" y1="16" x2="16" y2="2.5"/>' +
      '<path class="sail" d="M16 3.5 H24 V13 H16Z"/>' +
      '<path class="lat" d="M16 6.7 H24 M16 9.9 H24 M20 3.5 V13"/>' +
      '</g>';
  }
  var FAN_SVG = '<svg class="ic ic-fan" viewBox="0 0 32 32" focusable="false">' +
    sail(0) + sail(90) + sail(180) + sail(270) + '<circle class="hub" cx="16" cy="16" r="2.6"/></svg>';
  var STAR_SVG = '<svg class="ic ic-star" viewBox="0 0 24 24" focusable="false"><path d="' + STAR_PATH + '"/></svg>';
  var RING_SVG = '<svg class="ic" viewBox="0 0 24 24" focusable="false"><path class="p-star" d="' + STAR_PATH + '"/><circle class="p-circle" cx="12" cy="12" r="10.5"/></svg>';

  // An ORIGINAL cute floating wind-slime: translucent cyan blob, belly + gloss highlights,
  // a swirling vortex core, a friendly face and tiny wind curls around it.
  var SLIME_SVG = '<svg viewBox="0 0 120 120" focusable="false">' +
    '<defs>' +
      '<radialGradient id="slBody" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#f0fdff"/><stop offset=".5" stop-color="#9fe8f2" stop-opacity=".95"/><stop offset="1" stop-color="#43b8d0" stop-opacity=".9"/></radialGradient>' +
      '<radialGradient id="slGlow"><stop offset="0" stop-color="#bff4ff" stop-opacity=".8"/><stop offset="1" stop-color="#bff4ff" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="60" cy="108" rx="34" ry="8" fill="url(#slGlow)"/>' +
    '<g class="sl-swirls" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="2.4" opacity=".85">' +
      '<path d="M10 58 q-8 -2 -6 -9 q3 -6 9 -2"/><path d="M110 52 q8 -2 6 -9 q-3 -6 -9 -2"/><path d="M92 12 q6 -6 12 -1 q4 5 -2 8"/>' +
    '</g>' +
    '<path d="M60 18 C86 18 101 40 101 66 C101 90 82 103 60 103 C38 103 19 90 19 66 C19 40 34 18 60 18Z" fill="url(#slBody)" stroke="#2c9db6" stroke-opacity=".55" stroke-width="2"/>' +
    '<ellipse cx="60" cy="86" rx="27" ry="12" fill="#fff" opacity=".32"/>' +
    '<path d="M36 42 C40 31 51 26 60 26" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>' +
    '<path class="sl-vortex" d="M60 46 C60 42 66 42 66 47 C66 54 54 54 54 46 C54 37 68 36 70 46" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>' +
    '<g class="sl-look"><g class="sl-eyes">' +
      '<ellipse cx="48" cy="72" rx="4.6" ry="6" fill="#1b4a63"/><ellipse cx="72" cy="72" rx="4.6" ry="6" fill="#1b4a63"/>' +
      '<circle cx="49.6" cy="69.6" r="1.7" fill="#fff"/><circle cx="73.6" cy="69.6" r="1.7" fill="#fff"/>' +
    '</g></g>' +
    '<path d="M54 84 q6 5 12 0" fill="none" stroke="#1b4a63" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';

  function makeCursor(className, markup) {
    var el = document.createElement('div');
    el.className = 'cursor ' + className;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="cursor__inner">' + markup + '</span>';
    document.body.appendChild(el);
    return el;
  }

  var ring = makeCursor('cursor-ring', RING_SVG);
  var star = makeCursor('cursor-star', STAR_SVG + FAN_SVG);
  var fanEl = star.querySelector('.ic-fan');
  var starInner = star.querySelector('.cursor__inner');
  var ringInner = ring.querySelector('.cursor__inner');

  // Canvas used for the trail + click effects (on top of the page)
  var fx = document.createElement('canvas');
  fx.className = 'cursor-fx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fx);
  var ctx = fx.getContext('2d');

  // "Sky" canvas for the idle comet: sits right after the meteor canvas, so it is in the
  // background layer (behind the page content), never above text.
  var sky = document.createElement('canvas');
  sky.className = 'idle-sky';
  sky.setAttribute('aria-hidden', 'true');
  var meteorCv = document.getElementById('meteor-canvas');
  if (meteorCv && meteorCv.parentNode) {
    meteorCv.parentNode.insertBefore(sky, meteorCv.nextSibling);
    var mz = getComputedStyle(meteorCv).zIndex;
    if (mz && mz !== 'auto') sky.style.zIndex = mz;
  } else {
    document.body.appendChild(sky);
  }
  var sctx = sky.getContext('2d');

  var dpr = 1, vw = 0, vh = 0;

  function resizeFx() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    [fx, sky].forEach(function (c) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeFx();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resizeFx, 150); });

  /* ---------- State ---------- */
  var mouse = { x: -100, y: -100 };
  var starPos = { x: -100, y: -100 };
  var ringPos = { x: -100, y: -100 };
  var started = false;
  var lastTrail = { x: -100, y: -100 };
  var particles = [];
  var lastTime = 0;
  var fanAngle = 0, hovering = false, fanBoost = 1;

  // idle state machine
  var state = 'active';                       // active | merging | idle | returning
  var stateT = 0;                             // seconds spent in the current state
  var lastActivity = performance.now();
  var mergeFx = null;                         // {k, light} while merging (drawn on the fx canvas)
  var idle = {
    theme: 'dark',
    comets: [], dust: [], nextComet: Infinity, fade: 1, fading: false, skyDirty: false,
    t: 0, ax: 0, ay: 0, blinkAt: 0, blinkPhase: -1, puffAt: 0, lookX: 0, lookY: 0
  };
  var slimeEl = null, slimeLook = null, slimeEyes = null;

  function setActive(on) { star.classList.toggle('is-on', on); ring.classList.toggle('is-on', on); }
  function setHover(on) { hovering = on; star.classList.toggle('is-hover', on); ring.classList.toggle('is-hover', on); }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Particles ---------- */
  // dark mode: little four-pointed sparkles
  function spawnSparkle(x, y, burst) {
    var color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
    var angle = Math.random() * Math.PI * 2;
    var speed = burst ? 60 + Math.random() * 140 : 8 + Math.random() * 22;
    particles.push({
      kind: 'spark', x: x, y: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed + (burst ? 0 : 10),
      life: 0, max: burst ? 0.55 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3,
      size: burst ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2.5, color: color
    });
  }
  // light mode: a curling streak of wind left behind the cursor
  function spawnWind(x, y, dx, dy) {
    var a = Math.atan2(dy, dx) + Math.PI + rand(-0.25, 0.25);   // points BACK along the path
    var drift = rand(18, 42);
    particles.push({
      kind: 'wind', x: x, y: y, a: a, len: rand(22, 42), curl: rand(-9, 9) || 6,
      vx: Math.cos(a) * drift, vy: Math.sin(a) * drift,
      life: 0, max: rand(0.5, 0.8)
    });
  }
  // light mode: click = leaves blown outward + a ripple of wind
  function spawnLeaf(x, y) {
    var a = rand(0, Math.PI * 2), sp = rand(70, 200);
    particles.push({
      kind: 'leaf', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
      rot: rand(0, 6.28), rs: rand(-8, 8),
      life: 0, max: rand(0.7, 1.1), size: rand(3.5, 6.5),
      color: CONFIG.leafColors[Math.floor(Math.random() * CONFIG.leafColors.length)]
    });
  }
  function spawnRipple(x, y) {
    particles.push({ kind: 'ripple', x: x, y: y, vx: 0, vy: 0, life: 0, max: 0.6 });
  }

  function drawSparkle(p, alpha) {
    var s = p.size;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgb(' + p.color + ')';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2);
    ctx.lineTo(p.x + s * 0.5, p.y - s * 0.5);
    ctx.lineTo(p.x + s * 2, p.y);
    ctx.lineTo(p.x + s * 0.5, p.y + s * 0.5);
    ctx.lineTo(p.x, p.y + s * 2);
    ctx.lineTo(p.x - s * 0.5, p.y + s * 0.5);
    ctx.lineTo(p.x - s * 2, p.y);
    ctx.lineTo(p.x - s * 0.5, p.y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  function drawWind(p, alpha) {
    var x2 = p.x + Math.cos(p.a) * p.len, y2 = p.y + Math.sin(p.a) * p.len;
    var nx = -Math.sin(p.a), ny = Math.cos(p.a);
    var cx = (p.x + x2) / 2 + nx * p.curl, cy = (p.y + y2) / 2 + ny * p.curl;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.strokeStyle = 'rgba(80,165,212,' + (alpha * 0.4) + ')'; ctx.lineWidth = 3.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.95) + ')'; ctx.lineWidth = 1.7; ctx.stroke();
    // little curl at the tail end
    ctx.beginPath(); ctx.arc(x2 + nx * p.curl * 0.35, y2 + ny * p.curl * 0.35, 3.2, p.a, p.a + Math.PI * 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.8) + ')'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  function drawLeaf(p, alpha) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = alpha; ctx.fillStyle = 'rgb(' + p.color + ')';
    ctx.strokeStyle = 'rgba(40,110,120,' + (alpha * 0.5) + ')'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawRipple(p, k) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 44, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - k) * 0.9) + ')'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + k * 30, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80,165,212,' + ((1 - k) * 0.5) + ')'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  /* ---------- Idle: the merge glow / whirl (drawn on top, on the fx canvas) ---------- */
  function drawMergeFx(m) {
    var k = m.k;
    if (!m.light) {
      // dark: a glowing point of light gathers where the cursor was
      var r = 10 + 26 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 6 * k;
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.35 + 0.65 * k) + ')');
      g.addColorStop(0.35, 'rgba(255,226,140,' + (0.25 + 0.4 * k) + ')');
      g.addColorStop(1, 'rgba(255,226,140,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2); ctx.fill();
    } else {
      // light: wind swirls spiral inward and condense
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      for (var j = 0; j < 3; j++) {
        var ang = k * 14 + j * 2.094, rr = 34 * (1 - k) + 5;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, rr, ang, ang + 1.7);
        ctx.strokeStyle = 'rgba(80,165,212,' + (0.4 * (1 - k * 0.4)) + ')'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.95 * (1 - k * 0.3)) + ')'; ctx.lineWidth = 1.8; ctx.stroke();
      }
      var g2 = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 22);
      g2.addColorStop(0, 'rgba(190,245,255,' + (0.7 * k) + ')'); g2.addColorStop(1, 'rgba(190,245,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  /* ---------- Idle (dark): the comet ---------- */
  function launchComet(x, y, first) {
    var heading = Math.PI * 0.75;                           // down-left, like meteors.js
    var c = {
      x: x, y: y, ang: heading + rand(-0.12, 0.12),
      v: rand(CONFIG.cometSpeedMin, CONFIG.cometSpeedMax),
      turn: rand(0.1, CONFIG.cometTurn) * (Math.random() < 0.5 ? -1 : 1),   // gentle arc
      age: 0, pts: [], first: first, size: CONFIG.cometSize
    };
    if (!first) { c.x = rand(vw * 0.35, vw + vh * 0.5); c.y = -60; }
    idle.comets.push(c);
    idle.nextComet = Infinity;
  }

  function updateSky(dt) {
    if (!idle.comets.length && !idle.dust.length) {
      if (idle.skyDirty) { sctx.clearRect(0, 0, vw, vh); idle.skyDirty = false; }
      return;
    }
    idle.skyDirty = true;
    if (idle.fading) { idle.fade -= dt / 0.6; if (idle.fade <= 0) { idle.comets = []; idle.dust = []; idle.fading = false; idle.fade = 1; return; } }
    var A = idle.fade * CONFIG.cometAlpha, cols = CONFIG.cometColors, i, j;

    sctx.clearRect(0, 0, vw, vh);
    sctx.globalCompositeOperation = 'lighter';
    sctx.lineCap = 'round';

    for (i = idle.comets.length - 1; i >= 0; i--) {
      var c = idle.comets[i];
      c.age += dt;
      var sp = c.v * (c.first ? Math.min(1, c.age / CONFIG.cometAccel) : 1);
      c.ang += c.turn * dt;
      c.x += Math.cos(c.ang) * sp * dt; c.y += Math.sin(c.ang) * sp * dt;
      c.pts.push({ x: c.x, y: c.y, t: 0 });
      for (j = 0; j < c.pts.length; j++) c.pts[j].t += dt;
      while (c.pts.length && c.pts[0].t > CONFIG.cometTail) c.pts.shift();

      var off = c.x < -160 || c.y > vh + 160 || c.x > vw + vw || c.y < -260;
      if (off && !c.pts.length) { idle.comets.splice(i, 1); if (!idle.comets.length && !idle.fading) idle.nextComet = rand(CONFIG.cometGapMin, CONFIG.cometGapMax); continue; }

      // dust
      if (!off && Math.random() < dt * 45) {
        idle.dust.push({ x: c.x + rand(-6, 6), y: c.y + rand(-6, 6), vx: rand(-22, 22), vy: rand(-22, 22), life: 0, max: rand(0.6, 1.2), s: rand(0.8, 2), ci: Math.floor(Math.random() * 3) });
      }

      // tapered tail: three stacked strokes (violet wide, teal middle, gold thin)
      for (j = 1; j < c.pts.length; j++) {
        var a = c.pts[j - 1], b = c.pts[j];
        var k = 1 - b.t / CONFIG.cometTail;                 // 1 at the head, 0 at the tip
        if (k <= 0) continue;
        var kk = Math.pow(k, 1.4);
        sctx.beginPath(); sctx.moveTo(a.x, a.y); sctx.lineTo(b.x, b.y);
        sctx.strokeStyle = 'rgba(' + cols[2] + ',' + (0.2 * kk * A) + ')'; sctx.lineWidth = c.size * 2.4 * kk; sctx.stroke();
        sctx.strokeStyle = 'rgba(' + cols[1] + ',' + (0.32 * kk * A) + ')'; sctx.lineWidth = c.size * 1.4 * kk; sctx.stroke();
        sctx.strokeStyle = 'rgba(' + cols[0] + ',' + (0.7 * kk * A) + ')'; sctx.lineWidth = c.size * 0.7 * kk; sctx.stroke();
      }

      // head: soft halo + hot core
      var hr = c.size * 6;
      var hg = sctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, hr);
      hg.addColorStop(0, 'rgba(255,255,255,' + A + ')');
      hg.addColorStop(0.25, 'rgba(' + cols[0] + ',' + (0.6 * A) + ')');
      hg.addColorStop(0.6, 'rgba(' + cols[1] + ',' + (0.18 * A) + ')');
      hg.addColorStop(1, 'rgba(' + cols[2] + ',0)');
      sctx.fillStyle = hg; sctx.beginPath(); sctx.arc(c.x, c.y, hr, 0, Math.PI * 2); sctx.fill();
    }

    for (i = idle.dust.length - 1; i >= 0; i--) {
      var d = idle.dust[i]; d.life += dt;
      if (d.life >= d.max) { idle.dust.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      sctx.globalAlpha = (1 - d.life / d.max) * A;
      sctx.fillStyle = 'rgb(' + cols[d.ci] + ')';
      sctx.beginPath(); sctx.arc(d.x, d.y, d.s, 0, Math.PI * 2); sctx.fill();
    }
    sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- Idle (light): the slime ---------- */
  function buildSlime() {
    if (slimeEl) return;
    slimeEl = document.createElement('div');
    slimeEl.className = 'idle-slime';
    slimeEl.setAttribute('aria-hidden', 'true');
    slimeEl.style.width = slimeEl.style.height = CONFIG.slimeSize + 'px';
    slimeEl.innerHTML = SLIME_SVG;
    document.body.appendChild(slimeEl);
    slimeLook = slimeEl.querySelector('.sl-look');
    slimeEyes = slimeEl.querySelector('.sl-eyes');
  }

  function updateSlime(dt) {
    if (!slimeEl) return;
    idle.t += dt;
    var t = idle.t, S = CONFIG.slimeSize;
    var x = idle.ax + Math.cos(t * CONFIG.slimeDriftSpeed) * CONFIG.slimeDriftRadius;
    var y = idle.ay + Math.sin(t * CONFIG.slimeDriftSpeed * 1.3) * CONFIG.slimeDriftRadius * 0.6 +
            Math.sin(t * CONFIG.slimeBobSpeed) * CONFIG.slimeBob;
    var sq = Math.sin(t * CONFIG.slimeBobSpeed + Math.PI / 2) * 0.06;   // squash & stretch
    slimeEl.style.transform = 'translate3d(' + (x - S / 2).toFixed(1) + 'px,' + (y - S / 2).toFixed(1) + 'px,0) scale(' + (1 - sq).toFixed(3) + ',' + (1 + sq).toFixed(3) + ')';

    // eyes look toward the middle of the page
    var dx = vw / 2 - x, dy = vh / 2 - y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    idle.lookX += (dx / len * 2.8 - idle.lookX) * Math.min(1, dt * 3);
    idle.lookY += (dy / len * 1.8 - idle.lookY) * Math.min(1, dt * 3);
    slimeLook.setAttribute('transform', 'translate(' + idle.lookX.toFixed(2) + ' ' + idle.lookY.toFixed(2) + ')');

    // blink
    var sy = 1;
    if (idle.blinkPhase < 0 && t > idle.blinkAt) idle.blinkPhase = 0;
    if (idle.blinkPhase >= 0) {
      idle.blinkPhase += dt / 0.18;
      sy = 1 - 0.92 * Math.sin(Math.PI * Math.min(1, idle.blinkPhase));
      if (idle.blinkPhase >= 1) { idle.blinkPhase = -1; idle.blinkAt = t + rand(CONFIG.blinkMin, CONFIG.blinkMax); }
    }
    slimeEyes.setAttribute('transform', 'translate(0 72) scale(1 ' + sy.toFixed(3) + ') translate(0 -72)');

    // little wind puff
    if (t > idle.puffAt) {
      idle.puffAt = t + rand(CONFIG.puffMin, CONFIG.puffMax);
      for (var n = 0; n < 3; n++) spawnWind(x + S * 0.3, y + rand(-10, 14), 1, rand(-0.25, 0.1));
    }
  }

  /* ---------- Idle: state machine ---------- */
  function blocked() {
    return hovering || document.hidden ||
      root.classList.contains('stage-open') || root.classList.contains('js-loading') || root.classList.contains('puzzle-dragging');
  }

  function clearInner() {
    [starInner, ringInner].forEach(function (el) {
      el.style.transform = ''; el.style.opacity = ''; el.style.filter = ''; el.style.transition = '';
    });
  }

  function beginMerge() {
    state = 'merging'; stateT = 0;
    idle.theme = isLight() ? 'light' : 'dark';
    starInner.style.transition = 'none'; ringInner.style.transition = 'none';
    if (idle.theme === 'light') buildSlime();
  }

  function enterIdle() {
    state = 'idle'; stateT = 0; mergeFx = null; fanBoost = 1;
    starInner.style.opacity = '0'; ringInner.style.opacity = '0';
    idle.fade = 1; idle.fading = false;
    if (idle.theme === 'dark') {
      launchComet(mouse.x, mouse.y, true);
    } else {
      idle.t = 0;
      idle.ax = Math.min(vw - 60, Math.max(60, mouse.x));
      idle.ay = Math.min(vh - 60, Math.max(60, mouse.y - 14));
      idle.blinkAt = rand(CONFIG.blinkMin, CONFIG.blinkMax); idle.blinkPhase = -1;
      idle.puffAt = rand(1.2, 2.5); idle.lookX = idle.lookY = 0;
      slimeEl.classList.remove('is-pop'); slimeEl.classList.add('is-on');
    }
  }

  function beginReturn() {
    if (state !== 'idle' && state !== 'merging') return;
    mergeFx = null; fanBoost = 1;
    if (idle.theme === 'light') {
      if (slimeEl) { slimeEl.classList.remove('is-on'); slimeEl.classList.add('is-pop'); }
      if (!reduce) { spawnRipple(mouse.x, mouse.y); for (var j = 0; j < 8; j++) spawnLeaf(mouse.x, mouse.y); }
    } else {
      idle.fading = true;                                  // comet fades / trails away
      if (!reduce) for (var i = 0; i < 8; i++) spawnSparkle(mouse.x, mouse.y, true);
    }
    // the normal cursor re-forms AT the current mouse position
    starPos.x = ringPos.x = mouse.x; starPos.y = ringPos.y = mouse.y;
    starInner.style.transition = 'none'; ringInner.style.transition = 'none';
    starInner.style.transform = 'scale(0)'; ringInner.style.transform = 'scale(0)';
    state = 'returning'; stateT = 0;
  }

  function hardReset() {   // tab hidden: drop everything immediately (no leaks)
    state = 'active'; mergeFx = null; fanBoost = 1;
    idle.comets = []; idle.dust = []; idle.fading = false; idle.fade = 1; idle.nextComet = Infinity;
    sctx.clearRect(0, 0, vw, vh); idle.skyDirty = false;
    if (slimeEl) { slimeEl.classList.remove('is-on', 'is-pop'); }
    clearInner();
    lastActivity = performance.now();
  }

  function updateIdle(dt, now) {
    if (reduce) return;
    mergeFx = null;

    if (state === 'active') {
      if (blocked()) lastActivity = now;
      else if (started && now - lastActivity > CONFIG.idleDelay) beginMerge();
      return;
    }

    stateT += dt;

    if (state === 'merging') {
      var k = Math.min(1, stateT / (CONFIG.mergeMs / 1000)), e = k * k * (3 - 2 * k);
      var light = idle.theme === 'light';
      starInner.style.transform = 'scale(' + (1 - 0.8 * e).toFixed(3) + ')';
      starInner.style.opacity = (1 - e).toFixed(3);
      starInner.style.filter = light ? '' : 'brightness(' + (1 + 1.6 * e).toFixed(2) + ')';
      ringInner.style.transform = 'scale(' + (1 - e).toFixed(3) + ')';
      ringInner.style.opacity = (1 - e).toFixed(3);
      fanBoost = light ? 1 + 9 * e : 1;                     // the windmill spins up
      mergeFx = { k: e, light: light };
      if (k >= 1) enterIdle();
    } else if (state === 'idle') {
      if (idle.theme === 'dark') {
        if (!idle.comets.length && !idle.fading) {
          idle.nextComet -= dt;
          if (idle.nextComet <= 0) launchComet(0, 0, false);
        }
      } else {
        updateSlime(dt);
      }
    } else if (state === 'returning') {
      var kr = Math.min(1, stateT / (CONFIG.returnMs / 1000));
      var s = 1 + 2.70158 * Math.pow(kr - 1, 3) + 1.70158 * Math.pow(kr - 1, 2);   // ease-out-back
      starInner.style.transform = 'scale(' + Math.max(0, s).toFixed(3) + ')';
      ringInner.style.transform = 'scale(' + Math.max(0, s).toFixed(3) + ')';
      starInner.style.opacity = ringInner.style.opacity = Math.min(1, kr * 3).toFixed(2);
      if (slimeEl && stateT > 0.3) slimeEl.classList.remove('is-pop');
      if (kr >= 1) { clearInner(); state = 'active'; lastActivity = now; }
    }
  }

  /* ---------- Animation loop ---------- */
  function ease(factor, dt) {
    return reduce ? 1 : 1 - Math.pow(1 - factor, dt * 60);   // frame-rate independent lerp
  }

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var lag = Math.sqrt(Math.pow(mouse.x - starPos.x, 2) + Math.pow(mouse.y - starPos.y, 2));   // ~ how fast the mouse moves
    var ks = ease(CONFIG.starEase, dt);
    var kr = ease(CONFIG.ringEase, dt);
    starPos.x += (mouse.x - starPos.x) * ks;
    starPos.y += (mouse.y - starPos.y) * ks;
    ringPos.x += (mouse.x - ringPos.x) * kr;
    ringPos.y += (mouse.y - ringPos.y) * kr;

    star.style.transform = 'translate3d(' + starPos.x.toFixed(1) + 'px,' + starPos.y.toFixed(1) + 'px,0)';
    ring.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';

    // windmill fan spin (light mode only matters visually)
    if (!reduce && fanEl) {
      var spd = CONFIG.fanIdleSpeed + lag * CONFIG.fanMouseGain;
      if (hovering) spd *= 2.2;
      spd *= fanBoost;
      fanAngle = (fanAngle + Math.min(spd, CONFIG.fanMaxSpeed * 3) * dt) % 360;
      fanEl.style.transform = 'rotate(' + fanAngle.toFixed(1) + 'deg)';
    }

    updateIdle(dt, now);
    if (!reduce) updateSky(dt);

    if (!reduce) {
      ctx.clearRect(0, 0, vw, vh);
      var light = isLight();
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';   // "lighter" glows on dark, vanishes on light
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        var k = p.life / p.max;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vx *= 0.96; p.vy *= 0.96; drawSparkle(p, 1 - k); }
        else if (p.kind === 'wind') { p.vx *= 0.97; p.vy *= 0.97; drawWind(p, 1 - k); }
        else if (p.kind === 'leaf') { p.vx *= 0.97; p.vy = p.vy * 0.97 + 60 * dt; p.rot += p.rs * dt; drawLeaf(p, 1 - k * k); }
        else if (p.kind === 'ripple') { drawRipple(p, k); }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (mergeFx) drawMergeFx(mergeFx);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Events ---------- */
  function wake() {
    lastActivity = performance.now();
    if (state === 'merging' || state === 'idle') beginReturn();
  }

  document.addEventListener('mousemove', function (e) {
    var dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!started) {
      started = true;
      starPos.x = ringPos.x = lastTrail.x = mouse.x;
      starPos.y = ringPos.y = lastTrail.y = mouse.y;
      root.classList.add('custom-cursor');   // hide native cursor only now
    }
    wake();
    setActive(true);
    if (!reduce) {
      var tx = mouse.x - lastTrail.x, ty = mouse.y - lastTrail.y;
      if (tx * tx + ty * ty > CONFIG.trailEvery * CONFIG.trailEvery) {
        if (isLight()) spawnWind(mouse.x, mouse.y, dx || tx, dy || ty);
        else spawnSparkle(mouse.x, mouse.y, false);
        lastTrail.x = mouse.x; lastTrail.y = mouse.y;
      }
    }
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    setHover(!!(e.target.closest && e.target.closest(HOVER_SELECTOR)));
  });
  document.addEventListener('mousedown', function () {
    wake();
    star.classList.add('is-down');
    if (reduce) return;
    if (isLight()) {
      spawnRipple(mouse.x, mouse.y);
      for (var j = 0; j < Math.round(CONFIG.burstCount * 0.7); j++) spawnLeaf(mouse.x, mouse.y);
    } else {
      for (var i = 0; i < CONFIG.burstCount; i++) spawnSparkle(mouse.x, mouse.y, true);
    }
  });
  document.addEventListener('mouseup', function () { star.classList.remove('is-down'); });
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('wheel', wake, { passive: true });
  document.addEventListener('keydown', function () { lastActivity = performance.now(); });
  document.documentElement.addEventListener('mouseleave', function () { setActive(false); });
  document.documentElement.addEventListener('mouseenter', function () { if (started) setActive(true); });

  // theme toggled while idle: simplest + cleanest = go back to the normal cursor of the NEW theme
  window.addEventListener('themechange', function () { wake(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) hardReset(); else lastActivity = performance.now(); });

  requestAnimationFrame(frame);
})();