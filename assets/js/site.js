/* =========================================================================
   Vinay Swaminathan — site behaviour
   Every page reads fully without this file. It adds, in order:
     0. shared helpers (one scroll and one resize listener, frame timing, hash lookup)
     1. background textures, loaded as their fields approach (.assets-ready)
     2. header: phone menu, scrolled glass, the homepage sigil flight
     3. accordions: animated <details>, one-open groups, desktop-static
     4. reveal: the one entrance system, photographs, the Approach graphics
     5. section strip (scroll-spy)
     6. FACE (Approach)
     7. forms: field helpers and Web3Forms submission
     8. the Get in touch chooser, then the next-section button
     9. hash landing
   ========================================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  window.__siteJs = true;                 // tells the inline head script we arrived
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
     0. Shared helpers
     --------------------------------------------------------------------- */
  // Calls cb once the image is loaded and decoded (immediately if cached).
  // A generous cap means a very slow network still never leaves a photo
  // hidden, without revealing half-loaded photos on ordinary connections.
  function whenReady(img, cb, cap) {
    var done = false;
    var go = function () { if (!done) { done = true; cb(); } };
    if (!img) return go();
    var decode = function () {
      if (img.decode) img.decode().then(go, go); else go();
    };
    if (img.complete && img.naturalWidth) decode();
    else {
      img.addEventListener('load', decode, { once: true });
      img.addEventListener('error', go, { once: true });
    }
    setTimeout(go, cap || 8000);
  }

  // One scroll listener for the page: every scroll-driven update runs once
  // per frame, together (header glass, homepage sigil, section strip, next-
  // section button, reveal catch-up).
  var scrollJobs = [], scrollQueued = false;
  var onScroll = function (fn) { scrollJobs.push(fn); };
  window.addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(function () {
      scrollQueued = false;
      scrollJobs.forEach(function (fn) { fn(); });
    });
  }, { passive: true });
  // One resize listener, the same way: every size-driven re-measure runs
  // once per frame, together.
  var resizeJobs = [], resizeQueued = false;
  var onResize = function (fn) { resizeJobs.push(fn); };
  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(function () {
      resizeQueued = false;
      resizeJobs.forEach(function (fn) { fn(); });
    });
  }, { passive: true });
  // Two frames later: after the browser has laid out and painted a change.
  var afterTwoFrames = function (fn) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(fn); });
  };
  // The element the URL's #hash names, if any.
  var hashTarget = function () {
    if (!location.hash) return null;
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return null; }
  };
  // The line just below the fixed header (and, on narrow screens, the
  // section strip): where a section counts as reached. It only changes with
  // the layout, so it is measured then, never per scroll frame.
  var stickyH = 0;
  var measureSticky = function () {
    var head = document.getElementById('site-head');
    stickyH = (head ? head.offsetHeight : 0) + (parseFloat(getComputedStyle(document.body).getPropertyValue('--subnav-h')) || 0);
  };
  var stickyLine = function () { return stickyH; };
  measureSticky();
  onResize(measureSticky);
  window.addEventListener('load', measureSticky);

  /* ---------------------------------------------------------------------
     1. Background textures — this page's only, each loaded as its field
         comes within about a screen of view (the fields on the first screen
         at once), at most two at a time, nearest first, and fully decoded
         before it is shown. Until then a field shows its own calm base tone
         (the CSS cover), which fades to reveal the texture: nothing ever
         appears abruptly and nothing is fetched that the visit never reaches.
         .assets-ready follows the first screen's textures and the web fonts,
         capped at 1.3s. On Save-Data or 2G, only the first screen gets its
         textures; the rest stay plain (and light).
     --------------------------------------------------------------------- */
  var conn = navigator.connection || {};
  var lite = !!(conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''));
  var sheetEl = document.querySelector('link[rel="stylesheet"][href*="site.css"]');
  var cssBase = sheetEl ? sheetEl.href : location.href;
  var urlsIn = function (text, into) {   // custom properties keep stylesheet-relative URLs
    (text || '').replace(/url\(["']?([^"')]+)["']?\)/g, function (m, u) { u = new URL(u, cssBase).href; if (into.indexOf(u) < 0) into.push(u); return m; });
    return into;
  };
  var decodedCache = {};
  var decoded = function (u) {
    if (!decodedCache[u]) decodedCache[u] = new Promise(function (ok) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { if (im.decode) im.decode().then(ok, ok); else ok(); };
      im.onerror = ok;
      im.src = u;
    });
    return decodedCache[u];
  };
  var fields = Array.prototype.slice.call(document.querySelectorAll('.bg-1, .bg-2, .bg-3, .bg-4'));
  var ownOf = function (el) {
    var list = urlsIn(getComputedStyle(el).getPropertyValue('--img'), []);
    Array.prototype.forEach.call(el.querySelectorAll('.areas'), function (n) { urlsIn(getComputedStyle(n).getPropertyValue('--areas-img'), list); });
    return list;
  };
  var artOf = function (el) {
    var list = [];
    [['::before', '--t-in'], ['::after', '--t-out']].forEach(function (pv) {
      var cs = getComputedStyle(el, pv[0]);
      if (cs.content !== 'none') urlsIn(cs.getPropertyValue(pv[1]), list);
    });
    return list;
  };
  var jobs = [], active = 0;
  var pump = function () {
    while (active < 2 && jobs.length) {
      var job = jobs.shift();
      active++;
      Promise.all(job.urls.map(decoded)).then((function (job) {
        return function () {
          active--;
          window.requestAnimationFrame(job.done);   // shown on a fresh frame, decoded
          pump();
        };
      })(job));
    }
  };
  var want = function (urls, done, urgent) {
    if (!urls.length) { done(); return; }
    jobs[urgent ? 'unshift' : 'push']({ urls: urls, done: done });
    pump();
  };
  var started = [];
  var loadField = function (el, urgent) {
    if (started.indexOf(el) > -1) return Promise.resolve();
    started.push(el);
    return new Promise(function (shown) {
      want(ownOf(el), function () {
        el.classList.add('bg-on'); shown();
        if (!lite) want(artOf(el), function () { el.classList.add('bgt-on'); }, urgent);
      }, urgent);
    });
  };
  var onScreen = function (el) { var r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; };
  var firstScreen = fields.filter(onScreen);
  if (lite) fields.forEach(function (el) { if (firstScreen.indexOf(el) < 0) el.classList.add('bg-lite'); });
  var assetsReady = new Promise(function (resolve) {
    var done = false;
    var finish = function () { if (done) return; done = true; root.classList.add('assets-ready'); resolve(); };
    setTimeout(finish, 1300);
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all(firstScreen.map(function (el) { return loadField(el, true); }).concat(fonts)).then(finish);
  });
  // The rest as they approach: about a screen ahead or behind, half a
  // screen on a slow (3G) connection so a short visit fetches less.
  var ahead = /3g$/.test(conn.effectiveType || '') ? '50% 0px 50% 0px' : '100% 0px 100% 0px';
  if (!lite) {
    if ('IntersectionObserver' in window) {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          fio.unobserve(e.target);
          assetsReady.then(function () { loadField(e.target, onScreen(e.target)); });
        });
      }, { rootMargin: ahead });
      fields.forEach(function (el) { if (firstScreen.indexOf(el) < 0) fio.observe(el); });
    } else {
      assetsReady.then(function () { fields.forEach(function (el) { loadField(el, false); }); });
    }
  }

  /* ---------------------------------------------------------------------
     2. Header — the phone menu (open, close, outside tap, Escape), the
        glass that arrives once the page scrolls, and the homepage sigil's
        flight into the header.
     --------------------------------------------------------------------- */
  var toggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('nav-mobile');
  if (toggle && mobileNav) {
    var setNav = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('[data-label]').textContent = open ? 'Close' : 'Menu';
      mobileNav.classList.toggle('is-open', open);
      root.classList.toggle('nav-is-open', open);
    };
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    var closeNav = function (returnFocus) {
      setNav(false);
      if (returnFocus) toggle.focus();
    };
    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav(false);
    });
    // A tap anywhere outside the open panel (and its toggle) closes it, and
    // that tap stops there: it never also follows a link underneath. One
    // listener for the life of the page; it does nothing while closed.
    // The close waits for the touch to resolve (finger lifted, or the
    // gesture becoming a scroll), then fades softly: closing on touch-down,
    // while the phone is still deciding tap-or-scroll, made it snap shut.
    var swallowUntil = 0, outside = false, softTimer = null;
    var closeSoftly = function () {
      outside = false;
      if (!mobileNav.classList.contains('is-open')) return;
      clearTimeout(softTimer);
      mobileNav.classList.add('is-soft');
      closeNav(false);
      softTimer = setTimeout(function () { mobileNav.classList.remove('is-soft'); }, 480);
    };
    document.addEventListener('pointerdown', function (e) {
      outside = mobileNav.classList.contains('is-open') && !mobileNav.contains(e.target) && !toggle.contains(e.target);
      if (outside) swallowUntil = Date.now() + 1500;   // this tap never also follows a link underneath
    }, true);
    document.addEventListener('pointerup', function () {
      if (!outside) return;
      swallowUntil = Date.now() + 600;
      closeSoftly();
    }, true);
    document.addEventListener('pointercancel', function () { if (outside) closeSoftly(); }, true);
    document.addEventListener('click', function (e) {
      if (Date.now() < swallowUntil) { swallowUntil = 0; e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) closeNav(true);
    });
  }

  // Header: transparent at the top of the page; the translucent navy glass
  // arrives once the page has scrolled a few pixels.
  var siteHead = document.getElementById('site-head');
  if (siteHead) {
    var markScrolled = function () { siteHead.classList.toggle('is-scrolled', window.scrollY > 12); };
    onScroll(markScrolled);
    window.addEventListener('pageshow', markScrolled);   // restored scroll positions
    markScrolled();
  }

  // Homepage: the moment the visitor scrolls down from the top, the hero
  // sigil flies up into the header and "Vinay Swaminathan" slides right to
  // make room, so the docked header matches every other page:
  // [sigil] Vinay Swaminathan. Back at the very top it flies home and the
  // name slides back. One fixed-length animation, identical however fast the
  // scroll. A fixed-position clone does the flying (transform + opacity
  // only); geometry is measured on load/resize, never per frame.
  var heroSig = document.querySelector('.page-home .home-hero__sigil');
  var brandImg = document.querySelector('.page-home .brand img');
  var brandName = document.querySelector('.page-home .brand__name');
  if (heroSig && brandImg && brandName) {
    var DUR = 650, EASE = 'cubic-bezier(.45, 0, .2, 1)', SHIFT = 40;
    var sigWrap = heroSig.parentNode;
    var sFly = heroSig.cloneNode(false);
    sFly.removeAttribute('fetchpriority');
    sFly.className = 'home-hero__sigil sigil-flight';
    sFly.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sFly);
    var geo = null, docked = false, anims = [], token = 0, handing = false, leaving = false, pendingFly = null;
    var flight = null;                                // { home: bool, t0 } while a flight runs
    // Only the visitor's own scrolling flies the sigil. Scrolls before the
    // first touch, wheel, key or click are the browser placing the page
    // (in-app browsers such as Instagram's adjust scroll and viewport while
    // loading): the header simply settles, nothing flies.
    var touched = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
      window.addEventListener(ev, function () { touched = true; }, { once: true, passive: true, capture: true });
    });
    var past = function () { return window.scrollY > 2; };
    var X = function (on) { return on ? 'translateX(' + SHIFT + 'px)' : 'translateX(0px)'; };
    var measure = function () {
      if (anims.length) return;                       // never re-measure mid-flight
      var y = window.scrollY, sr = heroSig.getBoundingClientRect(), tr = brandImg.getBoundingClientRect();
      if (!sr.width || !tr.width) return;
      geo = { x: sr.left, y: sr.top + y, k: tr.width / sr.width, tx: tr.left, ty: tr.top };
      sFly.style.width = sr.width + 'px'; sFly.style.height = sr.height + 'px';
      if (pendingFly !== null) { var d = pendingFly; pendingFly = null; fly(d); }
    };
    var at = function (home) {
      return home ? 'translate3d(' + geo.x + 'px,' + (geo.y - window.scrollY) + 'px,0) scale(1)'
                  : 'translate3d(' + geo.tx + 'px,' + geo.ty + 'px,0) scale(' + geo.k + ')';
    };
    var cancelAll = function () {
      anims.forEach(function (an) { an.cancel(); }); anims = [];
      [sFly, brandName].forEach(function (el) { if (el.getAnimations) el.getAnimations().forEach(function (an) { an.cancel(); }); });
    };
    var rest = function (d) {                       // the settled state, no clone
      sFly.style.opacity = '0';
      heroSig.style.opacity = d ? '0' : '';
      sigWrap.style.setProperty('--glow-o', d ? '0' : '1');
      brandImg.style.opacity = d ? '1' : '0';
      brandName.style.opacity = '1';
      brandName.style.transform = d ? X(true) : '';
    };
    var fly = function (toDock, onDone) {
      if (!geo) measure();
      if (reduce.matches) { cancelAll(); rest(toDock); if (onDone) onDone(); return; }
      if (!geo) { pendingFly = toDock; return; }
      var my = ++token;
      var mid = anims.length > 0;
      // Scrolled during the opening: the copy starts at however far the hero
      // sigil has faded in, and the hero's opening completes underneath.
      var sO = mid ? 1 : +window.getComputedStyle(sigWrap).opacity;
      sigWrap.style.transition = 'none'; sigWrap.classList.add('is-in');
      heroSig.style.transition = 'none';
      var fromT = mid ? window.getComputedStyle(sFly).transform : at(toDock);
      var fromN = window.getComputedStyle(brandName).transform;
      if (!fromN || fromN === 'none') fromN = X(false);
      cancelAll();
      heroSig.style.opacity = '0'; brandImg.style.opacity = '0';
      sigWrap.style.setProperty('--glow-o', toDock ? '0' : '1');
      sFly.style.transform = fromT;
      sFly.style.opacity = toDock && sO < .99 ? String(sO) : '1';
      anims.push(sFly.animate([{ transform: fromT }, { transform: at(!toDock) }], { duration: DUR, easing: EASE, fill: 'forwards' }));
      if (toDock && sO < .99) anims.push(sFly.animate([{ opacity: sO }, { opacity: 1, offset: .45 }, { opacity: 1 }], { duration: DUR, fill: 'forwards' }));
      anims.push(brandName.animate([{ transform: fromN }, { transform: X(toDock) }], { duration: DUR, easing: EASE, fill: 'forwards' }));
      flight = { home: !toDock, t0: performance.now(), y0: window.scrollY };
      var land = function () {
        if (my !== token) return;
        flight = null;
        cancelAll();
        rest(toDock);                                  // same frame as the clone leaves: no flash
        if (onDone) onDone();
      };
      anims[0].onfinish = land;
      flight.land = land;
    };
    // A flight home lands where the hero sigil is NOW: if the page moves
    // under it (a viewport resize, a late image or font, scroll movement),
    // it continues from where it is to the new spot in the time left, so
    // it never arrives off target and snaps.
    var retarget = function () {
      if (!flight || !flight.home || !anims.length) return;
      var left = DUR - (performance.now() - flight.t0);
      if (left < 34) return;
      var sr = heroSig.getBoundingClientRect();
      if (!sr.width) return;
      var y = window.scrollY;
      if (Math.abs(sr.left - geo.x) < .5 && Math.abs(sr.top + y - geo.y) < .5 && Math.abs(sr.width - parseFloat(sFly.style.width)) < .5) {
        if (Math.abs(y - flight.y0) < .5) return;     // nothing moved
      }
      geo.x = sr.left; geo.y = sr.top + y;
      sFly.style.width = sr.width + 'px'; sFly.style.height = sr.height + 'px';
      var from = window.getComputedStyle(sFly).transform;
      anims[0].onfinish = null; anims[0].cancel();
      anims[0] = sFly.animate([{ transform: from }, { transform: at(true) }], { duration: left, easing: 'cubic-bezier(.2, 0, .2, 1)', fill: 'forwards' });
      anims[0].onfinish = flight.land;
      flight.y0 = y;
    };
    var check = function () {
      if (handing) return;                           // a page hand-off is running; it settles itself
      var want = past();
      if (want === docked) { retarget(); return; }
      docked = want;
      if (!touched && !anims.length) { measure(); rest(want); return; }   // the browser placing the page
      fly(want);
    };
    onScroll(check);
    var remeasure = function () { if (anims.length) { retarget(); return; } measure(); if (!handing) rest(docked); };
    onResize(remeasure);
    window.addEventListener('load', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    // Late fonts and images change these boxes; re-measure exactly then.
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { window.requestAnimationFrame(remeasure); });
      [heroSig, brandImg, brandName, siteHead].forEach(function (el) { if (el) ro.observe(el); });
    }

    // Page switches. The docked header already matches other pages, so only
    // leaving from the top needs a hand-off (the sigil rises, the name steps
    // aside); arriving at the top plays it in reverse.
    var isHome = function (path) { return /(^|\/)(index\.html)?$/.test(path); };
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href]');
      if (!link || leaving || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target === '_blank' || link.hasAttribute('download') || link.hasAttribute('data-contact-open')) return;
      var url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (isHome(url.pathname)) {                        // Home / the name, from the homepage itself
        if (url.hash || window.scrollY < 3) return;
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
        return;
      }
      if (docked && !anims.length) return;              // header already matches the next page
      if (reduce.matches || !geo) return;               // plain navigation
      e.preventDefault(); leaving = true; handing = true;
      fly(true, function () { location.href = url.href; });
    });
    var settle = function () {
      cancelAll();
      handing = false;
      docked = past();
      rest(docked);
    };
    window.addEventListener('pageshow', function (e) {   // back to a cached homepage: settle cleanly
      if (!e.persisted) return;
      leaving = false; token++; settle();
    });
    var cameFromPage = false;
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      cameFromPage = !!ref && ref.origin === location.origin && !isHome(ref.pathname);
      // Only a real link click from another page counts: a refresh or Back /
      // Forward keeps the old referrer, but should open like a fresh visit.
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
      if (nav.type && nav.type !== 'navigate') cameFromPage = false;
    } catch (err) { cameFromPage = false; }
    docked = past();
    rest(docked); measure();
    if (cameFromPage && !reduce.matches && !docked && !location.hash) {
      // Start as the previous page ended — [sigil] Vinay Swaminathan — then,
      // once the page has settled, the sigil drops into the hero.
      handing = true;
      rest(true);
      sigWrap.style.transition = 'none'; sigWrap.style.opacity = '1'; sigWrap.style.transform = 'none';
      var arrive = function () {
        measure();
        if (!geo || past()) return settle();
        docked = true;
        fly(false, function () { handing = false; docked = past(); if (docked) fly(true); });
      };
      var whenSettled = function () {
        assetsReady.then(function () { afterTwoFrames(arrive); });
      };
      if (document.readyState === 'complete') whenSettled();
      else window.addEventListener('load', whenSettled, { once: true });
    }

    /* [kauyumari] A hidden doorway. While the sigil rests in the hero, its
       drawn shape (not the box around it: an alpha map of the image) wakes on
       hover and opens a full-screen artwork of Kauyumari on click or tap.
       Opening blooms the sigil's glow over the page and lets the artwork
       surface through it; closing gathers it back into the sigil and leaves
       the page exactly as it was. Music starts silent: only the visitor's
       own move of the volume control lets it be heard. */
    (function () {
      var ENABLED = false;                             // paused by Vinay 2026-10-15; set true to bring the doorway back
      if (!ENABLED) return;
      var ART = 'assets/kauyumari/';
      // Music: put the licensed track at assets/audio/ and set its path here,
      // e.g. 'assets/audio/kauyumari.mp3'. While empty, no volume control shows.
      var AUDIO_SRC = '';
      var mapW = 180, mapH = 0, alpha = null;
      (function () {                                   // alpha map of the sigil, for an exact hit area
        var im = new Image();
        im.onload = function () {
          try {
            mapH = Math.round(mapW * im.naturalHeight / im.naturalWidth);
            var c = document.createElement('canvas'); c.width = mapW; c.height = mapH;
            var x = c.getContext('2d'); x.drawImage(im, 0, 0, mapW, mapH);
            var d = x.getImageData(0, 0, mapW, mapH).data; alpha = new Uint8Array(mapW * mapH);
            for (var i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
          } catch (err) { alpha = null; }
        };
        im.src = 'assets/images/sigil-720.png';
      })();
      var onSigil = function (cx, cy, touch) {
        var r = heroSig.getBoundingClientRect();
        var fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
        if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return false;
        if (!alpha) return Math.pow(fx - .5, 2) + Math.pow(fy - .5, 2) < .1;   // map not ready: the core of the sigil
        var px = Math.round(fx * (mapW - 1)), py = Math.round(fy * (mapH - 1)), rad = touch ? 6 : 2;
        for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy > rad * rad) continue;
          var X = px + dx, Y = py + dy;
          if (X >= 0 && Y >= 0 && X < mapW && Y < mapH && alpha[Y * mapW + X] > 40) return true;
        }
        return false;
      };
      var navToggle = document.getElementById('nav-toggle');
      var resting = function () {                      // the sigil is in the hero, settled and visible
        return !docked && !anims.length && !handing && !leaving && window.scrollY <= 2 &&
          +window.getComputedStyle(sigWrap).opacity > .9 && heroSig.style.opacity !== '0' &&
          !root.classList.contains('contact-open') && !(navToggle && navToggle.getAttribute('aria-expanded') === 'true');
      };

      // The overlay, built once on first use.
      var box = null, art, img, veil, bloom, closeBtn, volWrap, range, audio, state = 'closed', closeAsked = false, pushed = false, scrollY0 = 0, opener = null, live = [], prevRestore = null;
      // The Back-button entry must never move the page: browsers restore the scroll they
      // last saved for an entry, which can lag behind a recent scroll back to the top.
      var holdScroll = function () { if (window.scrollY !== scrollY0) window.scrollTo(0, scrollY0); };
      var manualRestore = function (on) {
        try {
          if (on) { if (prevRestore === null) prevRestore = history.scrollRestoration; history.scrollRestoration = 'manual'; }
          else if (prevRestore !== null) { history.scrollRestoration = prevRestore; prevRestore = null; }
        } catch (err) {}
      };
      // One artwork file per visitor: portrait or landscape by the screen's shape;
      // WebP where the browser decodes it (JPEG otherwise); a smaller 'lite' WebP
      // on slow connections or with data saver on; the 2880px landscape only for
      // wide high-density screens. The artwork loads only on intent (hover, focus,
      // touch on the sigil), never with the page.
      var portrait = function () { return window.matchMedia('(max-aspect-ratio: 1/1)').matches; };
      var webp = false;
      (function () { var t = new Image(); t.onload = function () { webp = t.width > 0; }; t.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'; })();
      var lowData = function () {
        var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return !!c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '') || (c.downlink > 0 && c.downlink < 1.5));
      };
      var artSrc = function () {
        var lite = webp && lowData(), ext = webp ? '.webp' : '.jpg';
        if (portrait()) return ART + (lite ? 'kauyumari-portrait-720-lite.webp' : 'kauyumari-portrait-940' + ext);
        if (lite) return ART + 'kauyumari-landscape-1280-lite.webp';
        return ART + 'kauyumari-landscape-' + (window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 2000 ? '2880' : '1920') + ext;
      };
      var preloaded = {};
      var preload = function () { var u = artSrc(); if (preloaded[u]) return preloaded[u]; var im = new Image(); im.decoding = 'async'; im.src = u; preloaded[u] = im.decode ? im.decode().catch(function () {}) : new Promise(function (ok) { im.onload = im.onerror = ok; }); return preloaded[u]; };
      var showArt = function () {
        var u = artSrc(); if (img.getAttribute('src') === u) return;
        img.classList.add('is-waiting');                 // a late artwork fades in rather than popping
        img.onload = img.onerror = function () { img.classList.remove('is-waiting'); };
        img.src = u;
        if (img.complete && img.naturalWidth) img.classList.remove('is-waiting');
      };
      var build = function () {
        if (box) return;
        box = document.createElement('div');
        box.className = 'kauyumari'; box.id = 'kauyumari'; box.hidden = true; box.tabIndex = -1;
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Kauyumari');
        box.innerHTML =
          '<div class="kauyumari__veil" aria-hidden="true"></div>' +
          '<div class="kauyumari__art"><img class="kauyumari__img" alt="Kauyumari, the spirit stag, glowing blue and gold on a moonlit desert ridge beside a small fire." decoding="async" draggable="false"></div>' +
          '<div class="kauyumari__bloom" aria-hidden="true"></div>' +
          '<label class="kauyumari__volume" hidden><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" opacity=".6"/></svg><span class="visually-hidden">Music volume</span><input class="kauyumari__range" type="range" min="0" max="100" step="1" value="0"></label>' +
          '<button type="button" class="kauyumari__close" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button>' +
          '<audio preload="none" loop></audio>';
        document.body.appendChild(box);
        veil = box.querySelector('.kauyumari__veil'); art = box.querySelector('.kauyumari__art'); img = box.querySelector('.kauyumari__img');
        bloom = box.querySelector('.kauyumari__bloom'); closeBtn = box.querySelector('.kauyumari__close');
        volWrap = box.querySelector('.kauyumari__volume'); range = box.querySelector('.kauyumari__range'); audio = box.querySelector('audio');
        // Any tap on the artwork returns; the controls never do.
        box.addEventListener('click', function (e) { if (e.target.closest('.kauyumari__volume')) return; close(); });
        box.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { e.preventDefault(); close(); return; }
          if (e.key !== 'Tab') return;
          var f = [range, closeBtn].filter(function (el) { return el && !(el === range && volWrap.hidden); });
          var i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        });
        box.addEventListener('touchmove', function (e) { if (!e.target.closest('.kauyumari__volume')) e.preventDefault(); }, { passive: false });
        box.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
        // Turning a phone or resizing across portrait/landscape swaps to the matching artwork.
        onResize(function () { if (state !== 'closed') showArt(); });
        wireAudio();
      };

      // Audio: native <audio> through a Web Audio gain (iOS ignores element volume),
      // silent until the visitor raises the control.
      var ctx = null, gain = null, wired = false, audioChecked = false, pauseTimer = null;
      var wireAudio = function () {
        var unlock = function () {
          if (!wired) {
            wired = true;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) { try { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; ctx.createMediaElementSource(audio).connect(gain); gain.connect(ctx.destination); } catch (err) { ctx = null; gain = null; } }
            if (!gain) audio.volume = 0;
          }
          if (ctx && ctx.state === 'suspended') ctx.resume();
        };
        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { range.addEventListener(ev, unlock, { passive: true }); });
        range.addEventListener('input', function () {
          var v = range.value / 100;
          range.style.setProperty('--fill', range.value + '%');
          unlock();
          if (v > 0) { clearTimeout(pauseTimer); if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } }
          level(v * v, 260);                         // a gentle curve: low settings stay quiet
          if (v === 0) { clearTimeout(pauseTimer); pauseTimer = setTimeout(function () { if (+range.value === 0) audio.pause(); }, 320); }
        });
      };
      var fadeRaf = 0;
      var level = function (to, ms) {
        if (gain && ctx) {
          var t = ctx.currentTime; gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(to, t + ms / 1000);
          return;
        }
        cancelAnimationFrame(fadeRaf);
        var from = audio.volume, t0 = performance.now();
        var step = function (now) { var k = Math.max(0, Math.min(1, (now - t0) / ms)); audio.volume = from + (to - from) * k; if (k < 1) fadeRaf = requestAnimationFrame(step); };
        fadeRaf = requestAnimationFrame(step);
      };
      var checkAudio = function () {
        if (audioChecked || !AUDIO_SRC || !window.fetch) return; audioChecked = true;
        fetch(AUDIO_SRC, { method: 'HEAD' }).then(function (r) {
          if (!r.ok) return;
          audio.src = AUDIO_SRC; volWrap.hidden = false;
        }).catch(function () {});
      };

      var origin = function () {
        var r = heroSig.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * .52, size: r.width };
      };
      var reach = function (o) {                        // scale that lets the bloom cover the farthest corner
        var w = window.innerWidth, h = window.innerHeight;
        var far = Math.max(Math.hypot(o.x, o.y), Math.hypot(w - o.x, o.y), Math.hypot(o.x, h - o.y), Math.hypot(w - o.x, h - o.y));
        return far * 2.6 / 240;
      };
      var stop = function () { live.forEach(function (a) { a.cancel(); }); live = []; };
      var hold = function () {                         // keep what is on screen while animations are swapped
        [art, veil, bloom].forEach(function (el) { var cs = window.getComputedStyle(el); el.style.opacity = cs.opacity; el.style.transform = cs.transform === 'none' ? '' : cs.transform; });
        stop();
      };
      var clearInline = function () { [art, veil, bloom, box].forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; }); };
      var setInert = function (on) {
        Array.prototype.forEach.call(document.body.children, function (el) {
          if (el === box || el.tagName === 'SCRIPT') return;
          if (on) { if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); el.setAttribute('data-k-inert', ''); } }
          else if (el.hasAttribute('data-k-inert')) { el.removeAttribute('inert'); el.removeAttribute('data-k-inert'); }
        });
      };

      var open = function () {
        if (state !== 'closed' || !resting()) return;
        state = 'opening'; closeAsked = false;
        build(); checkAudio();
        opener = document.activeElement === heroSig ? heroSig : null;
        scrollY0 = window.scrollY;
        if (heroSig.style.transition) heroSig.style.transition = '';
        sigWrap.classList.add('is-entering');
        var go = function () {
          var o = origin();
          box.style.setProperty('--ox', o.x + 'px'); box.style.setProperty('--oy', o.y + 'px');
          range.value = 0; range.style.setProperty('--fill', '0%'); level(0, 10);
          showArt();
          box.classList.remove('is-open'); box.hidden = false;
          root.classList.add('kauyumari-open'); setInert(true);
          manualRestore(true);
          try { history.pushState({ kauyumari: 1 }, ''); pushed = true; } catch (err) { pushed = false; }
          box.focus({ preventScroll: true });
          var done = function () {
            if (state !== 'opening') return;
            state = 'open'; box.classList.add('is-open'); sigWrap.classList.remove('is-entering');
            if (closeAsked) close();
          };
          clearInline();
          if (reduce.matches) {
            veil.style.opacity = '1';
            live.push(art.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }));
            live[0].onfinish = done; return;
          }
          var s0 = o.size / 240 * .7, s1 = reach(o);
          live.push(bloom.animate([
            { transform: 'scale(' + s0 + ')', opacity: 0 },
            { transform: 'scale(' + (s1 * .55) + ')', opacity: .88, offset: .3 },
            { transform: 'scale(' + s1 + ')', opacity: .7, offset: .55 },
            { transform: 'scale(' + s1 + ')', opacity: 0 }
          ], { duration: 1500, easing: 'cubic-bezier(.33, 0, .2, 1)', fill: 'forwards' }));
          live.push(veil.animate([{ opacity: 0 }, { opacity: 0, offset: .12 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { duration: 1500, fill: 'forwards' }));
          var a = art.animate([
            { opacity: 0, transform: 'scale(1.06)' },
            { opacity: 0, transform: 'scale(1.06)', offset: .3 },
            { opacity: 1, transform: 'scale(1)' }
          ], { duration: 1500, easing: 'cubic-bezier(.25, .46, .45, .94)', fill: 'forwards' });
          live.push(a); a.onfinish = done;
        };
        // The artwork is decoded before it is shown; never wait more than a beat.
        Promise.race([preload(), new Promise(function (ok) { setTimeout(ok, 1400); })]).then(function () {
          if (state === 'opening') go();
        });
      };

      var close = function (fromHistory) {
        if (state === 'opening') { closeAsked = true; return; }
        if (state !== 'open') return;
        state = 'closing';
        box.classList.remove('is-open');
        if (pushed && !fromHistory) { pushed = false; skipPop = true; try { history.back(); } catch (err) {} }
        pushed = false;
        clearTimeout(pauseTimer); level(0, 700);
        setTimeout(function () { if (state !== 'open') audio.pause(); }, 760);
        var o = origin();
        box.style.setProperty('--ox', o.x + 'px'); box.style.setProperty('--oy', o.y + 'px');
        sigWrap.classList.add('is-entering');
        var finish = function () {
          stop();
          box.hidden = true; clearInline();
          setInert(false); root.classList.remove('kauyumari-open');
          holdScroll();
          requestAnimationFrame(function () { holdScroll(); setTimeout(function () { holdScroll(); if (state === 'closed') manualRestore(false); }, 120); });
          sigWrap.classList.remove('is-entering', 'is-awake');
          if (opener) opener.focus({ preventScroll: true });
          state = 'closed';
        };
        hold();
        if (reduce.matches) {
          var r = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
          live.push(r); r.onfinish = function () { finish(); };
          return;
        }
        var s0 = o.size / 240 * .7, s1 = reach(o);
        live.push(art.animate([                        // a dissolve: no shrinking edge
          { opacity: 1 }, { opacity: 0, offset: .6 }, { opacity: 0 }
        ], { duration: 1300, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' }));
        live.push(bloom.animate([
          { transform: 'scale(' + (s1 * .6) + ')', opacity: 0 },
          { transform: 'scale(' + (s1 * .32) + ')', opacity: .5, offset: .35 },
          { transform: 'scale(' + s0 + ')', opacity: .55, offset: .8 },
          { transform: 'scale(' + (s0 * .8) + ')', opacity: 0 }
        ], { duration: 1300, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }));
        var v = veil.animate([{ opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0, offset: .85 }, { opacity: 0 }], { duration: 1300, fill: 'forwards' });
        live.push(v);
        setTimeout(function () { sigWrap.classList.remove('is-entering'); }, 900);   // the sigil settles as the light returns to it
        v.onfinish = finish;
      };
      var skipPop = false;
      window.addEventListener('popstate', function () {
        if (state !== 'closed') { holdScroll(); requestAnimationFrame(holdScroll); }
        if (skipPop) { skipPop = false; return; }
        if (state === 'open' || state === 'opening') { pushed = false; if (state === 'opening') closeAsked = true; else close(true); }
      });

      // The sigil itself: hover wakes it, a click or tap on its drawn shape opens.
      var lastType = 'mouse';
      var setAwake = function (on) {
        if (on && heroSig.style.transition) heroSig.style.transition = '';   // the flight leaves 'none' behind; the glow eases again at rest
        sigWrap.classList.toggle('is-awake', !!on);
      };
      heroSig.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var on = state === 'closed' && resting() && onSigil(e.clientX, e.clientY, false);
        setAwake(on); if (on) preload();
      });
      heroSig.addEventListener('pointerleave', function () { if (document.activeElement !== heroSig) setAwake(false); });
      heroSig.addEventListener('pointerdown', function (e) { lastType = e.pointerType || 'mouse'; if (lastType !== 'mouse' && onSigil(e.clientX, e.clientY, true)) preload(); }, { passive: true });
      heroSig.addEventListener('click', function (e) {
        var type = e.pointerType || lastType;
        if (!onSigil(e.clientX, e.clientY, type !== 'mouse')) return;
        open();
      });
      // Keyboard: the sigil is a quiet button.
      heroSig.setAttribute('tabindex', '0');
      heroSig.setAttribute('role', 'button');
      heroSig.setAttribute('aria-label', 'Kauyumari');
      heroSig.setAttribute('aria-haspopup', 'dialog');
      heroSig.removeAttribute('alt');
      heroSig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      heroSig.addEventListener('focus', function () { if (resting()) { setAwake(true); preload(); } });
      heroSig.addEventListener('blur', function () { setAwake(false); });
      onScroll(function () { if (sigWrap.classList.contains('is-awake') && !resting()) setAwake(false); });
      window.addEventListener('pageshow', function (e) {
        if (!e.persisted || !box || state === 'closed') return;
        stop(); clearInline(); box.hidden = true; setInert(false); root.classList.remove('kauyumari-open'); sigWrap.classList.remove('is-entering', 'is-awake'); state = 'closed';
        if (audio) audio.pause();
      });
    })();
  }


  /* ---------------------------------------------------------------------
     3. Accordions — animate native <details> open and close (height,
         opacity and a 4px settle). Rapid clicks reverse from the current
         height; nothing is left with a fixed height afterwards, so resizing
         an open accordion is safe. Reduced motion: native instant toggle.
     --------------------------------------------------------------------- */
  // Some disclosures start open on wider screens only (1:1 Availability, Scope).
  // Some are simply content there (data-static-desktop: 1:1 Scope's "What it
  // is not"), not a control: open, and the label is not focusable.
  var wide = window.matchMedia('(min-width: 769px)');
  if (wide.matches) {
    document.querySelectorAll('details[data-open-desktop]').forEach(function (d) { d.open = true; });
  }
  // Crossing the breakpoint (a resize, a rotation) switches state at once,
  // without animating: open as content on wide screens, folded on phones.
  var staticSummaries = function (e) {
    document.querySelectorAll('details[data-static-desktop]').forEach(function (d) {
      var sm = d.querySelector(':scope > summary');
      if (wide.matches) { sm.setAttribute('tabindex', '-1'); sm.setAttribute('aria-disabled', 'true'); }
      else { sm.removeAttribute('tabindex'); sm.removeAttribute('aria-disabled'); }
      if (!e && !wide.matches) return;                   // first load on a phone: as authored (folded)
      if (d._acc) d._acc(wide.matches, false); else d.open = wide.matches;
    });
  };
  var ACC_MS = 444, ACC_EASE = 'cubic-bezier(.3,.7,.3,1)';   // calm, same speed open and close
  // Lists of parallel options (marked data-one-open: the 1:1 sessions and
  // immersions, the Path qualification lists) and the whole Approach
  // page keep one item open at a time. Story's "Read more" sections and the
  // reference panels stay independent on purpose.
  var setAcc = function (d, open, animate) {
    if (d._acc) d._acc(open, animate); else d.open = open;
  };
  // Opening one item closes the others in its group. An open item ABOVE the
  // tapped one closes at once, and the page is shifted once, in the same
  // frame, by exactly the height that went: the tapped line never moves.
  // (Animating that close while correcting the scroll every frame made
  // phones jerk: their scrolling runs off the main thread, so per-frame
  // corrections land a frame late and fight the browser's own anchoring.)
  // Items BELOW the tapped one cannot move it, so they still animate.
  var closeSiblings = function (d, animate) {
    var group = d.parentElement && d.closest('[data-one-open]');
    if (!group) return;
    var line = d.querySelector(':scope > summary') || d;
    var before = line.getBoundingClientRect().top, shifted = false;
    root.style.overflowAnchor = 'none';                  // one correction only: ours
    group.querySelectorAll('details.accordion').forEach(function (o) {
      if (o === d || !o.open || o.classList.contains('is-closing') || o.closest('[data-one-open]') !== group) return;
      if (o.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) { setAcc(o, false, false); shifted = true; }
      else setAcc(o, false, animate);
    });
    if (shifted) {
      var dy = line.getBoundingClientRect().top - before;
      if (Math.abs(dy) > .5) window.scrollBy({ top: dy, behavior: 'instant' });
    }
    afterTwoFrames(function () { root.style.overflowAnchor = ''; });
  };
  document.querySelectorAll('details.accordion').forEach(function (d) {
    var summary = d.querySelector(':scope > summary');
    var body = d.querySelector(':scope > .accordion__body');
    if (!summary || !body || !body.animate) return;
    var anim = null;
    var finish = function (open) {
      anim = null;
      d.open = open;
      d.classList.remove('is-animating', 'is-closing');
      body.style.height = body.style.opacity = body.style.transform = body.style.paddingBottom = '';
    };
    d._acc = function (open, animate) {
      var isOpen = d.open && !d.classList.contains('is-closing');
      if (open === isOpen) return;
      if (!animate || reduce.matches) {
        if (anim) anim.cancel();
        finish(open);
        return;
      }
      var closing = !open;
      // A closed <details> may still report its content's box (Chrome keeps
      // layout for hidden details content), so a closed one starts at 0.
      var from = d.open ? body.getBoundingClientRect().height : 0;
      var pad = anim ? getComputedStyle(body).paddingBottom : null;
      if (anim) anim.cancel();
      var padFull = getComputedStyle(body).paddingBottom;   // resting padding
      if (pad === null) pad = d.open ? padFull : '0px';
      d.classList.add('is-animating');
      if (closing) {
        d.classList.add('is-closing');
        anim = body.animate(
          [{ height: from + 'px', paddingBottom: pad, opacity: 1, transform: 'none' },
           { height: '0px', paddingBottom: '0px', opacity: 0, transform: 'translateY(-4px)' }],
          { duration: ACC_MS, easing: ACC_EASE });
        anim.onfinish = function () { finish(false); };
      } else {
        d.classList.remove('is-closing');
        d.open = true;
        var to = body.scrollHeight;
        anim = body.animate(
          [{ height: (from || 0) + 'px', paddingBottom: pad, opacity: from ? 1 : 0, transform: from ? 'none' : 'translateY(-4px)' },
           { height: to + 'px', paddingBottom: padFull, opacity: 1, transform: 'none' }],
          { duration: ACC_MS, easing: ACC_EASE });
        anim.onfinish = function () { finish(true); };
      }
    };
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (d.hasAttribute('data-static-desktop') && wide.matches) return;   // shown as plain content on wide screens
      var opening = !(d.open && !d.classList.contains('is-closing'));
      if (opening) closeSiblings(d, true);
      d._acc(opening, true);
    });
  });
  staticSummaries();
  if (wide.addEventListener) wide.addEventListener('change', staticSummaries);
  // A link to a session (#body … on the 1:1 page, from the homepage or from
  // within the page) opens that session's details and closes any other.
  var openForTarget = function (t, animate) {
    if (!t || !t.closest('[data-one-open]')) return;
    var d = t.matches('details.accordion') ? t : t.querySelector('details.accordion');
    if (!d || d.closest('[data-one-open]') !== t.closest('[data-one-open]')) return;
    closeSiblings(d, animate);
    setAcc(d, true, animate);
  };
  openForTarget(hashTarget(), false);
  window.addEventListener('pageshow', function (e) { if (e.persisted) openForTarget(hashTarget(), false); });
  window.addEventListener('hashchange', function () { openForTarget(hashTarget(), true); });
  // 3c. The Work (1:1): each pathway card opens its longer description in
  // the panel area below the row, one at a time; tapping the open card
  // closes it. A link to #bodywork, #breathwork or #shadow-work (the
  // homepage cards) opens that one. Without JS every panel stays visible.
  Array.prototype.forEach.call(document.querySelectorAll('[data-pathways]'), function (group) {
    var cards = Array.prototype.slice.call(group.querySelectorAll('[data-pathway]'));
    var show = function (card) {
      cards.forEach(function (c) {
        var on = c === card;
        c.setAttribute('aria-expanded', on ? 'true' : 'false');
        document.getElementById(c.getAttribute('aria-controls')).hidden = !on;
      });
    };
    var fromHash = function () {
      var t = hashTarget();
      var card = t && t.querySelector && t.querySelector('[data-pathway]');
      if (card && cards.indexOf(card) > -1) show(card);
    };
    show(null);
    fromHash();
    group.classList.add('is-ready');
    cards.forEach(function (c) {
      c.addEventListener('click', function () { show(c.getAttribute('aria-expanded') === 'true' ? null : c); });
    });
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('pageshow', function (e) { if (e.persisted) fromHash(); });
  });

  document.addEventListener('click', function (e) {           // same hash clicked again: no hashchange fires
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === location.hash) openForTarget(hashTarget(), true);
  });

  /* ---------------------------------------------------------------------
     4. Reveal engine — one mechanism for the whole site. The unit is the
        readable block (a heading, a paragraph, a list, a row of buttons,
        a dropdown), not the section: each block reveals as its own top
        enters the view, so copy arrives with the scroll instead of after
        it, and nothing waits on a section above it. Blocks arriving
        together follow one another in reading order, a beat apart. Page
        openings (data-seq) keep their composed sequence; photos
        (data-reveal-img) fade once decoded. Each reveals once (.is-in).
        Nothing is hidden until root carries .motion-ready.
     --------------------------------------------------------------------- */
  var T0 = performance.now();
  if (!reduce.matches && 'IntersectionObserver' in window) {
    root.classList.add('motion-ready');
    // The blocks of each section, in reading order. Layout wrappers are
    // opened up; lists, figures, dropdowns, forms and other composed pieces
    // count as one block each.
    var KEEP = 'p,h1,h2,h3,h4,ul,ol,dl,figure,details,form,svg,a,button,.btn-row,[data-stagger],.face,.accordion-group,.metrics,.quad,.pair,.form-sent,.form-errors,.link-list,.sessions,.contact-form';
    var units = [];
    document.querySelectorAll('[data-reveal]').forEach(function (box) {
      var items = [];
      var collect = function (el, depth) {
        Array.prototype.forEach.call(el.children, function (c) {
          if (c.hasAttribute('data-reveal-img') || c.hasAttribute('data-reveal') || c.tagName === 'SCRIPT') return;
          if (depth < 4 && !c.matches(KEEP) && c.children.length > 1) collect(c, depth + 1);
          else items.push(c);
        });
      };
      collect(box, 0);
      if (!items.length) items = [box];
      items.forEach(function (it) { it.classList.add('rv-item'); units.push(it); });
      box.classList.add('rv-ready');
    });
    // Page openings: each line a beat after the one before, in reading order.
    var SEQ_STEP = 170, seqCount = 0;
    document.querySelectorAll('main section').forEach(function (sec) {
      var lines = sec.querySelectorAll('[data-seq]');
      if (lines.length && !seqCount) seqCount = lines.length;
      // A line may name its own moment (data-seq-at, ms): the homepage hero runs
      // sigil, then title, then subtitle, whatever the DOM order.
      lines.forEach(function (el, i) { el.style.setProperty('--sd', (el.hasAttribute('data-seq-at') ? +el.getAttribute('data-seq-at') : i * SEQ_STEP) + 'ms'); units.push(el); });
    });
    var OPENING_PHOTO = SEQ_STEP * Math.max(0, Math.min(seqCount, 5) - 1) + 160;  // after the last line starts (from T0)
    // Stagger index for list / grid items (capped so long lists stay calm).
    document.querySelectorAll('[data-stagger]').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (item, i) { item.style.setProperty('--i', Math.min(i, 6)); });
    });
    var photos = Array.prototype.slice.call(document.querySelectorAll('[data-reveal-img]'));
    var BEAT = 120, MAX_BEATS = 5;
    var reveal = function (el, delay) {
      if (el.classList.contains('is-in')) return;
      if (!el.hasAttribute('data-seq')) el.style.setProperty('--cd', (delay || 0) + 'ms');
      el.dataset.inAt = Date.now() + (delay || 0);
      el.classList.add('is-in');
      // its section has begun: photos waiting on it continue
      var box = el.parentElement && el.parentElement.closest('[data-reveal]');
      if (box && !box.dataset.inAt) {
        box.dataset.inAt = el.dataset.inAt;
        if (box._onBegin) { box._onBegin.forEach(function (fn) { fn(); }); box._onBegin = null; }
      }
    };
    // Several blocks at once: top to bottom, a beat apart. One layout read.
    var revealAll = function (els) {
      els.map(function (el) { return [el.getBoundingClientRect().top, el]; })
        .sort(function (a, b) { return a[0] - b[0]; })
        .forEach(function (pair, i) { reveal(pair[1], Math.min(i, MAX_BEATS) * BEAT); });
    };
    var msOf = function (el) {
      var v = getComputedStyle(el).getPropertyValue('--rv-time').trim();
      return v ? parseFloat(v) * (/ms$/.test(v) ? 1 : 1000) : 555;
    };
    // A photo inside a revealing section waits for that section's first
    // words; a standalone photo (page openings) follows its text a beat later.
    var showPhoto = function (fig, extra) {
      if (fig.dataset.pending) return;
      fig.dataset.pending = '1';
      whenReady(fig.querySelector('img'), function () {
        var parent = fig.parentElement;
        var host = parent && (parent.closest('[data-reveal]') || parent.querySelector(':scope > [data-reveal]'));
        var go = function () { window.requestAnimationFrame(function () { reveal(fig); }); };
        var wait = 200;
        var seqs = !host && fig.closest('section') ? fig.closest('section').querySelectorAll('[data-seq]') : [];
        if (seqs.length) {
          wait = OPENING_PHOTO - (performance.now() - T0);
        } else if (host) {
          if (!host.dataset.inAt) { (host._onBegin = host._onBegin || []).push(function () { fig.dataset.pending = ''; showPhoto(fig, extra); }); return; }
          wait = msOf(host) * 0.5 - (Date.now() - Number(host.dataset.inAt));
        }
        wait = Math.max(0, wait) + (extra || 0);
        if (wait > 0) setTimeout(go, wait); else go();
      });
    };
    // One observer: a block reveals as its top passes the lower edge of the
    // view (a small margin, so it is seen to arrive, not caught mid-way).
    var pending = [];
    var done = function (el) { var i = pending.indexOf(el); if (i > -1) pending.splice(i, 1); };
    var io = new IntersectionObserver(function (entries) {
      var arriving = [];
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target); done(entry.target);
        arriving.push(entry.target);
      });
      if (arriving.length) revealAll(arriving);
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    var photoIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        showPhoto(entry.target);
        photoIO.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px 4% 0px', threshold: 0 });
    // Where the page stands now (including a scroll position the browser
    // restored): blocks above the view are shown as they are (off screen,
    // nothing is seen to change); blocks within it reveal top to bottom.
    var settleAll = function (els) {
      var inView = [];
      els.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.bottom <= 0 && r.height) { reveal(el); io.unobserve(el); done(el); }
        else if (r.top < window.innerHeight && r.bottom > 0) { inView.push(el); io.unobserve(el); done(el); }
      });
      revealAll(inView);
    };
    var observe = function () {
      photos.forEach(function (el) { photoIO.observe(el); });
      units.forEach(function (el) { if (!el.classList.contains('is-in')) { pending.push(el); io.observe(el); } });
      settleAll(pending.slice());
      // A jump (a position the browser restores late or in steps, a jump
      // link, a long fling) settles the same way. Any scroll before the
      // visitor has touched, wheeled, pressed a key or clicked is the
      // browser placing the page. Only still-pending blocks are read.
      var lastY = window.pageYOffset, touched = false;
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
        window.addEventListener(ev, function () { touched = true; }, { once: true, passive: true });
      });
      onScroll(function () {
        if (!pending.length) return;
        var y = window.pageYOffset, jump = !touched || Math.abs(y - lastY) > window.innerHeight * 0.5;
        lastY = y;
        if (jump) settleAll(pending.slice());
        else pending.slice().forEach(function (el) {
          if (el.getBoundingClientRect().bottom <= 0) { reveal(el); io.unobserve(el); done(el); }
        });
      });
    };
    // The opening starts from one state, .assets-ready (the first screen's
    // textures and the web fonts, capped at 1.3s), then two frames so the
    // first fade is never lost in a heavy frame. The homepage hero lets its
    // texture fade most of the way in before the sigil appears.
    assetsReady.then(function () {
      setTimeout(function () {
        afterTwoFrames(function () {
          T0 = performance.now();
          var seqShown = false;
          units.forEach(function (el) {   // the page opening first
            if (!el.hasAttribute('data-seq')) return;
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) { reveal(el); seqShown = true; }
          });
          // then everything else, as the last opening line begins
          setTimeout(observe, seqShown ? SEQ_STEP * Math.max(0, Math.min(seqCount, 5) - 1) : 0);
        });
      }, document.querySelector('.page-home') ? 420 : 180);
    });
  } else {
    document.querySelectorAll('svg').forEach(function (svg) {
      if (svg.pauseAnimations) svg.pauseAnimations();
    });
  }


  // Photographs keep their space and fade in once decoded (CSS holds them at 0).
  Array.prototype.forEach.call(document.querySelectorAll('.editorial__media img, .story__portrait img'), function (img) {
    whenReady(img, function () { img.classList.add('is-loaded'); });
  });

  // Approach graphics run only while on screen (CSS animations pause; the
  // Movement field's SMIL morph pauses too). Reduced motion: they rest.
  var graphics = document.querySelectorAll('.motion-graphic');
  if (graphics.length) {
    var setLive = function (svg, live) {
      svg.classList.toggle('is-paused', !live);
      if (svg.pauseAnimations) { if (live) svg.unpauseAnimations(); else svg.pauseAnimations(); }
    };
    graphics.forEach(function (svg) { setLive(svg, false); });
    if (!reduce.matches && 'IntersectionObserver' in window) {
      var gio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { setLive(e.target, e.isIntersecting); });
      }, { rootMargin: '10% 0px' });
      graphics.forEach(function (svg) { gio.observe(svg); });
    }
  }

  /* ---------------------------------------------------------------------
     5. Interior pages — sticky section nav scroll-spy (no-op without one).
        From 1100px the nav is a slim fixed index in the left gutter; below
        that it is a horizontal bar under the header (its height is
        --subnav-h). A section is current once its top passes the bottom of
        the sticky bars; at the very bottom the last reached section wins.
     --------------------------------------------------------------------- */
  var subnav = document.querySelector('.subnav');
  var subnavLinks = document.querySelectorAll('.subnav [data-section]');
  if (subnav && subnavLinks.length) {
    var sectionIds = Array.prototype.map.call(subnavLinks, function (a) { return a.getAttribute('data-section'); });
    var sectionEls = sectionIds.map(function (id) { return document.getElementById(id); });
    var setActive = function () {
      var line = Math.max(stickyLine() + 24, window.innerHeight * 0.3);
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      var current = sectionIds[0];
      sectionEls.forEach(function (el, i) {
        if (!el || !el.getClientRects().length) return;   // hidden section
        var top = el.getBoundingClientRect().top;
        if (top < line || (atBottom && top < window.innerHeight * 0.6)) current = sectionIds[i];
      });
      subnavLinks.forEach(function (a) {
        var on = a.getAttribute('data-section') === current;
        if (on && a.getAttribute('aria-current') !== 'location') {
          // Keep the active item in view in the horizontally scrolling bar.
          var bar = a.closest('ul');
          if (bar && bar.scrollWidth > bar.clientWidth) {
            // Move only as far as needed to bring the active item into view.
            var pad = 20, itemL = a.parentNode.offsetLeft - bar.offsetLeft, itemR = itemL + a.offsetWidth;
            var target = null;
            if (itemL - pad < bar.scrollLeft) target = itemL - pad;
            else if (itemR + pad + 36 > bar.scrollLeft + bar.clientWidth) target = itemR + pad + 36 - bar.clientWidth;   // clear the more-arrow
            if (target !== null) {
              if (bar.scrollTo) bar.scrollTo({ left: Math.max(0, target), behavior: reduce.matches ? 'auto' : 'smooth' });
              else bar.scrollLeft = Math.max(0, target);
            }
          }
        }
        a.setAttribute('aria-current', on ? 'location' : 'false');
      });
    };
    onScroll(setActive);
    onResize(setActive);
    setActive();

    // Phones / tablets: show when more sections sit off-screen (edge fade and
    // a brass arrow that slides the bar along); otherwise keep it plain.
    var bar = subnav.querySelector('ul');
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'subnav__more';
    more.setAttribute('aria-label', 'More sections');
    more.innerHTML = '<span aria-hidden="true">&rsaquo;</span>';
    subnav.appendChild(more);
    var markBar = function () {
      var max = bar.scrollWidth - bar.clientWidth;
      // When the chips overflow, the arrow gets its own lane (CSS): the
      // strip ends before it, so no chip ever slides underneath. The lane
      // stays while the strip overflows, so nothing shifts at the end.
      var lane = subnav.classList.contains('has-lane') ? 44 : 0;
      subnav.classList.toggle('has-lane', max + lane > 4);
      max = bar.scrollWidth - bar.clientWidth;
      subnav.classList.toggle('has-more', max > 4 && bar.scrollLeft < max - 4);
      subnav.classList.toggle('is-scrolled', bar.scrollLeft > 4);
    };
    more.addEventListener('click', function () {
      bar.scrollBy({ left: Math.round(bar.clientWidth * 0.7), behavior: reduce.matches ? 'auto' : 'smooth' });
    });
    bar.addEventListener('scroll', function () { window.requestAnimationFrame(markBar); }, { passive: true });
    onResize(markBar);
    markBar();
  }

  /* ---------------------------------------------------------------------
     6. FACE (Approach) — desktop: a centred F A C E row with the chosen
         letter's panel below; phones: a letter rail on the left, the panel
         on the right. Real disclosure buttons (aria-expanded); nothing
         is open until the visitor chooses a letter, and choosing the open
         letter closes it again. Without JS the four panels stay stacked
         and fully readable, and the rail stays hidden.
     --------------------------------------------------------------------- */
  var face = document.querySelector('[data-face]');
  if (face) {
    var rail = face.querySelector('.face__rail');
    var hint = face.querySelector('.face__hint');
    var btns = Array.prototype.slice.call(face.querySelectorAll('.face__btn'));
    var panels = btns.map(function (b) { return document.getElementById(b.getAttribute('aria-controls')); });
    panels.forEach(function (p, i) { p.setAttribute('role', 'region'); p.setAttribute('aria-labelledby', btns[i].id); });
    var current = -1;
    var open = function (i) {
      current = i;
      btns.forEach(function (b, k) {
        b.setAttribute('aria-expanded', k === i ? 'true' : 'false');
        b.classList.toggle('is-active', k === i);
        panels[k].hidden = k !== i;
      });
      face.classList.toggle('has-open', i >= 0);
    };
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { open(current === i ? -1 : i); });
      b.addEventListener('keydown', function (e) {   // arrows move between letters
        var n = btns.length, k = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (i + 1) % n;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (i - 1 + n) % n;
        if (k !== null) { e.preventDefault(); btns[k].focus(); }
      });
    });
    rail.hidden = false;
    if (hint) hint.hidden = false;
    face.classList.add('is-js');
    open(0);   // F is open on arrival, on every screen size
  }

  /* ---------------------------------------------------------------------
     7. Form helpers. A fieldset[data-require-one] needs at least one box
        ticked (native validation message on the first box).
     --------------------------------------------------------------------- */
  document.querySelectorAll('fieldset[data-require-one]').forEach(function (set) {
    var boxes = set.querySelectorAll('input[type="checkbox"]');
    var check = function () {
      var any = Array.prototype.some.call(boxes, function (b) { return b.checked; });
      boxes[0].setCustomValidity(any ? '' : set.getAttribute('data-require-one'));
    };
    boxes.forEach(function (b) { b.addEventListener('change', check); });
    check();
  });

  // "I'm not sure yet" and the five specific areas are mutually exclusive.
  document.querySelectorAll('[data-exclusive-group]').forEach(function (group) {
    var none = group.querySelector('input[data-exclusive]');
    var boxes = group.querySelectorAll('input[type="checkbox"]');
    if (!none) return;
    boxes.forEach(function (box) {
      box.addEventListener('change', function () {
        if (!box.checked) return;
        boxes.forEach(function (other) {
          if (other !== box && (box === none || other === none)) other.checked = false;
        });
      });
    });
  });

  // Group interest: ?experience=<key> preselects that experience and
  // ?event=YYYY-MM-DD (from a listed session) travels with the enquiry.
  var params = null;
  try { params = new URLSearchParams(location.search); } catch (e) {}
  if (params) {
    var expParam = params.get('experience');
    if (expParam) {
      document.querySelectorAll('input[name="experience"]').forEach(function (r) {
        if (r.dataset.key === expParam) r.checked = true;
      });
    }
    var eventParam = params.get('event');
    var eventInput = document.getElementById('g-event');
    if (eventInput && eventParam && /^\d{4}-\d{2}-\d{2}$/.test(eventParam)) {
      eventInput.value = eventParam;
      eventInput.disabled = false;
      var note = document.getElementById('g-event-note');
      if (note) {
        var d = new Date(eventParam + 'T12:00:00Z');
        var label = isNaN(d) ? eventParam : new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
        note.querySelector('span').textContent = label;
        note.hidden = false;
      }
    }
  }

  /* ---------------------------------------------------------------------
     7b. Web3Forms — one submission handler for every form[data-web3]
         (Alignment Call, Group interest, Collaboration). Each form names its
         own success panel (data-sent) and error box (data-errors); its
         subject and metadata are hidden fields in the markup. Success is
         shown only when Web3Forms explicitly accepts the submission
         (HTTP OK and success === true). On any failure the entered values
         stay in place. Without fetch, the form posts normally.
     --------------------------------------------------------------------- */
  var FAIL_MSG = 'Your message did not go through. Please try again in a moment.';
  document.querySelectorAll('form[data-web3]').forEach(function (form) {
    var sent = document.getElementById(form.getAttribute('data-sent'));
    var errors = document.getElementById(form.getAttribute('data-errors'));
    var endpoint = form.getAttribute('action') || '';
    if (typeof window.fetch !== 'function' || !/web3forms\.com/.test(endpoint)) return;
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.innerHTML : '';
    var restore = function (msg) {
      if (btn) { btn.disabled = false; btn.innerHTML = label; btn.style.minWidth = ''; }
      if (errors) { errors.textContent = msg; errors.hidden = false; errors.focus(); }
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();                      // native validation has already passed
      if (errors) errors.hidden = true;
      var bot = form.querySelector('input[name="botcheck"]');
      if (bot && bot.checked) return;          // honeypot: drop silently
      if (btn) { btn.style.minWidth = btn.offsetWidth + 'px'; btn.disabled = true; btn.textContent = 'Sending…'; }
      // Fields in form order. A fieldset[data-join="Label"] is sent as one
      // readable line ("Monday, Wednesday, Saturday"), not raw repeated values.
      var data = new FormData();
      var joined = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled || el.type === 'submit') return;
        var set = el.closest('fieldset[data-join]');
        if (set) {
          if (joined.indexOf(set) > -1) return;
          joined.push(set);
          var picked = Array.prototype.filter.call(set.querySelectorAll('input:checked'), Boolean)
            .map(function (b) { return b.value; });
          data.append(set.getAttribute('data-join'), picked.length ? picked.join(', ') : 'Not specified');
          return;
        }
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        // Accept a phone number typed any way; send it without spaces, dashes or brackets.
        data.append(el.name, el.type === 'tel' ? el.value.replace(/[\s().-]/g, '') : el.value.trim());
      });
      fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (body) { return { ok: r.ok, body: body }; });
        })
        .then(function (res) {
          if (res.ok && res.body && res.body.success === true) {
            if (sent) {
              var first = String(data.get('name') || '').trim().split(/\s+/)[0];
              sent.querySelectorAll('[data-sent-name]').forEach(function (el) { el.textContent = first; });
              var availEl = sent.querySelector('[data-sent-availability]');
              var days = data.get('Preferred days'), time = data.get('Preferred time');
              if (availEl && days && time) { availEl.hidden = false; availEl.querySelector('span').textContent = days + ' · ' + time; }
            }
            form.hidden = true;
            if (sent) { sent.hidden = false; sent.focus(); }
          } else {
            restore((res.body && res.body.message) ? 'Your message did not go through: ' + res.body.message : FAIL_MSG);
          }
        })
        .catch(function () {
          restore('Your message did not go through. This can be a connection issue. Please try again in a moment.');
        });
    });
  });

  /* ---------------------------------------------------------------------
     8. Get in touch — no floating button. Contact lives where people
         already look: the header (a quiet last item on wide screens, the
         last line of the menu on phones) and one understated invitation
         where a page naturally ends. Any [data-contact-open] link opens a
         short chooser: a modal <dialog> (popover on wide screens, bottom sheet on phones). Escape,
         the close button or the backdrop close it; focus returns to the
         control that opened it. Without JS the links simply go to the
         Alignment Call form.
     --------------------------------------------------------------------- */
  var CHOICES = [['1:1 work', 'alignment.html'], ['Group experiences', 'group-interest.html'], ['Collaboration', 'collaborate.html'], ['Something else', 'connect.html']];
  var sheet = document.createElement('dialog');
  if (typeof sheet.showModal === 'function') {
    sheet.className = 'contact-sheet';
    sheet.setAttribute('aria-labelledby', 'contact-q');
    sheet.innerHTML = '<div class="contact-sheet__panel">' +
      '<button type="button" class="contact-sheet__close" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
      '<h2 class="contact-sheet__q" id="contact-q">What are you reaching out about?</h2>' +
      '<ul class="contact-sheet__choices">' + CHOICES.map(function (c) {
        return '<li><a href="' + c[1] + '">' + c[0] + ' <span aria-hidden="true">&rarr;</span></a></li>';
      }).join('') + '</ul></div>';
    document.body.appendChild(sheet);
    var opener = null, closeTimer = null;
    var openSheet = function (from) {
      if (sheet.open) return;
      clearTimeout(closeTimer);
      opener = from || document.activeElement;
      root.classList.add('contact-open');
      sheet.showModal();
      // Focus the question (not a choice), so no option looks preselected.
      var q = sheet.querySelector('#contact-q'); q.setAttribute('tabindex', '-1'); q.focus({ preventScroll: true });
      afterTwoFrames(function () { sheet.classList.add('is-shown'); });
    };
    var closeSheet = function () {
      if (!sheet.open) return;
      sheet.classList.remove('is-shown');
      var done = function () {
        sheet.close();
        root.classList.remove('contact-open');
        if (opener && document.contains(opener) && opener.focus) opener.focus();
      };
      closeTimer = setTimeout(done, reduce.matches ? 0 : 333);
    };
    sheet.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });   // Escape
    // Keep Tab inside the sheet in every browser (Safari's Tab skips links
    // by default, which would otherwise let focus leave a modal dialog).
    sheet.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(sheet.querySelectorAll('a[href], button'));
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    });
    sheet.querySelector('.contact-sheet__close').addEventListener('click', closeSheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });   // backdrop
    // Leaving for a form, then coming back (bfcache): never return to an open sheet.
    window.addEventListener('pageshow', function () { root.classList.remove('is-leaving'); if (sheet.open) { sheet.classList.remove('is-shown'); sheet.close(); root.classList.remove('contact-open'); } });
    // Choosing an option: the sheet and page fade out, then the form opens
    // (and fades in with its own page opening).
    sheet.querySelectorAll('.contact-sheet__choices a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || reduce.matches) return;
        e.preventDefault();
        sheet.classList.remove('is-shown');
        root.classList.add('is-leaving');
        setTimeout(function () { window.location.href = a.href; }, 333);
      });
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-contact-open]');
      if (!t) return;
      e.preventDefault();
      openSheet(t.closest('.nav-mobile') ? toggle : t);
    });
  }

  /* ---------------------------------------------------------------------
     8b. Next section — one quiet floating button (lower right) on the
         longer pages, that takes the visitor to the next major section
         ([data-scroll-section]) on a click: native scrollIntoView, smooth
         (immediate with reduced motion); scrolling itself is never touched.
         The destination follows the scroll. It hides once there is no
         next section (the closing section or the footer is reached), and
         while the menu or the contact chooser is open. Section positions
         are measured on load and when the layout changes, never per frame.
     --------------------------------------------------------------------- */
  var marks = Array.prototype.slice.call(document.querySelectorAll('[data-scroll-section]'));
  if (marks.length) {
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'next-section';
    nextBtn.setAttribute('aria-label', 'Go to next section');
    nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(nextBtn);
    var tops = [], foot = document.querySelector('.site-foot'), footTop = Infinity, docH = 0, viewH = 0, line = 0, target = null;
    var measureMarks = function () {
      var y = window.pageYOffset;
      tops = marks.filter(function (el) { return el.getClientRects().length; })
        .map(function (el) { return [el.getBoundingClientRect().top + y, el]; });
      footTop = foot ? foot.getBoundingClientRect().top + y : Infinity;
      docH = document.documentElement.scrollHeight;
      viewH = window.innerHeight;
      line = stickyLine() + 12;
      updateNext();
    };
    var updateNext = function () {
      var y = window.pageYOffset, at = y + line;
      target = null;
      for (var i = 0; i < tops.length; i++) { if (tops[i][0] > at + 4) { target = tops[i][1]; break; } }
      var nearEnd = y + viewH >= Math.min(footTop, docH) - 24 || y + viewH >= docH - 4;
      nextBtn.classList.toggle('is-shown', !!target && !nearEnd);
    };
    nextBtn.addEventListener('click', function () {
      if (!target) return;
      target.scrollIntoView({ behavior: reduce.matches ? 'instant' : 'smooth', block: 'start' });
    });
    onScroll(updateNext);
    onResize(measureMarks);
    window.addEventListener('load', measureMarks);
    document.addEventListener('toggle', function () { window.requestAnimationFrame(measureMarks); }, true);   // accordions change the page's length
    if ('ResizeObserver' in window) new ResizeObserver(function () { window.requestAnimationFrame(measureMarks); }).observe(document.querySelector('main') || document.body);
    measureMarks();
  }

  /* ---------------------------------------------------------------------
     9. Hash landing. The browser's own jump happens before web fonts and
        images have settled, so the target can drift. Re-land once now and
        again after fonts/load, unless the visitor has scrolled meanwhile.
        `scroll-margin-top` (site.css) keeps it clear of the sticky header.
        A target inside a closed <details> opens it first.
     --------------------------------------------------------------------- */
  function revealTarget(t) {
    for (var el = t; el; el = el.parentElement) {
      if (el.tagName === 'DETAILS') el.open = true;
    }
  }
  function land() {
    var t = hashTarget();
    if (!t) return;
    revealTarget(t);
    t.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  if (location.hash) {
    var userMoved = false;
    var stop = function () { userMoved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, stop, { once: true, passive: true }); });
    var reland = function () { if (!userMoved) land(); };
    land();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reland);
    window.addEventListener('load', function () { reland(); setTimeout(reland, 150); });
  }
  // In-page links keep their native (smooth) scroll; only a target hidden
  // inside a closed <details> needs opening and re-landing.
  window.addEventListener('hashchange', function () {
    var t = hashTarget();
    if (t && t.closest('details:not([open])')) land();
  });
}());
