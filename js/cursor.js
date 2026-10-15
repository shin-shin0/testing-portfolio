/* =====================================================================
   cursor.js — custom cursor
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
   - Reduced motion: no easing, no trail, no particles.
   EDIT HERE: the CONFIG object and HOVER_SELECTOR below.
   ===================================================================== */
(function () {
  'use strict';

  // Skip entirely on touch / coarse-pointer devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    leafColors: ['255,255,255', '150,205,130', '245,215,120', '120,200,170']  // light-mode leaves
  };
  var HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, select, summary, .panel, .project-card, .skill-card, [data-cursor-hover]';

  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

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

  // Canvas used for the trail + click effects
  var fx = document.createElement('canvas');
  fx.className = 'cursor-fx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fx);
  var ctx = fx.getContext('2d');
  var dpr = 1, vw = 0, vh = 0;

  function resizeFx() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    fx.width = Math.round(vw * dpr);
    fx.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  var fanAngle = 0, hovering = false;

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
      fanAngle = (fanAngle + Math.min(spd, CONFIG.fanMaxSpeed) * dt) % 360;
      fanEl.style.transform = 'rotate(' + fanAngle.toFixed(1) + 'deg)';
    }

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
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Events ---------- */
  document.addEventListener('mousemove', function (e) {
    var dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!started) {
      started = true;
      starPos.x = ringPos.x = lastTrail.x = mouse.x;
      starPos.y = ringPos.y = lastTrail.y = mouse.y;
      document.documentElement.classList.add('custom-cursor');   // hide native cursor only now
    }
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
  document.documentElement.addEventListener('mouseleave', function () { setActive(false); });
  document.documentElement.addEventListener('mouseenter', function () { if (started) setActive(true); });

  requestAnimationFrame(frame);
})();