/* =====================================================================
   scroll-fx.js — scroll progress bar + scroll-linked variables
   =====================================================================
   WHAT IT DOES
   - Adds the thin gold/teal/violet progress bar at the very top that
     fills as you scroll down the page.
   - Publishes the scroll position as CSS variables on <html>, which
     style.css uses for the animations that react to scrolling:
       --scroll   scroll position in px   (background parallax: galaxy,
                                           clouds, hills move at different speeds)
       --prog     0..1 progress through the page (progress bar)
       --hp       0..1 how far the hero has scrolled away (the hero text
                  drifts up and fades as you leave the front page)
   - The reveal-on-scroll animations themselves (fade, slide, flip,
     zoom, letters rising) are driven by main.js + style.css.
   - Reduced motion: only the progress bar is kept.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    var bar = document.createElement('div');
    bar.id = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty('--prog', Math.min(1, y / max).toFixed(4));
      if (reduce) return;
      root.style.setProperty('--scroll', y.toFixed(1));
      root.style.setProperty('--hp', Math.min(1, y / (window.innerHeight * 0.9)).toFixed(3));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();