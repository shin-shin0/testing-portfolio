/* =====================================================================
   particles.js — soft floating particles over chosen elements
   =====================================================================
   WHAT IT DOES
   - Any element with data-particles="N" gets a transparent canvas laid
     over it with about N tiny glowing motes that drift and twinkle.
     (Hero name: a few, so the letters stay readable. Skill boxes: a few
     floating around each box.)
   - Optional attributes on the element:
       data-particles-pad="24"    how far the particles may stray beyond it (px)
       data-particles-alpha="0.8" brightness (0..1)
   - Colors follow the theme: gold / teal / violet by night, white /
     gold / leaf-green by day.
   - Only animates elements that are on screen; none with reduced motion.
   ===================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DARK_COLORS = ['255,236,190', '255,255,255', '127,224,208', '190,170,255'];
  var LIGHT_COLORS = ['255,255,255', '255,255,255', '255,226,140', '170,225,190'];

  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var items = [];
  var running = false, rafId = 0, last = 0;

  function makeMote(inst, fresh) {
    return {
      x: rand(0, inst.w), y: rand(0, inst.h),
      r: rand(0.7, 2.2),
      vx: rand(-7, 7), vy: rand(-16, -3),
      sway: rand(0, 6.28), swayF: rand(0.6, 1.6),
      life: rand(3.5, 7), t: fresh ? rand(0, 5) : 0,
      star: Math.random() < 0.18,
      ci: Math.floor(Math.random() * 4)
    };
  }

  function setup(el) {
    var canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    var inst = {
      el: el, canvas: canvas, ctx: canvas.getContext('2d'),
      pad: parseFloat(el.getAttribute('data-particles-pad')) || 24,
      alpha: parseFloat(el.getAttribute('data-particles-alpha')) || 0.8,
      count: parseInt(el.getAttribute('data-particles'), 10) || 16,
      w: 0, h: 0, dpr: 1, motes: [], visible: false
    };
    resize(inst);
    items.push(inst);

    if ('ResizeObserver' in window) new ResizeObserver(function () { resize(inst); }).observe(el);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inst.visible = entries[0].isIntersecting;
        if (inst.visible) start();
      }).observe(el);
    } else { inst.visible = true; }
  }

  function resize(inst) {
    var w = inst.el.offsetWidth + inst.pad * 2, h = inst.el.offsetHeight + inst.pad * 2;
    if (!w || !h) return;
    inst.dpr = Math.min(window.devicePixelRatio || 1, 2);
    inst.w = w; inst.h = h;
    inst.canvas.style.left = -inst.pad + 'px';
    inst.canvas.style.top = -inst.pad + 'px';
    inst.canvas.style.width = w + 'px';
    inst.canvas.style.height = h + 'px';
    inst.canvas.width = Math.round(w * inst.dpr);
    inst.canvas.height = Math.round(h * inst.dpr);
    inst.ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
    inst.motes = [];
    for (var i = 0; i < inst.count; i++) inst.motes.push(makeMote(inst, true));
  }

  function draw(inst, dt) {
    var ctx = inst.ctx;
    ctx.clearRect(0, 0, inst.w, inst.h);
    var colors = isLight() ? LIGHT_COLORS : DARK_COLORS;
    for (var i = 0; i < inst.motes.length; i++) {
      var m = inst.motes[i];
      m.t += dt;
      if (m.t >= m.life) { inst.motes[i] = makeMote(inst, false); continue; }
      m.sway += dt * m.swayF;
      m.x += (m.vx + Math.sin(m.sway) * 9) * dt;
      m.y += m.vy * dt;
      var a = Math.sin(Math.PI * (m.t / m.life)) * inst.alpha;   // fade in, fade out
      var col = colors[m.ci];
      ctx.fillStyle = 'rgba(' + col + ',' + (a * 0.18) + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3.2, 0, 6.2832); ctx.fill();   // soft halo
      ctx.fillStyle = 'rgba(' + col + ',' + a + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
      if (m.star) {                                                            // tiny cross sparkle
        var s = m.r * 3.6;
        ctx.strokeStyle = 'rgba(' + col + ',' + (a * 0.8) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(m.x - s, m.y); ctx.lineTo(m.x + s, m.y);
        ctx.moveTo(m.x, m.y - s); ctx.lineTo(m.x, m.y + s);
        ctx.stroke();
      }
    }
  }

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    var any = false;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].visible) continue;
      any = true;
      draw(items[i], dt);
    }
    if (!any) { running = false; return; }
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || document.hidden) return;
    running = true; last = 0;
    rafId = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; cancelAnimationFrame(rafId); } else start();
  });

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-particles]'), setup);
    start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();