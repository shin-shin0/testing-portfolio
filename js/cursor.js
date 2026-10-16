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
   - Only runs on devices with a real mouse (hover + fine pointer).
   - Reduced motion: no easing, no trail, no particles, no idle effects.

   IDLE   ACTIVE -> MERGING -> IDLE -> RETURNING -> ACTIVE
   - Leave the mouse still for idleDelay ms:
       DARK : the star + ring dissolve into a glowing point which becomes
              a HUGE COMET that sweeps across the whole screen; another
              one every few seconds.
       LIGHT: the windmill spins up into a whirl of wind which becomes a
              STORM DRAGON (an original drawing inspired by Venti's
              dragon): it flies out of the whirl, crosses the sky with its
              wings beating, and returns every now and then.
   - Both are drawn on a transparent canvas ABOVE the page but under the
     cursor, with pointer-events: none, so they never block clicks.
   - Any mouse move / click / scroll fades it away and the normal cursor
     re-forms right at the mouse.
   - Hovering links, an open quest card or résumé, the loader and puzzle
     dragging all count as activity.
   EDIT HERE: the CONFIG object and HOVER_SELECTOR below.
   ===================================================================== */
(function () {
  'use strict';

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
    skyZ: 8400,            // z-index of the idle canvas (above the page, below the cursor)

    /* --- idle (dark): comet --- */
    cometSize: 30,         // head size / tail thickness (px). Normal meteors are 1-3px, so this is HUGE
    cometTail: 1.5,        // seconds of trail kept (tail length = speed x this)
    cometSpeedMin: 750,    // px per second
    cometSpeedMax: 1000,
    cometAccel: 0.9,       // seconds the first comet takes to pick up speed
    cometGrow: 1.0,        // seconds the first comet takes to swell from a point of light to full size
    cometTurn: 0.22,       // max curve (radians per second) of the gentle arc
    cometGapMin: 4,        // seconds of waiting between comets
    cometGapMax: 9,
    cometAlpha: 0.9,       // overall translucency (lower = more see-through)
    cometColors: ['255,236,190', '127,224,208', '169,139,255'],   // gold, teal, violet (as in meteors.js)

        /* --- idle (light): wandering bird --- */
    birdSize: 24,          // body size (px). The wings are ~2.3x this
    birdSpeedMin: 150,     // px per second
    birdSpeedMax: 210,
    birdLifeMin: 9,        // seconds it wanders on screen before flying away
    birdLifeMax: 15,
    birdFlap: 10,          // wing beats (radians/second)
    birdTurnMin: 4,        // seconds between turning around
    birdTurnMax: 8,
    birdGapMin: 5,         // seconds of waiting between visits
    birdGapMax: 10,
    birdAlpha: 0.97,       // overall translucency (lower = more see-through)
  };

  var HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, select, summary, .panel, .project-card, [data-cursor-hover]';

  function isLight() { return root.getAttribute('data-theme') === 'light'; }

  var STAR_PATH = 'M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z';

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

  // Canvas used for the trail + click effects (on top of everything)
  var fx = document.createElement('canvas');
  fx.className = 'cursor-fx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fx);
  var ctx = fx.getContext('2d');

  // "Sky" canvas for the idle comet / dragon: above the page, under the cursor, never clickable
  var sky = document.createElement('canvas');
  sky.className = 'idle-sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:' + CONFIG.skyZ;
  document.body.appendChild(sky);
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

  var state = 'active';                       // active | merging | idle | returning
  var stateT = 0;
  var lastActivity = performance.now();
  var mergeFx = null;
  var idle = {
    theme: 'dark',
    comets: [], birds: [], dust: [],
    nextFly: Infinity, fade: 1, fading: false, skyDirty: false
  };

  function setActive(on) { star.classList.toggle('is-on', on); ring.classList.toggle('is-on', on); }
  function setHover(on) { hovering = on; star.classList.toggle('is-hover', on); ring.classList.toggle('is-hover', on); }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Particles (normal cursor effects) ---------- */
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
  function spawnWind(x, y, dx, dy) {
    var a = Math.atan2(dy, dx) + Math.PI + rand(-0.25, 0.25);
    var drift = rand(18, 42);
    particles.push({
      kind: 'wind', x: x, y: y, a: a, len: rand(22, 42), curl: rand(-9, 9) || 6,
      vx: Math.cos(a) * drift, vy: Math.sin(a) * drift,
      life: 0, max: rand(0.5, 0.8)
    });
  }
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

  /* ---------- Idle: the merge glow / whirl (drawn on the fx canvas) ---------- */
  function drawMergeFx(m) {
    var k = m.k;
    if (!m.light) {
      var r = 10 + 26 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 6 * k;
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.35 + 0.65 * k) + ')');
      g.addColorStop(0.35, 'rgba(255,226,140,' + (0.25 + 0.4 * k) + ')');
      g.addColorStop(1, 'rgba(255,226,140,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2); ctx.fill();
    } else {
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

  /* =====================================================================
     IDLE (dark): the HUGE comet
     ===================================================================== */
  function scheduleNext(min, max) { idle.nextFly = rand(min, max); }

  function launchComet(first) {
    var c = {
      v: rand(CONFIG.cometSpeedMin, CONFIG.cometSpeedMax),
      turn: rand(0.08, CONFIG.cometTurn) * (Math.random() < 0.5 ? -1 : 1),
      age: 0, pts: [], first: first, off: false, size: CONFIG.cometSize
    };
    if (first) {
      // born at the cursor; head for the far side of the screen so it crosses most of the sky
      c.x = mouse.x; c.y = mouse.y;
      var h = mouse.x > vw * 0.5 ? Math.PI * 0.78 : Math.PI * 0.22;   // down-left or down-right
      if (mouse.y > vh * 0.6) h = -h;                                  // low on the screen: go up instead
      c.ang = h + rand(-0.08, 0.08);
    } else {
      c.x = rand(vw * 0.45, vw + vh * 0.4); c.y = -c.size * 8;         // enters from the top-right
      c.ang = Math.PI * 0.75 + rand(-0.1, 0.1);
    }
    idle.comets.push(c);
    idle.nextFly = Infinity;
  }

  function drawComets(dt) {
    var A = idle.fade * CONFIG.cometAlpha, cols = CONFIG.cometColors, i, j, k, kk;
    for (i = idle.comets.length - 1; i >= 0; i--) {
      var c = idle.comets[i];

      if (!c.off) {
        c.age += dt;
        var grow = c.first ? Math.min(1, c.age / CONFIG.cometGrow) : 1;
        var sp = c.v * (c.first ? 0.35 + 0.65 * Math.min(1, c.age / CONFIG.cometAccel) : 1);
        c.ang += c.turn * dt;
        c.x += Math.cos(c.ang) * sp * dt; c.y += Math.sin(c.ang) * sp * dt;
        c.g = 0.2 + 0.8 * grow;
        c.pts.push({ x: c.x, y: c.y, t: 0, g: c.g });
        var m = c.size * 8;
        if (c.age > 0.6 && (c.x < -m || c.x > vw + m || c.y < -m * 2 || c.y > vh + m)) c.off = true;
      }
      for (j = 0; j < c.pts.length; j++) c.pts[j].t += dt;
      while (c.pts.length && c.pts[0].t > CONFIG.cometTail) c.pts.shift();

      if (c.off && !c.pts.length) {
        idle.comets.splice(i, 1);
        if (!idle.comets.length && !idle.fading) scheduleNext(CONFIG.cometGapMin, CONFIG.cometGapMax);
        continue;
      }

      // fine dust shed along the way
      if (!c.off && Math.random() < dt * 80) {
        idle.dust.push({ x: c.x + rand(-c.size, c.size), y: c.y + rand(-c.size, c.size), vx: rand(-30, 30), vy: rand(-30, 30),
          life: 0, max: rand(0.7, 1.4), s: rand(1, 2.8), c: cols[Math.floor(Math.random() * 3)] });
      }

      // tapered tail: three stacked strokes (violet wide, teal middle, gold thin)
      sctx.lineCap = 'round';
      for (j = 1; j < c.pts.length; j++) {
        var a = c.pts[j - 1], b = c.pts[j];
        k = 1 - b.t / CONFIG.cometTail;
        if (k <= 0) continue;
        kk = Math.pow(k, 1.3) * b.g;
        sctx.beginPath(); sctx.moveTo(a.x, a.y); sctx.lineTo(b.x, b.y);
        sctx.strokeStyle = 'rgba(' + cols[2] + ',' + (0.22 * kk * A) + ')'; sctx.lineWidth = c.size * 2.4 * kk; sctx.stroke();
        sctx.strokeStyle = 'rgba(' + cols[1] + ',' + (0.34 * kk * A) + ')'; sctx.lineWidth = c.size * 1.4 * kk; sctx.stroke();
        sctx.strokeStyle = 'rgba(' + cols[0] + ',' + (0.75 * kk * A) + ')'; sctx.lineWidth = c.size * 0.7 * kk; sctx.stroke();
      }

      // head: big halo, hot core and a star flare
      if (!c.off) {
        var s = c.size * c.g, hr = s * 6;
        var hg = sctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, hr);
        hg.addColorStop(0, 'rgba(255,255,255,' + A + ')');
        hg.addColorStop(0.2, 'rgba(' + cols[0] + ',' + (0.7 * A) + ')');
        hg.addColorStop(0.55, 'rgba(' + cols[1] + ',' + (0.22 * A) + ')');
        hg.addColorStop(1, 'rgba(' + cols[2] + ',0)');
        sctx.fillStyle = hg; sctx.beginPath(); sctx.arc(c.x, c.y, hr, 0, Math.PI * 2); sctx.fill();
        sctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * A) + ')'; sctx.lineWidth = Math.max(1.5, s * 0.12);
        sctx.beginPath();
        sctx.moveTo(c.x - s * 3.2, c.y); sctx.lineTo(c.x + s * 3.2, c.y);
        sctx.moveTo(c.x, c.y - s * 3.2); sctx.lineTo(c.x, c.y + s * 3.2);
        sctx.stroke();
      }
    }
  }

   /* =====================================================================
     IDLE (light): the WANDERING BIRD — an original drawing
     (cream-white songbird, sky-teal wings and tail, golden beak,
     a soft wind ribbon behind it)
     ===================================================================== */
  function launchBird(first) {
    var d = {
      t: 0, first: first, S: CONFIG.birdSize, mode: 'wander',
      life: rand(CONFIG.birdLifeMin, CONFIG.birdLifeMax),
      speed: rand(CONFIG.birdSpeedMin, CONFIG.birdSpeedMax),
      ph1: rand(0, 6.28), ph2: rand(0, 6.28), flap: rand(0, 6.28),
      b: 0, wt: rand(0, 6.28), glide: 0, glideT: 0, nextGlide: rand(2, 4),
      nextTurn: rand(CONFIG.birdTurnMin, CONFIG.birdTurnMax), hist: []
    };
    if (first) { d.x = mouse.x; d.y = mouse.y; d.dir = mouse.x < vw / 2 ? 1 : -1; }
    else { d.dir = Math.random() < 0.5 ? 1 : -1; d.x = d.dir > 0 ? -80 : vw + 80; d.y = rand(vh * 0.15, vh * 0.6); }
    d.fx = d.dir;
    idle.birds.push(d);
    idle.nextFly = Infinity;
  }

  // a leaf / feather shape pointing along +x
  function petal(c, L, w) {
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(L * 0.22, -w, L * 0.72, -w * 0.9, L, 0);
    c.bezierCurveTo(L * 0.72, w * 0.9, L * 0.22, w, 0, 0);
    c.closePath();
  }

  // a wing = three overlapping feathers fanned from the shoulder
  function birdWing(c, x, y, L, th, A, back) {
    var a = back ? A * 0.8 : A;
    c.save(); c.translate(x, y); c.rotate(th); c.lineJoin = 'round';
    for (var k = 2; k >= 0; k--) {
      c.save(); c.rotate((k - 1) * 0.24);
      var len = L * (1 - k * 0.1);
      var g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      g.addColorStop(0.55, 'rgba(150,222,236,' + a + ')');
      g.addColorStop(1, 'rgba(70,160,205,' + a + ')');
      petal(c, len, L * 0.26);
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(40,120,160,' + a + ')'; c.lineWidth = Math.max(1.2, L * 0.03); c.stroke();
      c.restore();
    }
    c.restore();
  }

  function drawBirds(dt) {
    var A = idle.fade * CONFIG.birdAlpha, c = sctx, i;
    for (var bi = idle.birds.length - 1; bi >= 0; bi--) {
      var d = idle.birds[bi];
      d.t += dt;
      var S = d.S * (d.first ? Math.min(1, 0.25 + 0.75 * d.t / 1.2) : 1);   // the first one swells out of the whirl

      // --- wander: drift up and down, turn around now and then ---
      var want = 0.5 * Math.sin(d.t * 0.8 + d.ph1) + 0.25 * Math.sin(d.t * 1.9 + d.ph2);
      if (d.mode === 'wander') {
        if (d.y < vh * 0.12) want = 0.5; else if (d.y > vh * 0.8) want = -0.5;
        d.nextTurn -= dt;
        if (d.x < 90) d.dir = 1;
        else if (d.x > vw - 90) d.dir = -1;
        else if (d.nextTurn <= 0) { d.dir = -d.dir; d.nextTurn = rand(CONFIG.birdTurnMin, CONFIG.birdTurnMax); }
        if (d.t > d.life) { d.mode = 'leave'; d.dir = d.x < vw / 2 ? -1 : 1; }
      } else { want = -0.2; }                                   // leaving: climb a little
      d.b += (clamp(want, -0.6, 0.6) - d.b) * Math.min(1, dt * 2);
      d.fx += (d.dir - d.fx) * Math.min(1, dt * 1.8);           // smooth turn-around
      d.x += d.fx * Math.cos(d.b) * d.speed * dt;
      d.y += Math.sin(d.b) * d.speed * 0.6 * dt;

      // --- wings: flapping with occasional glides ---
      d.nextGlide -= dt;
      if (d.nextGlide <= 0) { d.glideT = rand(0.9, 1.7); d.nextGlide = rand(3, 6); }
      d.glideT = Math.max(0, d.glideT - dt);
      d.glide += ((d.glideT > 0 ? 1 : 0) - d.glide) * Math.min(1, dt * 4);
      d.wt += dt * CONFIG.birdFlap * (1 - 0.8 * d.glide);
      var flap = Math.sin(d.wt + d.flap);
      var bob = flap * S * 0.08 * (1 - d.glide);

      // --- wind ribbon behind it ---
      d.hist.push({ x: d.x, y: d.y, t: 0 });
      for (i = 0; i < d.hist.length; i++) d.hist[i].t += dt;
      while (d.hist.length && d.hist[0].t > 1.3) d.hist.shift();
      c.lineCap = 'round';
      for (i = 1; i < d.hist.length; i++) {
        var h0 = d.hist[i - 1], h1 = d.hist[i], k = 1 - h1.t / 1.3;
        if (k <= 0) continue;
        c.beginPath();
        c.moveTo(h0.x, h0.y + Math.sin(h0.t * 9) * S * 0.3 * (1 - k));
        c.lineTo(h1.x, h1.y + Math.sin(h1.t * 9) * S * 0.3 * (1 - k));
        c.strokeStyle = 'rgba(255,255,255,' + (0.6 * k * A) + ')'; c.lineWidth = Math.max(1, S * 0.14 * k); c.stroke();
      }

      // --- the bird (drawn facing +x; mirrored when it turns) ---
      var sx = clamp(d.fx * 1.5, -1, 1);
      if (Math.abs(sx) < 0.03) sx = sx < 0 ? -0.03 : 0.03;
      c.save();
      c.translate(d.x, d.y + bob); c.rotate(d.b * 0.55 * (sx < 0 ? -1 : 1)); c.scale(sx, 1);
      c.lineJoin = 'round';
      var line = 'rgba(40,120,160,' + A + ')', lw = Math.max(1.2, S * 0.06);

      var halo = c.createRadialGradient(0, 0, 0, 0, 0, S * 2.6);       // soft glow so it reads on bright sky
      halo.addColorStop(0, 'rgba(255,255,255,' + (0.35 * A) + ')'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(0, 0, S * 2.6, 0, 6.2832); c.fill();

      // tail feathers
      c.save(); c.translate(-S * 1.0, S * 0.05);
      for (var q = -1; q <= 1; q++) {
        c.save(); c.rotate(Math.PI + q * 0.28 + Math.sin(d.wt * 0.5) * 0.05);
        petal(c, S * 1.5, S * 0.3);
        c.fillStyle = 'rgba(120,205,225,' + A + ')'; c.fill(); c.strokeStyle = line; c.lineWidth = lw; c.stroke();
        c.restore();
      }
      c.restore();

      // far wing
      birdWing(c, S * 0.25, -S * 0.25, S * 2.0, -3.15 + 0.25 * d.glide + 0.7 * (1 - d.glide) * Math.sin(d.wt + d.flap + 0.6), A, true);

      // body, belly, back
      c.fillStyle = 'rgba(255,252,240,' + A + ')'; c.strokeStyle = line; c.lineWidth = lw;
      c.beginPath(); c.ellipse(0, 0, S * 1.15, S * 0.62, 0, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,' + A + ')';
      c.beginPath(); c.ellipse(S * 0.1, S * 0.2, S * 0.9, S * 0.3, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(130,208,226,' + (0.6 * A) + ')';
      c.beginPath(); c.ellipse(-S * 0.2, -S * 0.22, S * 0.85, S * 0.3, 0, 0, 6.2832); c.fill();

      // head, crest, beak, eye
      c.save(); c.translate(S * 1.1, -S * 0.4); c.rotate(-2.3);
      petal(c, S * 0.6, S * 0.16); c.fillStyle = 'rgba(120,205,225,' + A + ')'; c.fill(); c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,252,240,' + A + ')';
      c.beginPath(); c.arc(S * 1.15, -S * 0.35, S * 0.46, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = 'rgba(246,200,100,' + A + ')';
      c.beginPath(); c.moveTo(S * 1.55, -S * 0.42); c.lineTo(S * 2.0, -S * 0.3); c.lineTo(S * 1.55, -S * 0.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,190,190,' + (0.5 * A) + ')';
      c.beginPath(); c.arc(S * 1.28, -S * 0.22, S * 0.1, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(25,60,90,' + A + ')';
      c.beginPath(); c.arc(S * 1.3, -S * 0.42, S * 0.09, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,' + A + ')';
      c.beginPath(); c.arc(S * 1.33, -S * 0.45, S * 0.035, 0, 6.2832); c.fill();

      // near wing (on top)
      birdWing(c, S * 0.1, -S * 0.3, S * 2.3, -3.15 + 0.25 * d.glide + 0.75 * (1 - d.glide) * flap, A, false);
      c.restore();

      // sparkles shed from the wings
      if (Math.random() < dt * 20) {
        idle.dust.push({ x: d.x - d.fx * S + rand(-6, 6), y: d.y + rand(-S, S * 0.4), vx: rand(-12, 12), vy: rand(-14, 6),
          life: 0, max: rand(0.7, 1.3), s: rand(1.4, 3), c: Math.random() < 0.5 ? '255,255,255' : '150,235,255' });
      }

      // finished: it has flown off screen
      if ((d.mode === 'leave' && (d.x < -140 || d.x > vw + 140)) || d.t > d.life + 20) {
        idle.birds.splice(bi, 1);
        if (!idle.birds.length && !idle.fading) scheduleNext(CONFIG.birdGapMin, CONFIG.birdGapMax);
      }
    }
  }


  /* ---------- sky canvas update ---------- */
  function updateSky(dt) {
    var has = idle.comets.length || idle.birds.length || idle.dust.length;
    if (!has) {
      if (idle.skyDirty) { sctx.clearRect(0, 0, vw, vh); idle.skyDirty = false; }
      return;
    }
    idle.skyDirty = true;
    if (idle.fading) {
      idle.fade -= dt / 0.7;
      if (idle.fade <= 0) {
        idle.comets = []; idle.birds = []; idle.dust = []; idle.fading = false; idle.fade = 1;
        sctx.clearRect(0, 0, vw, vh); idle.skyDirty = false;
        return;
      }
    }
    sctx.clearRect(0, 0, vw, vh);
    var dark = idle.theme === 'dark';
    sctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    if (dark) drawComets(dt); else drawBirds(dt);

    // dust (drawn on top)
    for (var i = idle.dust.length - 1; i >= 0; i--) {
      var d = idle.dust[i]; d.life += dt;
      if (d.life >= d.max) { idle.dust.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      sctx.globalAlpha = (1 - d.life / d.max) * idle.fade * 0.9;
      sctx.fillStyle = 'rgb(' + d.c + ')';
      sctx.beginPath(); sctx.arc(d.x, d.y, d.s, 0, 6.2832); sctx.fill();
    }
    sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- Idle: state machine ---------- */
  function blocked() {
    return hovering || document.hidden ||
      root.classList.contains('stage-open') || root.classList.contains('modal-open') ||
      root.classList.contains('js-loading') || root.classList.contains('puzzle-dragging');
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
  }

  function enterIdle() {
    state = 'idle'; stateT = 0; mergeFx = null; fanBoost = 1;
    starInner.style.opacity = '0'; ringInner.style.opacity = '0';
    idle.fade = 1; idle.fading = false;
    if (idle.theme === 'dark') launchComet(true);
    else launchBird(true);
  }

  function beginReturn() {
    if (state !== 'idle' && state !== 'merging') return;
    mergeFx = null; fanBoost = 1;
    idle.fading = true;                              // the comet / dragon fades away
    idle.nextFly = Infinity;
    if (!reduce) {
      if (idle.theme === 'light') { spawnRipple(mouse.x, mouse.y); for (var j = 0; j < 8; j++) spawnLeaf(mouse.x, mouse.y); }
      else for (var i = 0; i < 8; i++) spawnSparkle(mouse.x, mouse.y, true);
    }
    // the normal cursor re-forms AT the current mouse position
    starPos.x = ringPos.x = mouse.x; starPos.y = ringPos.y = mouse.y;
    starInner.style.transition = 'none'; ringInner.style.transition = 'none';
    starInner.style.transform = 'scale(0)'; ringInner.style.transform = 'scale(0)';
    state = 'returning'; stateT = 0;
  }

  function hardReset() {   // tab hidden: drop everything immediately (no leaks)
    state = 'active'; mergeFx = null; fanBoost = 1;
    idle.comets = []; idle.dragons = []; idle.dust = [];
    idle.fading = false; idle.fade = 1; idle.nextFly = Infinity;
    sctx.clearRect(0, 0, vw, vh); idle.skyDirty = false;
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
      if (!idle.fading) {
        var list = idle.theme === 'dark' ? idle.comets : idle.dragons;
        if (!list.length) {
          idle.nextFly -= dt;
          if (idle.nextFly <= 0) { if (idle.theme === 'dark') launchComet(false); else launchDragon(false); }
        }
      }
    } else if (state === 'returning') {
      var kr = Math.min(1, stateT / (CONFIG.returnMs / 1000));
      var s = 1 + 2.70158 * Math.pow(kr - 1, 3) + 1.70158 * Math.pow(kr - 1, 2);   // ease-out-back
      starInner.style.transform = 'scale(' + Math.max(0, s).toFixed(3) + ')';
      ringInner.style.transform = 'scale(' + Math.max(0, s).toFixed(3) + ')';
      starInner.style.opacity = ringInner.style.opacity = Math.min(1, kr * 3).toFixed(2);
      if (kr >= 1) { clearInner(); state = 'active'; lastActivity = now; }
    }
  }

  /* ---------- Animation loop ---------- */
  function ease(factor, dt) {
    return reduce ? 1 : 1 - Math.pow(1 - factor, dt * 60);
  }

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var lag = Math.sqrt(Math.pow(mouse.x - starPos.x, 2) + Math.pow(mouse.y - starPos.y, 2));
    var ks = ease(CONFIG.starEase, dt);
    var kr = ease(CONFIG.ringEase, dt);
    starPos.x += (mouse.x - starPos.x) * ks;
    starPos.y += (mouse.y - starPos.y) * ks;
    ringPos.x += (mouse.x - ringPos.x) * kr;
    ringPos.y += (mouse.y - ringPos.y) * kr;

    star.style.transform = 'translate3d(' + starPos.x.toFixed(1) + 'px,' + starPos.y.toFixed(1) + 'px,0)';
    ring.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';

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
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
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
      root.classList.add('custom-cursor');
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

  // theme toggled while idle: go back to the normal cursor of the NEW theme
  window.addEventListener('themechange', function () { wake(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) hardReset(); else lastActivity = performance.now(); });

  requestAnimationFrame(frame);
})();
