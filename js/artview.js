/* =====================================================================
   artview.js — click the artwork inside a presented Creation Log card to see
   it in full (no cropping). Zoom, drag to pan, and it slides back into its
   card when you close it. Closing the card then uses showcase.js's own
   "slide back into the pile" animation.
   - Click the picture / scroll wheel = zoom in and out
   - Drag (when zoomed) = move around the artwork
   - Esc, the X button, or a click on the dark area = close
   ===================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CONFIG = { openMs: 520, closeMs: 440, maxZoom: 5, clickZoom: 2.5 };
  var view = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function open(thumbImg) {
    if (view) return;
    var src = thumbImg.currentSrc || thumbImg.src;
    var probe = new Image();
    probe.onload = function () { build(thumbImg, src, probe.naturalWidth, probe.naturalHeight); };
    probe.src = src;
  }

  function build(thumbImg, src, nw, nh) {
    if (view) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min((vw * 0.94) / nw, (vh * 0.84) / nh);
    var w = Math.round(nw * s), h = Math.round(nh * s);

    var overlay = document.createElement('div');
    overlay.className = 'art-view';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Full artwork');
    overlay.innerHTML =
      '<button class="art-view-close" type="button" aria-label="Close full artwork">✕</button>' +
      '<div class="art-view-frame"><img alt="" draggable="false"></div>' +
      '<div class="art-view-hint">Click or scroll to zoom · drag to move · Esc to close</div>';
    var frame = overlay.querySelector('.art-view-frame');
    var img = frame.querySelector('img');
    var closeBtn = overlay.querySelector('.art-view-close');
    img.src = src;
    img.alt = thumbImg.alt || 'Full artwork';
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.left = Math.round((vw - w) / 2) + 'px';
    frame.style.top = Math.round((vh - h) / 2) + 'px';
    document.body.appendChild(overlay);

    var st = { z: 1, px: 0, py: 0, w: w, h: h, closing: false };
    view = { overlay: overlay, frame: frame, img: img, closeBtn: closeBtn, thumb: thumbImg, st: st };

    function apply() {
      img.style.transform = 'translate(' + st.px.toFixed(1) + 'px,' + st.py.toFixed(1) + 'px) scale(' + st.z.toFixed(3) + ')';
      frame.classList.toggle('is-zoomed', st.z > 1);
    }
    function limitPan() {
      var lx = (w * st.z - w) / 2 + w * 0.2, ly = (h * st.z - h) / 2 + h * 0.2;
      st.px = clamp(st.px, -lx, lx); st.py = clamp(st.py, -ly, ly);
    }
    function setZoom(z) {
      st.z = clamp(z, 1, CONFIG.maxZoom);
      if (st.z === 1) { st.px = 0; st.py = 0; }
      limitPan(); apply();
    }

    /* drag to pan, click to zoom */
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, pid = null;
    frame.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId; dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; ox = st.px; oy = st.py;
      try { frame.setPointerCapture(pid); } catch (err) { /* ignore */ }
    });
    frame.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 5) { moved = true; frame.classList.add('is-panning'); }
      if (moved && st.z > 1) { st.px = ox + dx; st.py = oy + dy; limitPan(); apply(); }
    });
    function endDrag(e) {
      if (e.pointerId !== pid) return;
      dragging = false; pid = null; frame.classList.remove('is-panning');
      try { frame.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);
    frame.addEventListener('click', function (e) {
      e.stopPropagation();
      if (moved) { moved = false; return; }
      setZoom(st.z > 1 ? 1 : CONFIG.clickZoom);
    });
    overlay.addEventListener('wheel', function (e) {
      e.preventDefault();
      setZoom(st.z * (e.deltaY < 0 ? 1.18 : 1 / 1.18));
    }, { passive: false });

    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    overlay.addEventListener('click', function (e) { if (!frame.contains(e.target)) close(); });

    /* open: the artwork grows out of the card's picture */
    requestAnimationFrame(function () { overlay.classList.add('is-open'); });
    if (frame.animate && !reduce) {
      var t = thumbImg.getBoundingClientRect();
      var dx0 = (t.left + t.width / 2) - vw / 2;
      var dy0 = (t.top + t.height / 2) - vh / 2;
      var sc0 = Math.max(0.05, t.width / w);
      frame.animate([
        { transform: 'translate(' + dx0.toFixed(1) + 'px,' + dy0.toFixed(1) + 'px) scale(' + sc0.toFixed(3) + ')', opacity: 0.2 },
        { transform: 'none', opacity: 1 }
      ], { duration: CONFIG.openMs, easing: 'cubic-bezier(.2,.9,.25,1)' });
    }
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!view || view.st.closing) return;
    var v = view;
    v.st.closing = true;
    v.overlay.classList.remove('is-open');

    function done() {
      if (v.overlay.parentNode) v.overlay.parentNode.removeChild(v.overlay);
      view = null;
    }
    if (!v.frame.animate || reduce) { done(); return; }

    /* the artwork slides back into the card's picture */
    v.img.style.transition = 'transform .25s ease';
    v.img.style.transform = 'none';
    var vw = window.innerWidth, vh = window.innerHeight;
    var inDom = document.body.contains(v.thumb);
    var tx = 0, ty = 0, ts = 0.9;
    if (inDom) {
      var t = v.thumb.getBoundingClientRect();
      tx = (t.left + t.width / 2) - vw / 2;
      ty = (t.top + t.height / 2) - vh / 2;
      ts = Math.max(0.05, t.width / v.st.w);
    }
    var a = v.frame.animate([
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: 'translate(' + (tx * 0.5).toFixed(1) + 'px,' + (ty * 0.5 - 24).toFixed(1) + 'px) scale(' + ((1 + ts) / 2).toFixed(3) + ')', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + ts.toFixed(3) + ')', opacity: 0, offset: 1 }
    ], { duration: CONFIG.closeMs, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    a.onfinish = done; a.oncancel = done;
  }

  /* click the picture inside the presented card */
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.stage-card .project-thumb img');
    if (img) { e.preventDefault(); open(img); }
  });
  /* the thumb itself (badge area) also counts */
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest && e.target.closest('.stage-card .project-thumb');
    if (thumb && !view && e.target.tagName !== 'IMG') {
      var img = thumb.querySelector('img');
      if (img) open(img);
    }
  });

  /* keyboard: runs before showcase.js so Esc closes only the artwork, not the card behind it */
  window.addEventListener('keydown', function (e) {
    if (!view) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); view.closeBtn.focus(); }
  }, true);

  window.addEventListener('resize', function () { if (view && !view.st.closing) close(); });
})();