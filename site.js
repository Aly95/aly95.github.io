// Small enhancements only. The page reads and works without this file.
// 1. Fades sections in as they scroll into view.
// 2. Turns the project list into a memory card: pick a block to load its project.
// 3. Draws the spinning wireframe on the boot screen.
(function () {
  var root = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('js');

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

  function card() {
    var list = document.querySelector('.slots');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('.slot'));
    var cols = 5;

    function pick(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        var panel = document.getElementById('save-' + t.getAttribute('data-save'));
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
        panel.classList.toggle('pop', on);
      });
      if (focus) tab.focus();
    }

    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Projects');
    list.querySelectorAll('li').forEach(function (li) { li.setAttribute('role', 'presentation'); });
    tabs.forEach(function (t, i) {
      var id = t.getAttribute('data-save');
      var panel = document.getElementById('save-' + id);
      t.setAttribute('role', 'tab');
      t.id = 'slot-' + id;
      t.setAttribute('aria-controls', 'save-' + id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'slot-' + id);
      t.addEventListener('click', function (e) { e.preventDefault(); pick(t, false); });
      t.addEventListener('keydown', function (e) {
        var to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: tabs.length - 1 }[e.key];
        if (to === undefined) {
          if (e.key === ' ') { e.preventDefault(); pick(t, false); }
          return;
        }
        e.preventDefault();
        if (to >= 0 && to < tabs.length) pick(tabs[to], true);
      });
    });

    var hint = document.querySelector('.hint');
    if (hint) hint.hidden = false;
    var wanted = tabs.filter(function (t) { return location.hash === '#save-' + t.getAttribute('data-save'); })[0];
    pick(wanted || tabs[0], false);
  }

  function gem() {
    var canvas = document.getElementById('gem');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var t = (1 + Math.sqrt(5)) / 2;
    var verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var edges = [];
    var i, j;
    for (i = 0; i < verts.length; i++) {
      for (j = i + 1; j < verts.length; j++) {
        var dx = verts[i][0] - verts[j][0], dy = verts[i][1] - verts[j][1], dz = verts[i][2] - verts[j][2];
        if (Math.abs(dx * dx + dy * dy + dz * dz - 4) < 0.01) edges.push([i, j]);
      }
    }
    var size = 0;
    var visible = true;
    var angle = 0.6;
    var last = 0;

    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth * dpr;
      canvas.width = canvas.height = size;
    }

    function draw() {
      var ca = Math.cos(angle), sa = Math.sin(angle), cb = Math.cos(angle * 0.6 + 0.4), sb = Math.sin(angle * 0.6 + 0.4);
      var pts = verts.map(function (v) {
        var x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca;
        var y = v[1] * cb - z * sb;
        z = v[1] * sb + z * cb;
        var k = 4.6 / (4.6 + z);
        return [size / 2 + x * k * size * 0.2, size / 2 + y * k * size * 0.2, z];
      });
      ctx.clearRect(0, 0, size, size);
      ctx.lineWidth = Math.max(1.5, size / 420);
      ctx.lineCap = 'round';
      edges.forEach(function (e, n) {
        var a = pts[e[0]], b = pts[e[1]];
        var depth = (a[2] + b[2]) / 2;
        ctx.globalAlpha = 0.22 + 0.6 * (1 - (depth + 1.9) / 3.8);
        ctx.strokeStyle = n % 2 ? '#ff9a3d' : '#4d8dff';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = size / 60;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      });
    }

    function tick(now) {
      if (visible && !still.matches) {
        angle += Math.min(now - last, 50) * 0.00022;
        draw();
      }
      last = now;
      requestAnimationFrame(tick);
    }

    fit();
    draw();
    window.addEventListener('resize', function () { fit(); draw(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
    }
    requestAnimationFrame(tick);
  }

  function start() {
    reveal();
    card();
    gem();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
