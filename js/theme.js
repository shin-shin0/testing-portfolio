/* =====================================================================
   theme.js — light / dark mode switch
   =====================================================================
   WHAT IT DOES
   - Dark mode  = deep space / galaxy background (meteors.js)
   - Light mode = Mondstadt sky + hills with passing winds (wind.js)
   - Applies your saved choice BEFORE the page paints (this file is
     loaded without "defer" so there is no flash of the wrong theme).
   - Wires up the sun/moon button in the navbar and remembers the
     choice in the browser (localStorage).
   - Broadcasts a "themechange" event so the background and cursor
     scripts can react.
   EDIT HERE: DEFAULT_THEME ('dark' or 'light').
   ===================================================================== */
(function () {
  'use strict';

  var DEFAULT_THEME = 'dark';
  var KEY = 'portfolio-theme';
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* storage blocked: fine */ }
  }

  function syncButton(theme) {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var light = theme === 'light';
    btn.setAttribute('aria-pressed', String(light));
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  }

  function apply(theme, announce) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#9edcfb' : '#0b0f1f');
    syncButton(theme);
    if (announce) {
      var evt;
      try { evt = new CustomEvent('themechange', { detail: { theme: theme } }); }
      catch (e) { evt = document.createEvent('Event'); evt.initEvent('themechange', true, true); }
      window.dispatchEvent(evt);
    }
  }

  var saved = read();
  apply(saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME, false);

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    syncButton(root.getAttribute('data-theme'));
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next, true);
      write(next);
    });
  });
})();