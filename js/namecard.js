/* =====================================================================
   namecard.js — the About namecard: flip + tabs + résumé viewer
   =====================================================================
   WHAT IT DOES
   - FRONT of the card = your general info. Click the card (or the
     "Flip card" button) and it turns over to the BACK.
   - BACK has tabs: Story · Strengths · Goals · Highlights · Résumé.
     Left/Right arrow keys (and Home/End) move between the tabs.
   - "View résumé" opens a viewer over the page (the PDF loads only the
     first time it is opened). Esc, the ✕ button, or a click outside closes it.
   - The hidden side of the card is made "inert", so keyboard users and
     screen readers only ever reach the side that is showing.
   - Reduced motion: the card turns instantly.
   EDIT HERE: the résumé path is in index.html (3 places marked 📄).
   ===================================================================== */
(function () {
  'use strict';

  var card = document.querySelector('[data-namecard]');
  if (!card) return;

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var front = card.querySelector('[data-nc-front]');
  var back = card.querySelector('[data-nc-back]');
  var panels = card.querySelector('.nc-panels');
  var flipped = false;

  /* ---------- flip ---------- */
  function setInert(el, on) {
    if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
  }

  function setFlipped(value, moveFocus) {
    flipped = value;
    card.classList.toggle('is-flipped', value);
    setInert(front, value);
    setInert(back, !value);
    Array.prototype.forEach.call(card.querySelectorAll('[data-nc-flip]'), function (b) {
      b.setAttribute('aria-pressed', String(value));
    });
    if (moveFocus) {
      setTimeout(function () {
        var target = value ? back.querySelector('[role="tab"][aria-selected="true"]') : front.querySelector('[data-nc-flip]');
        if (target) target.focus({ preventScroll: true });
      }, reduce ? 0 : 450);
    }
  }

  Array.prototype.forEach.call(card.querySelectorAll('[data-nc-flip]'), function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); setFlipped(!flipped, true); });
  });
  // clicking anywhere on the front (except links/buttons) also flips it
  front.addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    setFlipped(true, false);
  });
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && flipped && !document.documentElement.classList.contains('modal-open')) setFlipped(false, true);
  });

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

  setFlipped(false, false);

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
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });   // click on the dark backdrop

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {   // keep Tab inside the viewer
      var f = Array.prototype.slice.call(modal.querySelectorAll('a[href], button'));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();