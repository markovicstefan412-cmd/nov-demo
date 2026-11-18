/* NOV, Not Ordinary Vision: site behavior (vanilla, no globals).
   Ported from reference/Main.dc.html. Sections:
   1. data + state   2. helpers   3. nav (flyouts, phone menu)   4. hero scroll scrub
   5. shop + order drawer   6. FAQ   7. autoplay videos   8. init */
(function () {
  'use strict';

  /* ---------- 1. data + state ---------- */
  var IMG = 'assets/img/';
  var SCRUB_SRC = 'assets/video/hero-scrub.mp4';
  var STORE_KEY = 'nov-cart-v1';

  var ROUND = {
    white: { name: 'Bela', img: IMG + 'round-white.jpg' },
    pink: { name: 'Roze', img: IMG + 'round-pink.jpg' },
    yellow: { name: 'Limun', img: IMG + 'round-yellow.jpg' },
    blue: { name: 'Nebo', img: IMG + 'round-blue.jpg' }
  };
  var CAT = {
    classic: { name: 'NOV Classic', color: 'Crna', img: IMG + 'classic.jpg' },
    round: { name: 'NOV Round', color: '', img: '' },
    clear: { name: 'NOV Clear', color: 'Bela', img: IMG + 'clear.jpg' }
  };

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var state = {
    menu: false,
    fly: '',
    drawer: false,
    copied: false,
    round: 'white',
    faq: -1,
    cart: []
  };

  /* ---------- 2. helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function setAttr(el, name, val) {
    if (el && el.getAttribute(name) !== val) el.setAttribute(name, val);
  }
  function setHidden(el, hide) {
    if (el && el.hidden !== hide) el.hidden = hide;
  }
  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }
  function mk(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  }
  // Serbian plural: 1, 21, 31 artikal; 2-4 (not 12-14) artikla; others artikala
  function countWord(n) {
    var a = n % 10;
    var b = n % 100;
    if (a === 1 && b !== 11) return 'artikal';
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'artikla';
    return 'artikala';
  }

  var root = document.getElementById('top');
  var html = document.documentElement;
  var live = $('[data-live]');
  var liveT = null;
  function announce(msg) {
    if (!live) return;
    clearTimeout(liveT);
    live.textContent = '';
    liveT = setTimeout(function () { live.textContent = msg; }, 60);
  }

  function lockScroll() {
    html.classList.toggle('n-lock', state.menu || state.drawer);
  }

  /* ---------- 3. nav: flyouts + phone menu ---------- */
  var header = $('.n-nav');
  var curtain = $('.n-curtain');
  var mmenu = $('.n-mmenu');
  var menuBtn = $('[data-menu-toggle]');
  var flyLinks = $$('[data-fly-open]');
  var flyPanels = $$('.n-fly');

  function renderNav() {
    setAttr(header, 'data-fly', state.fly || 'none');
    setAttr(header, 'data-menu', state.menu ? 'true' : 'false');
    setAttr(curtain, 'data-on', state.fly ? 'true' : 'false');
    setAttr(menuBtn, 'aria-expanded', state.menu ? 'true' : 'false');
    setHidden(mmenu, !state.menu);
    flyLinks.forEach(function (a) {
      setAttr(a, 'aria-expanded', state.fly === a.getAttribute('data-fly-open') ? 'true' : 'false');
    });
    // closed flyouts are collapsed to 0 height but still in the DOM: keep their links out of the tab order
    flyPanels.forEach(function (p) {
      var open = state.fly === p.getAttribute('data-id');
      if (open) p.removeAttribute('inert');
      else if (!p.hasAttribute('inert')) p.setAttribute('inert', '');
    });
    lockScroll();
  }

  // how the open flyout was opened: a keyboard-opened panel must not close just because the
  // panel's own opening animation slides the page curtain under a resting mouse pointer
  var flyBy = '';

  function openFly(id, by) {
    flyBy = by || 'mouse';
    if (state.fly === id) return;
    state.fly = id;
    renderNav();
  }
  function closeFly() {
    if (!state.fly) return;
    state.fly = '';
    renderNav();
  }
  function closeFlyByPointer() {
    if (flyBy === 'mouse') closeFly();
  }
  function closeAll() {
    if (!state.menu && !state.fly) return;
    state.menu = false;
    state.fly = '';
    renderNav();
  }
  function toggleMenu() {
    state.menu = !state.menu;
    state.fly = '';
    renderNav();
  }

  function initNav() {
    flyLinks.forEach(function (a) {
      var id = a.getAttribute('data-fly-open');
      a.addEventListener('mouseenter', function () { openFly(id, 'mouse'); });
      a.addEventListener('focus', function () { if (state.fly !== id) openFly(id, 'focus'); });
    });
    $$('[data-fly-close]').forEach(function (el) {
      el.addEventListener('mouseenter', closeFly);
      el.addEventListener('focusin', closeFly);
    });
    $$('[data-close-all]').forEach(function (el) {
      el.addEventListener('click', closeAll);
    });
    header.addEventListener('mouseleave', closeFlyByPointer);
    header.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !header.contains(e.relatedTarget)) closeFly();
    });
    curtain.addEventListener('mouseenter', closeFlyByPointer);
    curtain.addEventListener('click', closeFly);
    menuBtn.addEventListener('click', toggleMenu);

    // the phone menu belongs to phones only: close it once the desktop nav takes over
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 834px)');
      var onMq = function () { if (mq.matches && state.menu) { state.menu = false; renderNav(); } };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
    renderNav();
  }

  /* ---------- 4. hero: the glasses turn while you scroll ---------- */
  var hero = $('.n-hero');
  var track = $('[data-track]');
  var pin = $('[data-pin]');
  var copy = $('[data-copy]');
  var video = $('[data-scrub]');
  var still = $('[data-still]');

  var scrub = {
    on: false,
    target: 0,
    shown: 0,
    raf: null,
    last: 0,
    busy: false,
    busyAt: 0,
    pending: null,
    clipX: -1,
    blobUrl: null
  };

  function maxT() {
    return video && video.duration ? Math.max(0, video.duration - 0.05) : 0;
  }

  // 0..1 progress through the track, measured from where the glasses pin
  function progress() {
    if (!track || !pin) return 0;
    var r = track.getBoundingClientRect();
    var pinTop = parseFloat(window.getComputedStyle(pin).top) || 48;
    var range = (r.height - pin.offsetHeight) * 0.85;
    if (range <= 0) return 0;
    return clamp((pinTop - r.top) / range, 0, 1);
  }

  // Phones and tablets: the text scrolls up behind the pinned glasses.
  // Cut it off at the bottom edge of the glasses so it never shows above them.
  function clipCopy() {
    if (!copy || !pin) return;
    var pr = pin.getBoundingClientRect();
    var cr = copy.getBoundingClientRect();
    var stacked = pr.left < cr.right && pr.right > cr.left;
    var x = stacked ? Math.max(0, Math.round(pr.bottom - cr.top)) : 0;
    if (x !== scrub.clipX) {
      scrub.clipX = x;
      var v = x ? 'inset(' + x + 'px 0 0 0)' : '';
      copy.style.clipPath = v;
      copy.style.webkitClipPath = v;
    }
  }

  // never overlap seeks: keep only the newest pending time and issue it on 'seeked'
  function seek(t) {
    if (!video || !video.duration) return;
    if (scrub.busy) {
      // safety valve: a seek that never reports back must not freeze the hero
      if (performance.now() - scrub.busyAt < 600) { scrub.pending = t; return; }
      scrub.busy = false;
    }
    if (Math.abs(video.currentTime - t) < 0.01) return;
    scrub.busy = true;
    scrub.busyAt = performance.now();
    video.currentTime = t;
  }

  function tick(now) {
    var dt = Math.min(100, now - (scrub.last || now));
    scrub.last = now;
    scrub.shown += (scrub.target - scrub.shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    if (Math.abs(scrub.target - scrub.shown) < 0.0005) {
      scrub.shown = scrub.target;
      scrub.raf = null;
    } else {
      scrub.raf = requestAnimationFrame(tick);
    }
    var d = maxT();
    if (d) seek(scrub.shown * d);
  }

  function kick() {
    if (scrub.raf === null) {
      scrub.last = 0;
      scrub.raf = requestAnimationFrame(tick);
    }
  }

  function onScroll() {
    clipCopy();
    if (!scrub.on) return;
    scrub.target = progress();
    kick();
  }

  function attachScrub() {
    scrub.on = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.addEventListener('seeked', function () {
      scrub.busy = false;
      if (scrub.pending !== null) {
        var t = scrub.pending;
        scrub.pending = null;
        seek(t);
      }
    });
    video.addEventListener('error', function () {
      scrub.busy = false;
      scrub.pending = null;
    });
    video.addEventListener('loadedmetadata', function () {
      // iOS only paints seeked frames after one play(): start and stop right away
      var p = video.play && video.play();
      var settle = function () {
        try { video.pause(); } catch (e) { /* ignore */ }
        scrub.target = progress();
        scrub.shown = scrub.target;
        scrub.busy = false;
        seek(scrub.shown * maxT());
        kick();
      };
      if (p && p.then) p.then(settle, settle);
      else settle();
    }, { once: true });

    // Blob load: works even on hosts without HTTP Range support. Plain URL as fallback.
    var useUrl = function () { video.src = SCRUB_SRC; video.load(); };
    if (!window.fetch || !window.URL || !URL.createObjectURL) { useUrl(); return; }
    fetch(SCRUB_SRC, { priority: 'low' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (b) {
        scrub.blobUrl = URL.createObjectURL(b);
        video.src = scrub.blobUrl;
        video.load();
      })
      .catch(useUrl);
  }

  function initHero() {
    if (!hero || !video) return;
    if (reduce) {
      hero.setAttribute('data-mode', 'still');
      video.hidden = true;
      video.removeAttribute('poster');
      if (still) still.hidden = false;
    } else {
      attachScrub();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 5. shop + order drawer ---------- */
  var badge = $('[data-badge]');
  var bagBtn = $('[data-bag]');
  var bar = $('[data-bar]');
  var barLabel = $('[data-bar-label]');
  var toast = $('[data-toast]');
  var toastText = $('[data-toast-text]');
  var drawerWrap = $('[data-drawer-wrap]');
  var drawer = $('[data-drawer]');
  var drawerClose = $('[data-drawer-close]');
  var emptyBox = $('[data-empty]');
  var linesBox = $('[data-lines]');
  var dfoot = $('[data-dfoot]');
  var msgBox = $('[data-msg]');
  var copiedBox = $('[data-copied]');
  var sendBtn = $('[data-send]');
  var roundImg = $('[data-round-img]');
  var roundLabel = $('[data-round-color]');
  var swatches = $$('[data-round]');
  var toastT = null;
  var lastFocus = null;
  var linesSig = '';

  function itemFor(id, color, qty) {
    var base = CAT[id];
    if (!base) return null;
    var img = base.img;
    if (id === 'round') {
      var k = Object.keys(ROUND).filter(function (r) { return ROUND[r].name === color; })[0];
      if (!k) return null;
      img = ROUND[k].img;
    } else if (color !== base.color) {
      return null;
    }
    return { key: id + ':' + color, id: id, name: base.name, color: color, img: img, qty: qty };
  }

  function loadCart() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      var out = [];
      list.forEach(function (x) {
        if (!x || typeof x !== 'object') return;
        var q = Math.floor(Number(x.qty));
        if (!(q >= 1 && q <= 99)) return;
        var it = itemFor(String(x.id), String(x.color), q);
        if (it && !out.some(function (o) { return o.key === it.key; })) out.push(it);
      });
      return out;
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state.cart.map(function (x) {
        return { id: x.id, color: x.color, qty: x.qty };
      })));
    } catch (e) { /* private mode or storage blocked: the cart still works for this visit */ }
  }

  function cartCount() {
    return state.cart.reduce(function (a, x) { return a + x.qty; }, 0);
  }

  function message() {
    var lines = state.cart.map(function (x) { return '- ' + x.name + ', ' + x.color + ', kom: ' + x.qty; });
    return 'Zdravo NOV! Želim da poručim:\n' + lines.join('\n') + '\n\nIme i prezime:\nAdresa i grad:\nTelefon:';
  }

  function buildLine(item) {
    var row = mk('div', 'n-line');
    row.setAttribute('data-key', item.key);

    var img = mk('img');
    img.src = item.img;
    img.alt = '';
    img.width = 72;
    img.height = 72;
    img.decoding = 'async';

    var mid = mk('div');
    mid.appendChild(mk('p', 'n-line-name', item.name));
    mid.appendChild(mk('p', 'n-line-meta', item.color));
    var rm = mk('button', 'n-line-rm', 'Ukloni');
    rm.type = 'button';
    rm.setAttribute('data-act', 'rm');
    mid.appendChild(rm);

    var qty = mk('div', 'n-qty');
    var dec = mk('button');
    dec.type = 'button';
    dec.setAttribute('aria-label', 'Smanji količinu');
    dec.setAttribute('data-act', 'dec');
    dec.innerHTML = '<svg class="i" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';
    var num = mk('span', null, String(item.qty));
    var inc = mk('button');
    inc.type = 'button';
    inc.setAttribute('aria-label', 'Povećaj količinu');
    inc.setAttribute('data-act', 'inc');
    inc.innerHTML = '<svg class="i" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
    qty.appendChild(dec);
    qty.appendChild(num);
    qty.appendChild(inc);

    row.appendChild(img);
    row.appendChild(mid);
    row.appendChild(qty);
    return row;
  }

  function renderLines() {
    var sig = state.cart.map(function (x) { return x.key + '*' + x.qty; }).join('|');
    if (sig === linesSig) return;
    linesSig = sig;

    // remember which control had focus so re-rendering never drops keyboard users
    var act = document.activeElement;
    var keep = null;
    if (act && linesBox.contains(act)) {
      var r = act.closest('.n-line');
      var keys = $$('.n-line', linesBox).map(function (n) { return n.getAttribute('data-key'); });
      keep = { key: r && r.getAttribute('data-key'), act: act.getAttribute('data-act'), idx: keys.indexOf(r && r.getAttribute('data-key')) };
    }

    var frag = document.createDocumentFragment();
    state.cart.forEach(function (it) { frag.appendChild(buildLine(it)); });
    linesBox.textContent = '';
    linesBox.appendChild(frag);

    if (keep) {
      var rows = $$('.n-line', linesBox);
      var same = rows.filter(function (n) { return n.getAttribute('data-key') === keep.key; })[0];
      var target = same && $('[data-act="' + keep.act + '"]', same);
      if (!target && rows.length) {
        var next = rows[Math.min(keep.idx, rows.length - 1)];
        target = next && $('[data-act="rm"]', next);
      }
      (target || drawerClose).focus();
    }
  }

  function renderCart() {
    var count = cartCount();
    var has = count > 0;

    setHidden(badge, !has);
    setText(badge, String(count));
    setAttr(bagBtn, 'aria-label', has ? 'Porudžbina, ' + count + ' ' + countWord(count) : 'Porudžbina');

    var showBar = has && !state.drawer;
    setHidden(bar, !showBar);
    setAttr(root, 'data-has-bar', showBar ? 'true' : 'false');
    setText(barLabel, count + ' ' + countWord(count) + ' u porudžbini');

    setHidden(emptyBox, has);
    setHidden(dfoot, !has);
    setText(msgBox, has ? message() : '');
    setHidden(copiedBox, !state.copied);
    renderLines();
  }

  function setCart(cart) {
    state.cart = cart;
    state.copied = false;
    saveCart();
    renderCart();
  }

  function showToast(msg) {
    clearTimeout(toastT);
    setText(toastText, msg);
    // restart the CSS animation: hide, force a style flush, show again
    toast.hidden = true;
    void toast.offsetWidth;
    toast.hidden = false;
    toastT = setTimeout(function () { toast.hidden = true; }, 2300);
    announce(msg);
  }

  function add(id) {
    var base = CAT[id];
    if (!base) return;
    var color = id === 'round' ? ROUND[state.round].name : base.color;
    var item = itemFor(id, color, 1);
    var cart = state.cart.slice();
    var i = -1;
    cart.forEach(function (x, n) { if (x.key === item.key) i = n; });
    if (i >= 0) cart[i] = Object.assign({}, cart[i], { qty: Math.min(99, cart[i].qty + 1) });
    else cart.push(item);
    setCart(cart);
    showToast(base.name + (id === 'round' ? ', ' + color : '') + ' je u porudžbini');
  }

  function changeQty(key, d) {
    setCart(state.cart
      .map(function (x) { return x.key === key ? Object.assign({}, x, { qty: clamp(x.qty + d, 0, 99) }) : x; })
      .filter(function (x) { return x.qty > 0; }));
  }

  function removeLine(key) {
    setCart(state.cart.filter(function (x) { return x.key !== key; }));
  }

  function focusables() {
    return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer)
      .filter(function (el) { return !el.closest('[hidden]') && el.offsetParent !== null; });
  }

  function openCart() {
    if (state.drawer) return;
    lastFocus = document.activeElement;
    state.drawer = true;
    state.menu = false;
    state.fly = '';
    renderNav();
    setHidden(drawerWrap, false);
    renderCart();
    lockScroll();
    drawerClose.focus({ preventScroll: true });
  }

  function closeCart() {
    if (!state.drawer) return;
    state.drawer = false;
    setHidden(drawerWrap, true);
    renderCart();
    lockScroll();
    var back = lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null ? lastFocus : bagBtn;
    try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    lastFocus = null;
  }

  function copyText(text) {
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      if (sendBtn) sendBtn.focus({ preventScroll: true });
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(fallback);
        return;
      }
    } catch (e) { /* fall through */ }
    fallback();
  }

  function sendOrder() {
    // Instagram cannot prefill DM text, so the order is copied and the link opens the chat
    copyText(message());
    state.copied = true;
    renderCart();
    announce('Porudžbina je kopirana. Nalepi je u poruku i pošalji.');
  }

  function renderRound() {
    var r = ROUND[state.round] || ROUND.white;
    if (roundImg.getAttribute('src') !== r.img) roundImg.src = r.img;
    setAttr(roundImg, 'alt', 'NOV Round, ram u boji ' + r.name);
    setText(roundLabel, 'Boja: ' + r.name);
    swatches.forEach(function (b) {
      setAttr(b, 'aria-pressed', b.getAttribute('data-round') === state.round ? 'true' : 'false');
    });
  }

  function initShop() {
    state.cart = loadCart();

    $$('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () { add(b.getAttribute('data-add')); });
    });

    // warm the other Round colors so the swap is instant
    var warmed = false;
    var warm = function () {
      if (warmed) return;
      warmed = true;
      Object.keys(ROUND).forEach(function (k) { var i = new Image(); i.src = ROUND[k].img; });
    };
    var group = swatches[0] && swatches[0].parentNode;
    if (group) {
      group.addEventListener('pointerenter', warm);
      group.addEventListener('focusin', warm);
      group.addEventListener('touchstart', warm, { passive: true });
    }
    swatches.forEach(function (b) {
      b.addEventListener('click', function () {
        state.round = b.getAttribute('data-round');
        renderRound();
      });
    });

    $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', openCart); });
    $$('[data-close-cart]').forEach(function (b) { b.addEventListener('click', closeCart); });

    linesBox.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var row = btn.closest('.n-line');
      var key = row && row.getAttribute('data-key');
      if (!key) return;
      var a = btn.getAttribute('data-act');
      if (a === 'inc') changeQty(key, 1);
      else if (a === 'dec') changeQty(key, -1);
      else if (a === 'rm') removeLine(key);
    });

    sendBtn.addEventListener('click', sendOrder);

    // keep Tab inside the open drawer
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // another tab changed the order: follow it
    window.addEventListener('storage', function (e) {
      if (e.key === STORE_KEY) { state.cart = loadCart(); state.copied = false; renderCart(); }
    });

    renderRound();
    renderCart();
  }

  /* ---------- 6. FAQ: one open at a time ---------- */
  var faqItems = $$('.n-q');

  function renderFaq() {
    faqItems.forEach(function (q, i) {
      var open = state.faq === i;
      setAttr(q, 'data-open', open ? 'true' : 'false');
      setAttr($('button', q), 'aria-expanded', open ? 'true' : 'false');
      setHidden($('.n-a', q), !open);
    });
  }

  function initFaq() {
    faqItems.forEach(function (q, i) {
      $('button', q).addEventListener('click', function () {
        state.faq = state.faq === i ? -1 : i;
        renderFaq();
      });
    });
    renderFaq();
  }

  /* ---------- 7. autoplay videos: only while on screen ---------- */
  function initAutoplay() {
    $$('[data-autoplay]').forEach(function (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.loop = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      if (reduce) return;
      var go = function () { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) go(); else v.pause(); });
        }, { threshold: 0.12 }).observe(v);
      } else {
        go();
      }
    });
  }

  /* ---------- 8. init ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (state.drawer) { closeCart(); return; }
    if (state.menu) { state.menu = false; renderNav(); menuBtn.focus(); return; }
    if (state.fly) closeFly();
  });

  // reveal on scroll: nov.css fades .n-rv in with scroll-driven animations where supported
  if (!reduce) root.classList.add('n-anim');

  initNav();
  initHero();
  initShop();
  initFaq();
  initAutoplay();
})();
