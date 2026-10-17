/* namecard.js — About namecard: flip + tabs + résumé viewer.
   Self-contained: it sets its own layout, so the flip and the scrolling back work
   even if other CSS interferes. Reduced motion = instant swap.
   If the flip animation ever fails, the card still flips (instant swap). */
(function () {
  'use strict';

  var card = document.querySelector('[data-namecard]');
  if (!card) return;

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inner = card.querySelector('.nc-inner');
  var front = card.querySelector('[data-nc-front]');
  var back = card.querySelector('[data-nc-back]');
  var panels = card.querySelector('.nc-panels');
  if (!inner || !front || !back) return;

  var CONFIG = { outMs: 320, inMs: 420, perspective: 1800, heightDesktop: 470, heightPhone: 700, phoneWidth: 720 };
  var flipped = false, busy = false;

  function cardHeight() {
    var v = parseFloat(getComputedStyle(card).getPropertyValue('--nc-h'));
    if (window.innerWidth <= CONFIG.phoneWidth) return v && v > 500 ? v : CONFIG.heightPhone;
    return v || CONFIG.heightDesktop;
  }
  function layout() {
    card.style.position = 'relative';
    inner.style.cssText += ';position:relative;display:block;height:' + cardHeight() + 'px;transform:none;transform-style:flat;transition:none;';
    [front, back].forEach(function (f) {
      f.style.position = 'absolute'; f.style.top = '0'; f.style.left = '0';
      f.style.width = '100%'; f.style.height = '100%'; f.style.margin = '0';
      f.style.boxSizing = 'border-box'; f.style.overflow = 'hidden';
      f.style.transform = 'none'; f.style.backfaceVisibility = 'visible';
    });
    back.style.flexDirection = 'column';
    Array.prototype.forEach.call(back.children, function (c) { c.style.flexShrink = '0'; });
    if (panels) {
      panels.style.flex = '1 1 0'; panels.style.minHeight = '0';
      panels.style.overflowY = 'auto'; panels.style.overflowX = 'hidden';
      panels.style.overscrollBehavior = 'contain'; panels.style.touchAction = 'pan-y';
      panels.style.position = 'relative'; panels.style.zIndex = '3';
    }
    Array.prototype.forEach.call(card.querySelectorAll('.nc-frame, .nc-art'), function (n) { n.style.pointerEvents = 'none'; });
  }

  function showFace(el) {
    el.style.display = el === back ? 'flex' : 'block';
    el.style.visibility = 'visible'; el.style.pointerEvents = 'auto';
    el.classList.remove('is-hidden');
  }
  function hideFace(el) { el.style.display = 'none'; el.classList.add('is-hidden'); }
  function setInert(el, on) {
    if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
  }
  function persp(deg) { return 'perspective(' + CONFIG.perspective + 'px) rotateY(' + deg + 'deg)'; }

  function setFlipped(value, moveFocus) {
    if (busy || value === flipped) return;
    flipped = value;
    var from = value ? front : back, to = value ? back : front, sign = value ? 1 : -1;

    Array.prototype.forEach.call(card.querySelectorAll('[data-nc-flip]'), function (b) { b.setAttribute('aria-pressed', String(value)); });
    setInert(from, true); setInert(to, false);

    function focusNew() {
      if (!moveFocus) return;
      var t = value ? back.querySelector('[role="tab"][aria-selected="true"]') : front.querySelector('[data-nc-flip]');
      if (t) t.focus({ preventScroll: true });
    }
    function swap() {
      hideFace(from); showFace(to);
      from.style.transform = 'none'; to.style.transform = 'none';
      card.classList.toggle('is-flipped', value);
      if (value && panels) panels.scrollTop = 0;
    }

    if (reduce || !from.animate) { swap(); focusNew(); return; }

    busy = true;
    var guard = setTimeout(function () { busy = false; }, CONFIG.outMs + CONFIG.inMs + 700);
    try {
      var a = from.animate([{ transform: persp(0) }, { transform: persp(-90 * sign) }],
        { duration: CONFIG.outMs, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
      a.onfinish = function () {
        a.oncancel = null; a.cancel(); swap();
        var b = to.animate([{ transform: persp(90 * sign) }, { transform: persp(0) }],
          { duration: CONFIG.inMs, easing: 'cubic-bezier(.2,.9,.3,1)' });
        b.onfinish = b.oncancel = function () { clearTimeout(guard); busy = false; focusNew(); };
      };
      a.oncancel = function () { clearTimeout(guard); busy = false; swap(); focusNew(); };
    } catch (err) {   // animation not possible: flip instantly instead of doing nothing
      clearTimeout(guard); busy = false; swap(); focusNew();
    }
  }

  card.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-nc-flip]');
    if (btn) { e.preventDefault(); setFlipped(!flipped, true); return; }
    if (!flipped && front.contains(e.target) && !e.target.closest('a, button')) setFlipped(true, false);
  });
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && flipped && !root.classList.contains('modal-open')) setFlipped(false, true);
  });

  if (panels) {
    panels.addEventListener('wheel', function (e) {
      var max = panels.scrollHeight - panels.clientHeight;
      if (max <= 1) return;
      var top = panels.scrollTop, dy = e.deltaY;
      if ((dy < 0 && top <= 0) || (dy > 0 && top >= max - 1)) return;
      e.preventDefault(); panels.scrollTop = top + dy;
    }, { passive: false });
  }

  var tabs = Array.prototype.slice.call(card.querySelectorAll('[role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
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

  layout();
  showFace(front); front.style.display = '';
  hideFace(back); setInert(front, false); setInert(back, true);
  var rl;
  window.addEventListener('resize', function () { clearTimeout(rl); rl = setTimeout(function () { inner.style.height = cardHeight() + 'px'; }, 150); });

  /* résumé viewer */
  var modal = document.getElementById('resume-modal');
  if (!modal) return;
  var frame = modal.querySelector('iframe'), closeBtn = modal.querySelector('.rm-x'), lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    if (frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-src') || '');
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    root.classList.add('modal-open'); document.body.classList.add('no-scroll');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  function closeModal() {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    root.classList.remove('modal-open'); document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-resume-open]'), function (b) { b.addEventListener('click', openModal); });
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