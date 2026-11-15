// Small enhancements only. The page reads and works without this file.
// 1. Applies a saved theme before first paint and wires up the theme buttons.
// 2. Fades sections in as they scroll into view and drifts the app screenshots.
// 3. Runs the "known words" line in the OSS Nihongo section.
(function () {
  var root = document.documentElement;
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var colours = { paper: '#f2ebdd', dark: '#17161a', oled: '#000000' };

  root.classList.add('js');
  try {
    var saved = localStorage.getItem('theme');
    if (saved in colours) root.setAttribute('data-theme', saved);
  } catch (e) {}

  function themes() {
    var buttons = document.querySelectorAll('[data-set-theme]');

    function paint() {
      var theme = root.getAttribute('data-theme') || (dark.matches ? 'dark' : 'paper');
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-set-theme') === theme));
      });
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.setAttribute('content', colours[theme]);
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var theme = b.getAttribute('data-set-theme');
        root.setAttribute('data-theme', theme);
        try { localStorage.setItem('theme', theme); } catch (e) {}
        paint();
      });
    });

    document.querySelectorAll('.themes').forEach(function (g) { g.hidden = false; });
    if (dark.addEventListener) dark.addEventListener('change', paint);
    paint();
  }

  function reveal() {
    var items = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function drift() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-par]'));
    var wide = window.matchMedia('(min-width: 900px)');
    var queued = false;

    function frame() {
      queued = false;
      var on = wide.matches && !still.matches;
      var mid = window.innerHeight / 2;
      items.forEach(function (el) {
        if (!on) { el.style.transform = ''; return; }
        var box = el.parentNode.getBoundingClientRect();
        if (box.bottom < -200 || box.top > window.innerHeight + 200) return;
        var offset = (box.top + box.height / 2 - mid) * parseFloat(el.getAttribute('data-par'));
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
    }

    function queue() {
      if (!queued) { queued = true; requestAnimationFrame(frame); }
    }

    if (!items.length) return;
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    queue();
  }

  function known() {
    var box = document.getElementById('known');
    if (!box) return;
    var pct = document.getElementById('known-pct');
    var count = document.getElementById('known-n');
    var fill = box.querySelector('.fill');
    var words = [];

    function paint() {
      var n = words.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length;
      var p = Math.round(n / words.length * 100);
      pct.textContent = p + '%';
      count.textContent = n + ' of ' + words.length + ' words';
      fill.style.width = p + '%';
    }

    box.querySelectorAll('[data-w]').forEach(function (span) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'w';
      b.lang = 'ja';
      b.textContent = span.textContent;
      b.setAttribute('aria-pressed', String(span.classList.contains('is-known')));
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
        paint();
      });
      span.parentNode.replaceChild(b, span);
      words.push(b);
    });

    box.querySelector('.known-try').hidden = false;
    paint();
  }

  document.addEventListener('DOMContentLoaded', function () {
    themes();
    reveal();
    drift();
    known();
  });
})();
