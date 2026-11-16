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

// Counts are written from the page itself: the top bar counts sections, the Projects meter counts saves.
var saveEls = $$('.save');
var sectionCount = $$('main > section').length;
$$('[data-count]').forEach(function (el) { el.textContent = el.getAttribute('data-count') === 'sections' ? sectionCount : saveEls.length; });
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

// HUD: solid bar once the hero is gone, scroll spy, and pausing the hero kit's float off screen.
function hud() {
  var bar = $('.hud');
  var hero = $('.hero');
  var kitEl = $('.q3');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (en) {
    bar.classList.toggle('solid', !en[0].isIntersecting);
    if (kitEl) kitEl.classList.toggle('off', !en[0].isIntersecting);
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

// Hero kit: the headset and controllers are inline SVG and need no script.
// This only feeds the pointer position to the CSS parallax, on wide screens with a mouse or pen.
function kit() {
  var q = $('.q3');
  var hero = $('.hero');
  if (!q || !hero) return;
  var raf = 0, cx = 0, cy = 0;
  function frame() {
    raf = 0;
    var r = hero.getBoundingClientRect();
    q.style.setProperty('--px', Math.max(-1, Math.min(1, (cx - r.left) / r.width * 2 - 1)).toFixed(3));
    q.style.setProperty('--py', Math.max(-1, Math.min(1, (cy - r.top) / r.height * 2 - 1)).toFixed(3));
  }
  function rest() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    q.style.removeProperty('--px');
    q.style.removeProperty('--py');
  }
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' || !wide.matches || !moving()) return;
    cx = e.clientX;
    cy = e.clientY;
    q.classList.remove('back');
    if (!raf) raf = requestAnimationFrame(frame);
  });
  hero.addEventListener('pointerleave', function () { q.classList.add('back'); rest(); });
  reduce.addEventListener('change', rest);
  wide.addEventListener('change', rest);
  document.addEventListener('fxchange', rest);
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

[boot, hud, reveal, lightbox, saves, gallery, kit, fx, contact, year].forEach(function (fn) {
  try { fn(); } catch (e) { console.error(e); }
});
})();
