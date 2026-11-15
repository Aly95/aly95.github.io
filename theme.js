// Applies a saved theme before first paint. Without a saved choice the page follows the system setting.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'paper' || saved === 'dark' || saved === 'oled') root.setAttribute('data-theme', saved);
  } catch (e) {}
})();
