// Enhancements only: the page works without this file. One function per
// feature, each in its own try so one failure does not stop the others.
(function () {
var root = document.documentElement;
root.classList.add('js');

var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
var wide = window.matchMedia('(min-width: 860px)');
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function fxOff() { return root.getAttribute('data-fx') === 'off'; }
function moving() { return !reduce.matches && !fxOff(); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function store(kind, key, val) {
  try { if (val === null) window[kind].removeItem(key); else window[kind][key] = val; } catch (e) {}
}
function current(el, on) { if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); }

// Counts written from the number of projects, so nothing is hardcoded.
var saveEls = $$('.save');
$$('[data-count]').forEach(function (el) { el.textContent = saveEls.length; });
$$('.meter li').forEach(function (li, i) { li.classList.toggle('on', i < saveEls.length); });

// Boot: the CSS plays it under html.boot; this ends it and remembers it ran.
function boot() {
  if (!root.classList.contains('boot')) return;
  var line = $('.status-line');
  var ended = false;
  var events = ['keydown', 'pointerdown', 'wheel', 'scroll'];
  function end(natural) {
    if (ended) return;
    ended = true;
    root.classList.remove('boot');
    store('sessionStorage', 'booted', '1');
    events.forEach(function (t) { window.removeEventListener(t, early, true); });
    var start = $('.start');
    if (natural && start) {
      start.classList.add('blink');
      start.addEventListener('animationend', function () { start.classList.remove('blink'); }, { once: true });
    }
    document.dispatchEvent(new CustomEvent('bootend'));
  }
  function early() { end(false); }
  if (line) line.addEventListener('animationend', function () { end(true); });
  events.forEach(function (t) { window.addEventListener(t, early, { capture: true, passive: true }); });
  document.addEventListener('fxchange', early);
  setTimeout(function () { end(true); }, 1600);
}

// HUD: solid bar once the hero is gone, and scroll spy.
function hud() {
  var bar = $('.hud');
  var hero = $('.hero');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (en) {
    bar.classList.toggle('solid', !en[0].isIntersecting);
  }, { rootMargin: '-60px 0px 0px 0px' }).observe(hero);

  var links = $$('nav a', bar);
  var spy = new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (e.isIntersecting) links.forEach(function (a) { current(a, a.hash === '#' + e.target.id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  [hero].concat(links.map(function (a) { return $(a.getAttribute('href')); })).forEach(function (s) { if (s) spy.observe(s); });
}

// Reveal each block once as it scrolls in.
function reveal() {
  var items = $$('.rv');
  $$('section').forEach(function (s) {
    $$('.rv', s).forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 5)); });
  });
  function show(el) {
    el.classList.add('in');
    if (el.classList.contains('menu') && moving()) el.classList.add('blink');
  }
  if (!('IntersectionObserver' in window)) { items.forEach(show); return; }
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el) { io.observe(el); });
}

// Projects: an accordion, laid out as list plus detail on wide screens.
function saves() {
  var card = $('.card');
  if (!card || !saveEls.length) return;
  card.style.setProperty('--rows', $$('.card-head, .group-label, .save', card).length);
  var items = saveEls.map(function (save, i) {
    var head = $('.save-head', save);
    var body = $('.save-body', save);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-controls', body.id);
    while (head.firstChild) btn.appendChild(head.firstChild);
    var no = document.createElement('span');
    no.className = 'save-no';
    no.setAttribute('aria-hidden', 'true');
    no.innerHTML = '<span class="n">' + pad(i + 1) + '</span><span class="tri"></span>';
    btn.appendChild(no);
    head.appendChild(btn);
    var nav = $('.save-nav', body);
    if (nav) nav.hidden = false;
    return { save: save, head: head, body: body, btn: btn, nav: nav };
  });
  var cur = -1;

  function set(i, open) {
    var it = items[i];
    it.body.hidden = !open;
    it.btn.setAttribute('aria-expanded', String(open));
  }
  function scrollTo(i) {
    (wide.matches ? card : items[i].head).scrollIntoView({ block: 'start', behavior: moving() ? 'smooth' : 'auto' });
  }
  function animate(it) {
    if (!moving()) return;
    var label = $('.block', it.body);
    var text = label && label.textContent;
    it.body.classList.remove('load');
    void it.body.offsetWidth;
    it.body.classList.add('load');
    if (label) {
      label.textContent = 'Loading';
      setTimeout(function () { label.textContent = text; }, 140);
    }
    setTimeout(function () { it.body.classList.remove('load'); }, 260);
  }
  function open(i, user) {
    if (i === cur) {
      if (wide.matches || !user) return;
      set(i, false);
      cur = -1;
      return;
    }
    if (cur > -1) set(cur, false);
    set(i, true);
    cur = i;
    if (!user) return;
    history.replaceState(null, '', '#' + items[i].save.id);
    animate(items[i]);
    if (!wide.matches) {
      var r = items[i].head.getBoundingClientRect();
      var barH = ($('.hud') || { offsetHeight: 0 }).offsetHeight;
      if (r.top < barH || r.top > window.innerHeight) items[i].head.scrollIntoView({ block: 'start' });
    }
  }
  function fromHash(scroll) {
    var id = location.hash.slice(1);
    for (var i = 0; i < items.length; i++) {
      if (items[i].save.id === id) {
        if (i !== cur) open(i, false);
        if (scroll) scrollTo(i);
        return true;
      }
    }
    return false;
  }

  items.forEach(function (it, i) {
    set(i, false);
    it.btn.addEventListener('click', function () { open(i, true); });
    it.btn.addEventListener('keydown', function (e) {
      var to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
      if (to === undefined || to < 0 || to >= items.length) return;
      e.preventDefault();
      items[to].btn.focus();
    });
    if (it.nav) {
      $$('[data-step]', it.nav).forEach(function (b) {
        b.addEventListener('click', function () {
          var step = +b.getAttribute('data-step');
          var to = (i + step + items.length) % items.length;
          open(to, true);
          var same = $('[data-step="' + step + '"]', items[to].nav);
          if (!same) return;
          same.focus({ preventScroll: true });
          if (wide.matches) same.scrollIntoView({ block: 'nearest' });
        });
      });
    }
  });

  if (!fromHash(false)) open(0, false);
  else requestAnimationFrame(function () { scrollTo(cur); });
  window.addEventListener('hashchange', function () { fromHash(true); });
  wide.addEventListener('change', function () { if (wide.matches && cur < 0) open(0, false); });
}

// Make link-based media controls act as buttons, and Space work on them.
function asButton(a, fn) {
  a.setAttribute('role', 'button');
  a.addEventListener('click', function (e) { e.preventDefault(); fn(); });
  a.addEventListener('keydown', function (e) {
    if (e.key === ' ') { e.preventDefault(); fn(); }
  });
}

// Gallery: wide mode swaps the stage from thumbnails; both modes open the lightbox.
var openLightbox = null;
function galleryItems(g) {
  var thumbs = $$('.thumbs a', g);
  if (thumbs.length) {
    return thumbs.map(function (a) {
      var base = a.getAttribute('data-base');
      return {
        href: a.getAttribute('href'),
        srcset: base + '-640.webp 640w, ' + base + '-1280.webp 1280w, ' + base + '-1920.webp 1920w',
        w: +a.getAttribute('data-w'), h: +a.getAttribute('data-h'),
        alt: $('img', a).alt, caption: a.getAttribute('data-caption') || ''
      };
    });
  }
  return $$('.stage, .frame', g).map(function (a) {
    var img = $('img', a);
    return { href: a.getAttribute('href'), srcset: img.getAttribute('srcset') || '', w: +img.getAttribute('width'), h: +img.getAttribute('height'), alt: img.alt, caption: '' };
  });
}
function gallery() {
  $$('.gallery').forEach(function (g) {
    var list = galleryItems(g);
    var title = g.getAttribute('data-title') || '';
    var stage = $('.stage', g);
    var at = 0;
    if (stage) {
      var first = list[0];
      if (first && first.w && first.h) {
        var r = first.w / first.h;
        g.classList.add(r >= 1.6 ? 'r169' : r < 1.15 ? 'sq' : 'r43');
      }
      asButton(stage, function () { if (openLightbox) openLightbox(list, at, title, stage); else location.href = stage.href; });
      $$('.thumbs a', g).forEach(function (a, i) { asButton(a, function () { show(i); }); });
    }
    $$('.frame', g).forEach(function (a, i) {
      if (openLightbox) asButton(a, function () { openLightbox(list, i, title, a); });
    });
    function show(i) {
      at = i;
      var it = list[i];
      var img = $('img', stage);
      img.srcset = it.srcset;
      img.src = it.href.replace(/-1920\.webp$/, '-1280.webp');
      img.alt = it.alt;
      img.width = it.w;
      img.height = it.h;
      img.classList.remove('swap');
      void img.offsetWidth;
      img.classList.add('swap');
      stage.href = it.href;
      var n = $('.stage-hud b', stage);
      if (n) n.textContent = pad(i + 1);
      var cap = $('.caption', g);
      if (cap) cap.textContent = it.caption;
      $$('.thumbs a', g).forEach(function (t, k) { current(t, k === i); });
    }
  });
}

// Lightbox: one native dialog for the whole page.
var ICON_X = '<svg class="icon" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M1 1h2v2h-2zM9 1h2v2h-2zM3 3h2v2h-2zM7 3h2v2h-2zM5 5h2v2h-2zM3 7h2v2h-2zM7 7h2v2h-2zM1 9h2v2h-2zM9 9h2v2h-2z"/></svg>';
function lightbox() {
  if (typeof HTMLDialogElement !== 'function') return;
  var d = document.createElement('dialog');
  d.className = 'lb';
  d.innerHTML = '<button type="button" class="lb-x" aria-label="Close">' + ICON_X + '</button>' +
    '<button type="button" class="lb-prev" aria-label="Previous image"><span class="tri tri-l" aria-hidden="true"></span></button>' +
    '<img alt=""><p class="lb-cap"></p>' +
    '<p class="lb-bar"><span class="lb-title"></span><span class="lb-count" aria-live="polite"></span><span class="lb-esc">Esc close</span></p>' +
    '<button type="button" class="lb-next" aria-label="Next image"><span class="tri" aria-hidden="true"></span></button>';
  document.body.appendChild(d);
  var img = $('img', d), cap = $('.lb-cap', d), count = $('.lb-count', d);
  var prev = $('.lb-prev', d), next = $('.lb-next', d);
  var list = [], at = 0, opener = null;

  function show(i) {
    at = (i + list.length) % list.length;
    var it = list[at];
    var fresh = document.createElement('img');
    fresh.alt = it.alt;
    if (it.w && it.h) { fresh.width = it.w; fresh.height = it.h; }
    var fit = Math.round(Math.min(window.innerWidth * 0.92, it.w && it.h ? window.innerHeight * 0.82 * it.w / it.h : Infinity));
    if (it.srcset) { fresh.srcset = it.srcset; fresh.sizes = fit + 'px'; }
    fresh.src = it.href;
    d.replaceChild(fresh, img);
    img = fresh;
    cap.textContent = it.caption;
    count.textContent = pad(at + 1) + ' / ' + pad(list.length);
  }
  openLightbox = function (items, i, title, from) {
    list = items;
    opener = from;
    d.setAttribute('aria-label', title + ' images');
    $('.lb-title', d).textContent = title;
    prev.hidden = next.hidden = list.length < 2;
    show(i);
    root.style.overflow = 'hidden';
    d.showModal();
    $('.lb-x', d).focus();
  };
  $('.lb-x', d).onclick = function () { d.close(); };
  prev.onclick = function () { show(at - 1); };
  next.onclick = function () { show(at + 1); };
  d.addEventListener('close', function () {
    root.style.overflow = '';
    if (opener) opener.focus();
  });
  d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  d.addEventListener('keydown', function (e) {
    if (list.length < 2) return;
    var to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    show(to);
  });
  var x0 = null;
  d.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
  d.addEventListener('pointerup', function (e) {
    if (x0 === null || list.length < 2) return;
    var dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
  });
}

// Hero object: a wireframe memory card. Turns to rest once, then follows a mouse or pen.
function card3d() {
  var canvas = $('#gem');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var css = getComputedStyle(root);
  var BLUE = css.getPropertyValue('--blue').trim();
  var ORANGE = css.getPropertyValue('--orange').trim();
  var used = Math.min(saveEls.length, 15);

  // Geometry. Card is 5 x 7 x 0.6 units, y up, with the top right corner chamfered.
  var V = [], E = [];
  function v(x, y, z) { V.push([x, y, z]); return V.length - 1; }
  function loop(pts, kind) {
    for (var i = 0; i < pts.length; i++) E.push([pts[i], pts[(i + 1) % pts.length], kind]);
  }
  function rect(x0, y0, x1, y1, kind) { loop([v(x0, y0, 0.3), v(x1, y0, 0.3), v(x1, y1, 0.3), v(x0, y1, 0.3)], kind); }
  var outline = [[-2.5, 3.5], [1.6, 3.5], [2.5, 2.6], [2.5, -3.5], [-2.5, -3.5]];
  var front = outline.map(function (p) { return v(p[0], p[1], 0.3); });
  var back = outline.map(function (p) { return v(p[0], p[1], -0.3); });
  loop(front, 0);
  loop(back, 0);
  front.forEach(function (f, i) { E.push([f, back[i], 0]); });
  rect(-1.9, 2.8, 1.9, 0.56, 0); // label: 10% to 42% of the height, inset 12%
  var s = 0.6, gx = 0.2, gy = (2.66 - 3 * s) / 2;
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 5; c++) {
      var x = -1.9 + c * (s + gx), y = -0.14 - r * (s + gy);
      rect(x, y, x + s, y - s, (r * 5 + c) < used ? 1 : 2);
    }
  }

  var REST_YAW = 28, REST_TILT = 14;
  var yaw = REST_YAW, tilt = REST_TILT, tYaw = REST_YAW, tTilt = REST_TILT;
  var intro = null, build = null, raf = 0, visible = true, size = 0, timer = 0;

  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, wide.matches ? 2 : 1.5);
    size = Math.round(canvas.clientWidth * dpr);
    if (!size) return;
    canvas.width = canvas.height = size;
  }
  function draw(progress) {
    if (!size) return;
    var ay = yaw * Math.PI / 180, at = tilt * Math.PI / 180;
    var cy = Math.cos(ay), sy = Math.sin(ay), ct = Math.cos(at), st = Math.sin(at);
    var k = size / 9.2;
    var P = V.map(function (p) {
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y = p[1] * ct - z * st;
      z = p[1] * st + z * ct;
      var f = 14 / (14 - z);
      return [size / 2 + x * f * k, size / 2 - y * f * k];
    });
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'square';
    var lw = Math.max(1, size / 380);
    var n = progress === undefined ? E.length : Math.floor(E.length * progress);
    for (var pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass ? lw : lw * 5;
      for (var i = 0; i < n; i++) {
        var e = E[i], a = P[e[0]], b = P[e[1]];
        ctx.strokeStyle = e[2] === 1 ? ORANGE : BLUE;
        ctx.globalAlpha = (pass ? 1 : 0.12) * (e[2] === 2 ? 0.35 : 1);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    var busy = false, progress;
    if (build) {
      var t = (now - build) / 500;
      if (t < 0) { progress = 0; busy = true; } else if (t < 1) { progress = t; busy = true; } else build = null;
    }
    if (intro) {
      var u = Math.min(1, (now - intro) / 5000);
      tYaw = REST_YAW - 45 * Math.pow(1 - u, 3);
      yaw = tYaw;
      if (u < 1) busy = true; else { intro = null; tYaw = REST_YAW; }
    } else {
      yaw += (tYaw - yaw) * 0.08;
      tilt += (tTilt - tilt) * 0.08;
      if (Math.abs(tYaw - yaw) > 0.05 || Math.abs(tTilt - tilt) > 0.05) busy = true;
      else { yaw = tYaw; tilt = tTilt; }
    }
    draw(progress);
    if (busy) kick();
  }
  function kick() {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function rest() {
    intro = build = null;
    yaw = tYaw = REST_YAW;
    tilt = tTilt = REST_TILT;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    draw();
  }

  fit();
  if (moving() && root.classList.contains('boot')) {
    var t0 = performance.now();
    build = t0 + Math.max(0, 400 - t0);
    intro = t0;
    yaw = REST_YAW - 45;
    draw(0);
    kick();
  } else {
    draw();
  }

  var hero = $('.hero');
  if (hero) {
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || !moving()) return;
      var r = hero.getBoundingClientRect();
      tYaw = REST_YAW + ((e.clientX - r.left) / r.width - 0.5) * 20;
      tTilt = REST_TILT + ((e.clientY - r.top) / r.height - 0.5) * 20;
      intro = null;
      kick();
    });
    hero.addEventListener('pointerleave', function () {
      if (!moving()) return;
      tYaw = REST_YAW;
      tTilt = REST_TILT;
      kick();
    });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } else kick();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } else kick();
  });
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { fit(); draw(); }, 150);
  });
  function maybeRest() { if (!moving()) rest(); }
  reduce.addEventListener('change', maybeRest);
  document.addEventListener('fxchange', maybeRest);
}

// FX toggle: two buttons, one state.
function fx() {
  var btns = $$('[data-fx-toggle]');
  if (!btns.length) return;
  function paint() {
    var off = fxOff();
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(!off));
      $('.fx-state', b).textContent = off ? 'off' : 'on';
    });
  }
  btns.forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var off = !fxOff();
      if (off) root.setAttribute('data-fx', 'off'); else root.removeAttribute('data-fx');
      store('localStorage', 'fx', off ? 'off' : null);
      paint();
      document.dispatchEvent(new CustomEvent('fxchange'));
    });
  });
  paint();
}

// Contact: arrow keys between the links, and a copy button for the email.
function contact() {
  var menu = $('.menu');
  if (!menu) return;
  var links = $$('a', menu);
  links.forEach(function (a, i) {
    a.addEventListener('keydown', function (e) {
      var to = { ArrowDown: i + 1, ArrowUp: i - 1 }[e.key];
      if (to === undefined || to < 0 || to >= links.length) return;
      e.preventDefault();
      links[to].focus();
    });
  });
  var copy = $('.copy', menu);
  if (!copy || !navigator.clipboard) return;
  var live = copy.nextElementSibling;
  copy.hidden = false;
  copy.addEventListener('click', function () {
    navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(function () {
      copy.textContent = 'Copied';
      if (live) live.textContent = 'Email address copied';
      setTimeout(function () {
        copy.textContent = 'Copy';
        if (live) live.textContent = '';
      }, 2000);
    }, function () {});
  });
}

function year() {
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
}

[boot, hud, reveal, lightbox, saves, gallery, card3d, fx, contact, year].forEach(function (fn) {
  try { fn(); } catch (e) { console.error(e); }
});
})();
