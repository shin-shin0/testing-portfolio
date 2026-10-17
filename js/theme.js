/* theme.js — light / dark switch. Include it ONCE, without defer. */
(function () {
  'use strict';
  if (window.__portfolioThemeInit) return;
  window.__portfolioThemeInit = true;

  var DEFAULT_THEME = 'dark', KEY = 'portfolio-theme', root = document.documentElement;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } }

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