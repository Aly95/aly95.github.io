// Applies a saved theme before first paint, then wires up the theme buttons in the footer.
// Without a saved choice the page follows the system setting. The page works without this file.
(function () {
  var root = document.documentElement;
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  var colours = { paper: '#f3ecdf', dark: '#17171c', oled: '#000000' };
  try {
    var saved = localStorage.getItem('theme');
    if (saved in colours) root.setAttribute('data-theme', saved);
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', function () {
    var group = document.querySelector('.themes');
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

    if (group) group.hidden = false;
    if (dark.addEventListener) dark.addEventListener('change', paint);
    paint();
  });
})();
