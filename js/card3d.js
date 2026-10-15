/* =====================================================================
   card3d.js — 3D lean-toward-the-mouse for the floating cards
   =====================================================================
   WHAT IT DOES
   - Your photo, the three stat cards and the contact card float
     gently on their own (that is pure CSS: .float3d in style.css).
   - This script adds the mouse part: hover over one and it leans
     toward your cursor in 3D, and a soft light sheen follows the
     pointer. Leave and it eases back.
   - Desktop (mouse) only; disabled with "reduce motion".
   - NEW: the tilt is switched off while the contact puzzle is active
     (scene has the class "puzzle-on"), so it can't disturb dragging.
   HOW TO USE IT ON ANOTHER ELEMENT
   - Wrap it like the photo in index.html:
       .scene3d > .float3d > .tilt3d[data-tilt-card] > your content
     Optional: data-tilt-max="14" on .scene3d to change the angle.
   EDIT HERE: DEFAULT_MAX below.
   ===================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var DEFAULT_MAX = 10;   // maximum lean in degrees

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene3d'));

  scenes.forEach(function (scene) {
    var tilt = scene.querySelector('[data-tilt-card]');
    if (!tilt) return;
    var max = parseFloat(scene.getAttribute('data-tilt-max')) || DEFAULT_MAX;

    scene.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (scene.classList.contains('puzzle-on')) { tilt.style.transform = ''; return; }   // puzzle running: no tilt
      var r = scene.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      var ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      tilt.style.transform = 'rotateX(' + (-ny * max).toFixed(2) + 'deg) rotateY(' + (nx * max * 1.2).toFixed(2) + 'deg)';
      tilt.style.setProperty('--mx', ((nx + 1) * 50).toFixed(1) + '%');
      tilt.style.setProperty('--my', ((ny + 1) * 50).toFixed(1) + '%');
    });

    scene.addEventListener('pointerleave', function () {
      tilt.style.transform = '';   // CSS transition eases it back to rest
    });
  });
})();