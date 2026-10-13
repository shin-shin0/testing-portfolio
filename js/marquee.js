/* =====================================================================
   marquee.js — "passing-by" text strips on the final section
   =====================================================================
   WHAT IT DOES
   - Scrolls the big text strips (rows marked [data-marquee]) across
     the screen in alternating directions at different speeds.
   - They drift slowly when idle; scrolling the page speeds them up,
     and scrolling UP reverses their direction.
   - Loops seamlessly (the text set is cloned to fill the width).
   - Only animates while the section is on screen; with reduced
     motion the strips stay still.
   EDIT HERE: CONFIG below. Per-row speed/direction are the
   data-speed (px/second) and data-dir (1 or -1) attributes in index.html.
   ===================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('contact');
  var rowEls = Array.prototype.slice.call(document.querySelectorAll('[data-marquee]'));
  if (!section || !rowEls.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    scrollGain: 0.45,      // extra px/s of strip speed per px/s of page scroll
    maxBoost: 2200,        // cap on the scroll boost (px/s)
    velSmoothing: 0.12,    // smooths the measured scroll velocity
    flipSmoothing: 0.07    // how quickly direction reverses (lower = slower turn-around)
  };

  function mod(n, m) { return ((n % m) + m) % m; }

  var rows = rowEls.map(function (el) {
    return {
      el: el,
      track: el.querySelector('.marquee-track'),
      set: el.querySelector('.marquee-set'),
      dir: parseFloat(el.getAttribute('data-dir')) < 0 ? -1 : 1,   // 1 = moves left
      base: parseFloat(el.getAttribute('data-speed')) || 60,
      pos: 0,
      setW: 0
    };
  });

  /* ---------- Layout: clone the text set until it fills the screen ---------- */
  function layout() {
    var vw = window.innerWidth;
    rows.forEach(function (r) {
      Array.prototype.slice.call(r.track.querySelectorAll('[data-clone]')).forEach(function (n) { n.remove(); });
      r.setW = r.set.getBoundingClientRect().width;
      if (!r.setW) return;
      var total = Math.ceil(vw / r.setW) + 2;
      for (var i = 1; i < total; i++) {
        var c = r.set.cloneNode(true);
        c.setAttribute('data-clone', '');
        r.track.appendChild(c);
      }
      r.track.style.marginLeft = (-r.setW) + 'px';   // spare set on the left so the loop works both ways
      paint(r);
    });
  }

  function paint(r) {
    if (!r.setW) return;
    r.track.style.transform = 'translate3d(' + (-mod(r.pos, r.setW)).toFixed(2) + 'px,0,0)';
  }

  /* ---------- Scroll-velocity tracking ---------- */
  var lastY = window.scrollY;
  var vel = 0;          // smoothed |scroll velocity| in px/s
  var flip = 1;         // current direction multiplier, eases between -1 and 1
  var flipTarget = 1;   // +1 scrolling down, -1 scrolling up

  /* ---------- Animation loop ---------- */
  var running = false, visible = false, rafId = 0, last = 0;

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    var y = window.scrollY;
    var dy = y - lastY;
    lastY = y;
    var instant = dt > 0 ? Math.abs(dy) / dt : 0;
    vel += (instant - vel) * CONFIG.velSmoothing;
    if (Math.abs(dy) > 0.5) flipTarget = dy > 0 ? 1 : -1;
    flip += (flipTarget - flip) * CONFIG.flipSmoothing;

    var boost = Math.min(vel * CONFIG.scrollGain, CONFIG.maxBoost);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      r.pos += r.dir * flip * (r.base + boost) * dt;
      paint(r);
    }
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || document.hidden || reduce) return;
    running = true; last = 0; lastY = window.scrollY;
    rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: '150px 0px' }).observe(section);
  } else {
    visible = true;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  layout();
  start();
})();