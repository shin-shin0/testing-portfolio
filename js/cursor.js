/* =====================================================================
   cursor.js — star-shaped cursor tracker
   =====================================================================
   WHAT IT DOES
   - A gold four-pointed star follows the mouse with smooth easing,
     and a larger faint star-ring follows more slowly behind it.
   - Hovering links/buttons/cards: star grows, spins and turns teal.
   - Click: a burst of tiny sparkles. Moving: a fading sparkle trail.
   - Only runs on devices with a real mouse (hover + fine pointer);
     on touch devices the normal cursor is left alone.
   - Reduced motion: no easing, no trail, no sparkles.
   EDIT HERE: the CONFIG object and HOVER_SELECTOR below.
   ===================================================================== */
(function () {
  'use strict';

  // Skip entirely on touch / coarse-pointer devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    starEase: 0.35,        // 0..1 — higher = snappier star
    ringEase: 0.12,        // lower = more lag for the trailing ring
    trailEvery: 14,        // px of movement between trail sparkles
    burstCount: 16,        // sparkles per click
    colors: ['231,194,125', '127,224,208', '169,139,255', '243,233,210']
  };
  var HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, select, summary, .panel, .project-card, .skill-card, [data-cursor-hover]';

  var STAR_PATH = 'M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z';
  var NS = 'http://www.w3.org/2000/svg';

  function makeCursor(className, svgMarkup) {
    var el = document.createElement('div');
    el.className = 'cursor ' + className;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="cursor__inner">' + svgMarkup + '</span>';
    document.body.appendChild(el);
    return el;
  }

  var ring = makeCursor('cursor-ring',
    '<svg viewBox="0 0 24 24" focusable="false"><path d="' + STAR_PATH + '"/></svg>');
  var star = makeCursor('cursor-star',
    '<svg viewBox="0 0 24 24" focusable="false"><path d="' + STAR_PATH + '"/></svg>');

  // Canvas used for the trail + click sparkles
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

  function setActive(on) {
    star.classList.toggle('is-on', on);
    ring.classList.toggle('is-on', on);
  }
  function setHover(on) {
    star.classList.toggle('is-hover', on);
    ring.classList.toggle('is-hover', on);
  }

  /* ---------- Particles ---------- */
  function spawn(x, y, burst) {
    var color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
    var angle = Math.random() * Math.PI * 2;
    var speed = burst ? 60 + Math.random() * 140 : 8 + Math.random() * 22;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + (burst ? 0 : 10),
      life: 0,
      max: burst ? 0.55 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3,
      size: burst ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2.5,
      color: color
    });
  }

  function drawSparkle(p, alpha) {
    var s = p.size;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgb(' + p.color + ')';
    ctx.beginPath();          // tiny four-pointed star
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

  /* ---------- Animation loop ---------- */
  function ease(factor, dt) {
    return reduce ? 1 : 1 - Math.pow(1 - factor, dt * 60);   // frame-rate independent lerp
  }

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var ks = ease(CONFIG.starEase, dt);
    var kr = ease(CONFIG.ringEase, dt);
    starPos.x += (mouse.x - starPos.x) * ks;
    starPos.y += (mouse.y - starPos.y) * ks;
    ringPos.x += (mouse.x - ringPos.x) * kr;
    ringPos.y += (mouse.y - ringPos.y) * kr;

    star.style.transform = 'translate3d(' + starPos.x.toFixed(1) + 'px,' + starPos.y.toFixed(1) + 'px,0)';
    ring.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';

    if (!reduce) {
      ctx.clearRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        drawSparkle(p, 1 - p.life / p.max);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Events ---------- */
  document.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!started) {
      started = true;
      starPos.x = ringPos.x = lastTrail.x = mouse.x;
      starPos.y = ringPos.y = lastTrail.y = mouse.y;
      document.documentElement.classList.add('custom-cursor');   // hide native cursor only now
    }
    setActive(true);
    if (!reduce) {
      var dx = mouse.x - lastTrail.x, dy = mouse.y - lastTrail.y;
      if (dx * dx + dy * dy > CONFIG.trailEvery * CONFIG.trailEvery) {
        spawn(mouse.x, mouse.y, false);
        lastTrail.x = mouse.x; lastTrail.y = mouse.y;
      }
    }
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    setHover(!!(e.target.closest && e.target.closest(HOVER_SELECTOR)));
  });
  document.addEventListener('mousedown', function () {
    star.classList.add('is-down');
    if (!reduce) for (var i = 0; i < CONFIG.burstCount; i++) spawn(mouse.x, mouse.y, true);
  });
  document.addEventListener('mouseup', function () { star.classList.remove('is-down'); });
  document.documentElement.addEventListener('mouseleave', function () { setActive(false); });
  document.documentElement.addEventListener('mouseenter', function () { if (started) setActive(true); });

  requestAnimationFrame(frame);
})();