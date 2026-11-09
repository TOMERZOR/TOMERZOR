/* LUNE theme: variant picker, gallery, sticky buy bar, delivery estimate, menu, announcement rotation */
(function () {
  'use strict';

  /* Prices always in shekels (₪119, ₪1,374, ₪89.50), matching snippets/money.liquid,
     whatever money format the store is set to. */
  function formatMoney(cents) {
    var value = cents / 100;
    var whole = Math.round(value) === value;
    return '₪' + value.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  }

  function qtyOf(label) {
    var m = String(label).match(/\d+/);
    return m ? Math.max(1, parseInt(m[0], 10)) : 1;
  }

  /* ---------- Buy box ---------- */
  function initBuy(root) {
    var data = root.querySelector('[data-variants]');
    if (!data) return;
    var variants = JSON.parse(data.textContent);
    var form = root.querySelector('form');
    var idInput = root.querySelector('[data-variant-input]');
    var bpos = parseInt(root.dataset.bpos, 10);
    var cpos = parseInt(root.dataset.cpos, 10);
    var button = root.querySelector('[data-buy-button]');
    var buyLabel = root.querySelector('[data-buy-label]');
    var buyPrice = root.querySelector('[data-buy-price]');
    var priceBox = root.querySelector('[data-price]');
    var colorLabel = root.querySelector('[data-color-label]');
    var sticky = document.querySelector('[data-sticky-buy]');
    var stickyPrice = sticky && sticky.querySelector('[data-sticky-price]');
    var stickyBtn = sticky && sticky.querySelector('[data-sticky-button]');
    var buttonText = buyLabel ? buyLabel.textContent : '';

    function selected() {
      var current = variants.find(function (v) { return v.id === parseInt(idInput.value, 10); }) || variants[0];
      var opts = current.options.slice();
      root.querySelectorAll('fieldset[data-option-index]').forEach(function (fs) {
        var i = parseInt(fs.dataset.optionIndex, 10);
        var checked = fs.querySelector('input:checked');
        if (checked) opts[i] = checked.value;
      });
      return opts;
    }

    function findVariant(opts) {
      return variants.find(function (v) {
        return v.options.every(function (o, i) { return o === opts[i]; });
      });
    }

    function updateBundleCards(opts) {
      if (bpos < 0) return;
      var single = variants.find(function (v) {
        return qtyOf(v.options[bpos]) === 1 && (cpos < 0 || v.options[cpos] === opts[cpos]);
      });
      root.querySelectorAll('.bundle').forEach(function (card) {
        var input = card.querySelector('input');
        card.classList.toggle('is-checked', input.checked);
        var probe = opts.slice();
        probe[bpos] = input.value;
        var v = findVariant(probe);
        if (!v) return;
        var priceEl = card.querySelector('[data-bundle-price]');
        if (priceEl) priceEl.textContent = formatMoney(v.price);
        var saveEl = card.querySelector('[data-bundle-save]');
        if (saveEl && single) {
          var saving = single.price * qtyOf(input.value) - v.price;
          saveEl.textContent = saving > 0 ? 'חוסכת ' + formatMoney(saving) : '';
        }
      });
    }

    function goToMedia(mediaId) {
      if (!mediaId) return;
      var slide = root.querySelector('[data-media-id="' + mediaId + '"]');
      if (slide) slide.parentNode.scrollTo({ left: slide.offsetLeft - slide.parentNode.firstElementChild.offsetLeft, behavior: 'smooth' });
    }

    function render() {
      var opts = selected();
      var v = findVariant(opts);
      updateBundleCards(opts);
      if (colorLabel && cpos >= 0) colorLabel.textContent = opts[cpos];
      if (!v) {
        button.disabled = true;
        if (stickyBtn) stickyBtn.disabled = true;
        buyLabel.textContent = 'לא זמין';
        return;
      }
      idInput.value = v.id;
      button.disabled = !v.available;
      if (stickyBtn) stickyBtn.disabled = !v.available;
      buyLabel.textContent = v.available ? buttonText : 'אזל מהמלאי';
      buyPrice.textContent = formatMoney(v.price);
      if (stickyPrice) stickyPrice.textContent = formatMoney(v.price);
      if (priceBox) {
        var html = '<span class="price">' + formatMoney(v.price) + '</span>';
        if (v.compare > v.price) html += '<s class="price price--was">' + formatMoney(v.compare) + '</s>';
        priceBox.innerHTML = html;
      }
      goToMedia(v.media);
      if (window.history && window.history.replaceState && document.body.classList.contains('template-product')) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', v.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-option]')) render();
    });
    render();

    /* gallery thumbs */
    var slides = root.querySelector('[data-slides]');
    var thumbs = root.querySelectorAll('[data-thumb]');
    var dots = root.querySelectorAll('.buy__dot');
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        var s = slides.children[parseInt(t.dataset.thumb, 10)];
        if (s) slides.scrollTo({ left: s.offsetLeft - slides.firstElementChild.offsetLeft, behavior: 'smooth' });
      });
    });
    if (slides && (thumbs.length || dots.length) && 'IntersectionObserver' in window) {
      var slideObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = Array.prototype.indexOf.call(slides.children, en.target);
          thumbs.forEach(function (t, j) { t.classList.toggle('is-active', i === j); });
          dots.forEach(function (d, j) { d.classList.toggle('is-active', i === j); });
        });
      }, { root: slides, threshold: 0.6 });
      Array.prototype.forEach.call(slides.children, function (c) { slideObs.observe(c); });
    }

    /* sticky bar: visible whenever the main order button is off screen,
       except while the hero (which has its own CTA) is in view */
    if (sticky && 'IntersectionObserver' in window) {
      sticky.hidden = false;
      var buttonVisible = true;
      var heroVisible = !!document.querySelector('.hero');
      var update = function () { sticky.classList.toggle('is-visible', !buttonVisible && !heroVisible); };
      new IntersectionObserver(function (entries) { buttonVisible = entries[0].isIntersecting; update(); }).observe(button);
      var hero = document.querySelector('.hero');
      if (hero) new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; update(); }, { threshold: 0.15 }).observe(hero);
    }

    /* links that pre-select a bundle, e.g. the gift section */
    document.querySelectorAll('[data-pick]').forEach(function (link) {
      link.addEventListener('click', function () {
        var want = link.getAttribute('data-pick');
        root.querySelectorAll('.bundle input').forEach(function (input) {
          if (input.value === want) { input.checked = true; render(); }
        });
      });
    });

    /* delivery estimate in real dates (Israeli business days: Sun to Thu) */
    var eta = root.querySelector('[data-eta]');
    if (eta) {
      var addBusinessDays = function (start, n) {
        var d = new Date(start);
        while (n > 0) {
          d.setDate(d.getDate() + 1);
          var day = d.getDay();
          if (day !== 5 && day !== 6) n--;
        }
        return d;
      };
      var now = new Date();
      var from = addBusinessDays(now, parseInt(eta.dataset.min, 10) || 10);
      var to = addBusinessDays(now, parseInt(eta.dataset.max, 10) || 18);
      var fmt = function (d) { return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }); };
      var target = eta.querySelector('[data-eta-range]');
      if (target) target.textContent = 'בין ' + fmt(from) + ' ל-' + fmt(to);
    }

    /* prevent double submit */
    form.addEventListener('submit', function () {
      setTimeout(function () {
        button.classList.add('is-loading');
        if (button.dataset.loadingText && buyLabel) buyLabel.textContent = button.dataset.loadingText;
      }, 0);
    });
    window.addEventListener('pageshow', function () {
      button.classList.remove('is-loading');
      render();
    });
  }

  /* ---------- Menu drawer ---------- */
  function initMenu() {
    var openBtn = document.querySelector('[data-menu-open]');
    var drawer = document.querySelector('[data-menu]');
    if (!openBtn || !drawer) return;
    var close = function () { drawer.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); };
    openBtn.addEventListener('click', function () {
      drawer.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      var c = drawer.querySelector('[data-menu-close]');
      if (c) c.focus();
    });
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer || e.target.closest('[data-menu-close]')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
  }

  /* ---------- Announcement rotation ---------- */
  function initAnnounce() {
    var track = document.querySelector('[data-announce]');
    if (!track) return;
    var items = track.children;
    if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var i = 0;
    setInterval(function () {
      items[i].classList.remove('is-active');
      i = (i + 1) % items.length;
      items[i].classList.add('is-active');
    }, 4500);
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function init() {
    initReveal();
    document.querySelectorAll('[data-buy]').forEach(initBuy);
    initMenu();
    initAnnounce();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
