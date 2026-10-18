/* audio.js: background music button.
   Light mode plays one track, dark mode plays another.
   Browsers only allow sound after a click, so it never starts by itself. */
(function () {
  'use strict';

  var btn = document.getElementById('audio-toggle');
  if (!btn) return;

  /* ---------- EDIT HERE ---------- */
  var TRACKS = {
    light: 'audio/dusk-in-mondstadt.mp3',
    dark: 'audio/twilight-serenity.mp3'
  };
  var VOLUME = 0.4;   // 0 to 1
  /* ------------------------------- */

  var root = document.documentElement;
  var audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = VOLUME;

  var current = null;   // which theme's track is loaded

  function theme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function setUI(on) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    var label = on ? 'Pause music' : 'Play music';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function load(t) {
    if (current === t) return;
    current = t;
    audio.src = TRACKS[t];
  }

  function play() {
    load(theme());
    btn.classList.remove('is-error');
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { setUI(true); })
       .catch(function (err) {
         if (err && err.name === 'AbortError') return;   // track was switched, ignore
         setUI(false);
         console.warn('audio.js: play() was rejected:', err);
       });
    } else {
      setUI(true);
    }
  }

  function pause() {
    audio.pause();
    setUI(false);
  }

  btn.addEventListener('click', function () {
    if (audio.paused) play(); else pause();
  });

  // if the file can't be loaded, say exactly which path failed
  audio.addEventListener('error', function () {
    console.error('audio.js: could not load "' + audio.src + '". Check the file exists at that path and the name matches exactly.');
    btn.classList.add('is-error');
    setUI(false);
    current = null;   // so the next click retries
  });

  // theme switched: change track, but only if music is playing
  new MutationObserver(function () {
    if (!audio.paused) { load(theme()); audio.play().catch(function () {}); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  setUI(false);
})();