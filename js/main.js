/* =====================================================================
   main.js — init, smooth scroll, navigation, scroll reveals
   =====================================================================
   WHAT IT DOES
   - Marks the page as "JS enabled" (enables reveal animations in CSS)
   - Mobile hamburger menu (open/close, Esc key, close on link click)
   - Smooth-scrolls to sections when nav links / buttons are clicked
   - Highlights the active nav link as you scroll
   - Fades sections in as they enter the viewport (IntersectionObserver)
   - Counts up the numbers in the About stats
   EDIT HERE: COUNT_DURATION below, or the IntersectionObserver options.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COUNT_DURATION = 1400; // ms for the stat count-up

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var header = document.getElementById('site-header');
    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-menu');
    var navLinks = Array.prototype.slice.call(menu.querySelectorAll('a[href^="#"]'));

    /* ---------- Footer year ---------- */
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Mobile menu ---------- */
    function setMenu(open) {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('no-scroll', open);
    }
    toggle.addEventListener('click', function () {
      setMenu(!header.classList.contains('nav-open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    // Close the menu if the viewport grows to desktop width
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 860) setMenu(false);
    });

    /* ---------- Smooth scroll for any in-page link ---------- */
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.pushState) history.pushState(null, '', '#' + id);
      // Move keyboard focus to the section for screen-reader/keyboard users
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });

    /* ---------- Header background after scrolling ---------- */
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 40);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------- Active nav link (scroll spy) ---------- */
    var sections = navLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
          });
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 }); // thin band near the middle of the screen
      sections.forEach(function (s) { spy.observe(s); });
    }

    /* ---------- Stat count-up ---------- */
    function countUp(el) {
      var end = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduceMotion) { el.textContent = end + suffix; return; }
      var start = performance.now();
      function step(now) {
        var t = Math.min((now - start) / COUNT_DURATION, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(end * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* ---------- Reveal on scroll ---------- */
    // Stagger children of [data-reveal-stagger] containers
    Array.prototype.forEach.call(document.querySelectorAll('[data-reveal-stagger]'), function (parent) {
      Array.prototype.forEach.call(parent.children, function (child, i) {
        if (child.classList.contains('reveal')) child.style.setProperty('--d', (i * 0.09) + 's');
      });
    });

    var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

    function show(el) {
      el.classList.add('is-visible');
      Array.prototype.forEach.call(el.querySelectorAll('[data-count]'), countUp);
      if (el.hasAttribute('data-count')) countUp(el);
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(show);
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            show(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  });
})();