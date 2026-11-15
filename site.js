// Theme buttons and flashcards. The page works without this file.
(function () {
  var root = document.documentElement;
  var group = document.querySelector('.themes');
  var buttons = document.querySelectorAll('[data-set-theme]');
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  var colours = { paper: '#f3ecdf', dark: '#17171c', oled: '#000000' };

  function current() {
    return root.getAttribute('data-theme') || (dark.matches ? 'dark' : 'paper');
  }

  function paint() {
    var theme = current();
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

  document.querySelectorAll('.flip').forEach(function (card) {
    card.addEventListener('click', function () {
      card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
    });
  });
})();
