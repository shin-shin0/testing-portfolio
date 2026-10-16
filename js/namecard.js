/* =====================================================================
   namecard.js — the About namecard: flip + tabs + résumé viewer
   =====================================================================
   WHAT IT DOES
   - FRONT of the card = your general info. Click the card (or press
     "Flip card") and it turns over to the BACK. Press "Flip back" (or
     Esc) to return.
   - SELF-CONTAINED: this file sets the layout the flip and scrolling need
     (stacked faces, fixed-height scroll area), so it works even if the
     namecard CSS in style.css is missing or overridden.
   - BACK has tabs: Story · Strengths · Goals · Highlights · Résumé.
     Left/Right arrow keys (and Home/End) move between the tabs. The tab
     content scrolls with the mouse wheel, touch or the keyboard.
   - "View résumé" opens a viewer (the PDF loads the first time).
   - The hidden face is "inert", so keyboard users and screen readers
     only reach the side that is showing.
   - Reduced motion: the card swaps instantly.
   EDIT HERE: the CONFIG object. The résumé path is in index.html (📄).
   ===================================================================== */
(function () {
  'use strict';

  var card = document.querySelector('[data-namecard]');
  if (!card) { console.warn('namecard.js: no [data-namecard] element found'); return; }

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inner = card.querySelector('.nc-inner');
  var front = card.querySelector('[data-nc-front]');
  var back = card.querySelector('[data-nc-back]');
  var panels = card.querySelector('.nc-panels');
  if (!inner || !front || !back) { console.warn('namecard.js: card markup is incomplete'); return; }

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    outMs: 320,          // first half of the flip (old face turns edge-on)
    inMs: 420,           // second half (new face turns in)
    perspective: 1800,   // px, how strong the 3D feels
    heightDesktop: 470,  // card height (px) if the CSS variable --nc-h is missing
    heightPhone: 700,
    phoneWidth: 720
  };

  var flipped = false, busy = false;

  /* ---------- layout (so it works without the namecard CSS) ---------- */
  function cardHeight() {
    var v = parseFloat(getComputedStyle(card).getPropertyValue('--nc-h'));
    if (window.innerWidth <= CONFIG.phoneWidth) return v && v > 500 ? v : CONFIG.heightPhone;
    return v || CONFIG.heightDesktop;
  }
  function layout() {
    card.style.position = 'relative';
    inner.style.cssText += ';position:relative;display:block;height:' + cardHeight() + 'px;transform:none;transform-style:flat;transition:none;';
    [front, back].forEach(function (f) {
      f.style.position = 'absolute';
      f.style.top = '0'; f.style.left = '0'; f.style.width = '100%'; f.style.height = '100%';
      f.style.margin = '0'; f.style.boxSizing = 'border-box'; f.style.overflow = 'hidden';
      f.style.transform = 'none'; f.style.backfaceVisibility = 'visible'; f.style.webkitBackfaceVisibility = 'visible';
    });
    // back face: header + tabs stay put, the panels take the rest and scroll
    back.style.flexDirection = 'column';
    Array.prototype.forEach.call(back.children, function (c) { c.style.flexShrink = '0'; });
    if (panels) {
      panels.style.flex = '1 1 0';
      panels.style.minHeight = '0';
      panels.style.overflowY = 'auto';
      panels.style.overflowX = 'hidden';
      panels.style.overscrollBehavior = 'contain';
      panels.style.webkitOverflowScrolling = 'touch';
      panels.style.touchAction = 'pan-y';
      panels.style.position = 'relative';
      panels.style.zIndex = '3';
    }
    // decorative layers must never catch clicks
    Array.prototype.forEach.call(card.parentNode.querySelectorAll('.plate, .depth-star, .nc-frame, .nc-art, .sheen'), function (n) {
      n.style.pointerEvents = 'none';
    });
    var scene = card.closest('.scene3d');
    var shadow = scene && scene.querySelector('.ground-shadow');
    if (shadow) shadow.style.pointerEvents = 'none';
  }

  function showFace(el) {
    el.style.display = el === back ? 'flex' : 'block';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.classList.remove('is-hidden');
  }
  function hideFace(el) {
    el.style.display = 'none';
    el.classList.add('is-hidden');
  }
  function setInert(el, on) {
    if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
  }
  function persp(deg) { return 'perspective(' + CONFIG.perspective + 'px) rotateY(' + deg + 'deg)'; }

  /* ---------- flip ---------- */
  function setFlipped(value, moveFocus) {
    if (busy || value === flipped) return;
    flipped = value;

    var from = value ? front : back;
    var to = value ? back : front;
    var sign = value ? 1 : -1;

    Array.prototype.forEach.call(card.querySelectorAll('[data-nc-flip]'), function (b) {
      b.setAttribute('aria-pressed', String(value));
    });
    setInert(from, true);
    setInert(to, false);

    function focusNew() {
      if (!moveFocus) return;
      var t = value ? back.querySelector('[role="tab"][aria-selected="true"]') : front.querySelector('[data-nc-flip]');
      if (t) t.focus({ preventScroll: true });
    }
    function finish() {
      hideFace(from);
      showFace(to);
      card.classList.toggle('is-flipped', value);
      if (value && panels) panels.scrollTop = 0;
      focusNew();
    }

    if (reduce || !from.animate) { finish(); return; }

    busy = true;
    var guard = setTimeout(function () { busy = false; }, CONFIG.outMs + CONFIG.inMs + 700);   // never get stuck

    var a = from.animate(
      [{ transform: persp(0) }, { transform: persp(-90 * sign) }],
      { duration: CONFIG.outMs, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }
    );
    a.onfinish = function () {
      a.oncancel = null;
      hideFace(from);
      a.cancel();
      showFace(to);
      card.classList.toggle('is-flipped', value);
      if (value && panels) panels.scrollTop = 0;
      var b = to.animate(
        [{ transform: persp(90 * sign) }, { transform: persp(0) }],
        { duration: CONFIG.inMs, easing: 'cubic-bezier(.2,.9,.3,1)' }
      );
      b.onfinish = b.oncancel = function () { clearTimeout(guard); busy = false; focusNew(); };
    };
    a.oncancel = function () { clearTimeout(guard); busy = false; };
  }

  // ONE click listener for the whole card: buttons flip it, and so does a click on the front
  card.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-nc-flip]');
    if (btn) { e.preventDefault(); setFlipped(!flipped, true); return; }
    if (!flipped && front.contains(e.target) && !e.target.closest('a, button')) setFlipped(true, false);
  });
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && flipped && !root.classList.contains('modal-open')) setFlipped(false, true);
  });

  /* ---------- scrolling on the back ---------- */
  if (panels) {
    // makes the mouse wheel scroll the card's content (and not the page) while there is more to read
    panels.addEventListener('wheel', function (e) {
      var max = panels.scrollHeight - panels.clientHeight;
      if (max <= 1) return;                                   // nothing to scroll: let the page scroll
      var top = panels.scrollTop, dy = e.deltaY;
      if ((dy < 0 && top <= 0) || (dy > 0 && top >= max - 1)) return;   // at an end: let the page scroll on
      e.preventDefault();
      panels.scrollTop = top + dy;
    }, { passive: false });
  }

  /* ---------- tabs ---------- */
  var tabs = Array.prototype.slice.call(card.querySelectorAll('[role="tab"]'));

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (panels) panels.scrollTop = 0;
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') n = tabs[0];
      else if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    });
  });
  if (tabs.length) selectTab(tabs[0], false);

  /* ---------- start ---------- */
  layout();
  showFace(front); front.style.display = '';
  hideFace(back);
  setInert(front, false);
  setInert(back, true);
  var rl;
  window.addEventListener('resize', function () { clearTimeout(rl); rl = setTimeout(function () { inner.style.height = cardHeight() + 'px'; }, 150); });
  console.log('namecard.js ready: click the card or the Flip card button');

  /* ---------- résumé viewer ---------- */
  var modal = document.getElementById('resume-modal');
  if (!modal) return;
  var frame = modal.querySelector('iframe');
  var closeBtn = modal.querySelector('.rm-x');
  var lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    if (frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-src') || '');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    root.classList.add('modal-open');
    document.body.classList.add('no-scroll');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    root.classList.remove('modal-open');
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-resume-open]'), function (b) {
    b.addEventListener('click', openModal);
  });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.slice.call(modal.querySelectorAll('a[href], button'));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();