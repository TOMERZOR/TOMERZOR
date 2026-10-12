/* Dream Studios theme: header, overlays, bag drawer, product form, search, wishlist, motion. */
(function () {
  "use strict";
  const T = window.theme || {};
  const S = T.strings || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || body.classList.contains("no-motion");
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };
  const parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");
  const sectionInner = (html, id) => { const el = parseHTML(html).getElementById(`shopify-section-${id}`); return el ? el.innerHTML : ""; };

  function formatMoney(cents) {
    const fmt = T.moneyFormat || "{{amount}}";
    const value = (cents || 0) / 100;
    const fix = (n, d, thousands, decimal) => {
      const [i, f] = n.toFixed(d).split(".");
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (f ? decimal + f : "");
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => ({
      amount: fix(value, 2, ",", "."),
      amount_no_decimals: fix(value, 0, ",", "."),
      amount_with_comma_separator: fix(value, 2, ".", ","),
      amount_no_decimals_with_comma_separator: fix(value, 0, ".", ","),
      amount_with_apostrophe_separator: fix(value, 2, "'", ".")
    }[key] || fix(value, 2, ",", ".")));
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
  }
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- header ---------- */
  const header = $("[data-header]");
  const headerWrap = header ? header.closest(".shopify-section") || header : null;
  let lastY = window.scrollY;
  function onScroll() {
    if (!header) return;
    const y = window.scrollY;
    if (header.classList.contains("header--overlay")) header.classList.toggle("is-solid", y > 40);
    const overlayOpen = body.classList.contains("menu-open") || body.classList.contains("search-open");
    if (Math.abs(y - lastY) > 6) { headerWrap.classList.toggle("is-hidden", y > lastY && y > 240 && !overlayOpen); lastY = y; }
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const menu = $("#menu"), search = $("#search"), menuBtn = $("#menu-btn"), searchBtn = $("#search-btn");
  function placeOverlays() {
    if (headerWrap) headerWrap.classList.remove("is-hidden");
    const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    $$(".overlay").forEach((o) => (o.style.paddingTop = `${top}px`));
  }
  function setMenu(open) {
    if (!menu) return;
    if (open) { setSearch(false); placeOverlays(); }
    menu.classList.toggle("is-open", open);
    body.classList.toggle("menu-open", open);
    body.classList.toggle("is-locked", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? menuBtn.dataset.labelClose : menuBtn.dataset.labelOpen);
  }
  function setSearch(open) {
    if (!search) return;
    if (open && menu && menu.classList.contains("is-open")) setMenu(false);
    if (open) placeOverlays();
    search.classList.toggle("is-open", open);
    body.classList.toggle("search-open", open);
    body.classList.toggle("is-locked", open);
    searchBtn.setAttribute("aria-expanded", open);
    if (open) setTimeout(() => $("#search-input").focus(), 60);
  }
  if (menuBtn) menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  if (searchBtn) searchBtn.addEventListener("click", (e) => { e.preventDefault(); setSearch(!search.classList.contains("is-open")); });
  $$("[data-open-search]").forEach((b) => b.addEventListener("click", () => setSearch(true)));
  if ($("#search-back")) $("#search-back").addEventListener("click", () => setSearch(false));
  $$("#menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------- predictive search ---------- */
  const searchInput = $("#search-input"), results = $("#search-results"), suggest = $("#search-suggest");
  let searchTimer, searchCtrl;
  function runSearch(q) {
    const term = q.trim();
    if (suggest) suggest.hidden = !!term;
    if (!term) { results.innerHTML = ""; return; }
    if (searchCtrl) searchCtrl.abort();
    searchCtrl = new AbortController();
    const url = `${T.routes.predictiveSearch}?q=${encodeURIComponent(term)}&resources[type]=product&resources[limit]=8&section_id=predictive-search`;
    fetch(url, { signal: searchCtrl.signal })
      .then((r) => r.text())
      .then((html) => { results.innerHTML = sectionInner(html, "predictive-search"); syncFavs(); })
      .catch(() => { /* aborted or offline */ });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(searchInput.value), 220); });
    $$(".popular a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); searchInput.value = a.dataset.q; runSearch(a.dataset.q); }));
  }

  /* ---------- bag drawer ---------- */
  const cartSection = () => $("#shopify-section-cart-drawer");
  let drawerOpen = false;
  function setBag(open) {
    const drawer = $("[data-cart-drawer]"), scrim = $("[data-cart-scrim]");
    if (!drawer) return;
    drawerOpen = open;
    drawer.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", !open);
    body.classList.toggle("is-locked", open);
    if (open) $("#bag-close").focus();
  }
  function renderCart(sections) {
    const html = sections && sections["cart-drawer"];
    const wrap = cartSection();
    if (!html || !wrap) return;
    const before = +($("[data-cart-drawer]") || {}).dataset?.count || 0;
    const doc = parseHTML(html);
    const fresh = doc.getElementById("shopify-section-cart-drawer");
    wrap.innerHTML = fresh ? fresh.innerHTML : html;
    const drawer = $("[data-cart-drawer]");
    if (drawerOpen) { drawer.classList.add("is-open"); $("[data-cart-scrim]").classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); }
    const count = +drawer.dataset.count || 0;
    $$("[data-cart-count]").forEach((el) => { el.textContent = count || ""; if (count > before) replay(el, "bump"); });
  }
  const bagBtn = $("#bag-btn");
  if (bagBtn) bagBtn.addEventListener("click", (e) => { if (cartSection()) { e.preventDefault(); setBag(true); } });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#bag-close") || e.target.closest("[data-cart-scrim]")) setBag(false);
    const q = e.target.closest("[data-cart-drawer] [data-line]");
    if (q) {
      q.disabled = true;
      fetch(T.routes.cartChange, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ line: +q.dataset.line, quantity: +q.dataset.qty, sections: "cart-drawer", sections_url: location.pathname })
      }).then((r) => r.json()).then((cart) => renderCart(cart.sections)).catch(() => { q.disabled = false; });
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setBag(false);
    if (menu && menu.classList.contains("is-open")) setMenu(false);
    if (search && search.classList.contains("is-open")) setSearch(false);
  });

  /* ---------- product form ---------- */
  const productSection = $("[data-product-section]");
  if (productSection) {
    const product = JSON.parse($("[data-product-json]", productSection).textContent);
    const form = $("[data-product-form]", productSection);
    const idInput = $("[data-variant-id]", form);
    const addBtn = $("[data-add-button]", form);
    const msg = $("[data-product-msg]", productSection);
    const fieldsets = $$("fieldset[data-option-index]", form);
    const sizeSet = $("fieldset[data-size-option]", form);

    // Ask shoppers to pick a size themselves instead of preselecting one.
    if (sizeSet && !/[?&]variant=/.test(location.search)) $$("input", sizeSet).forEach((i) => (i.checked = false));

    const selected = () => fieldsets.map((f) => { const c = $("input:checked", f); return c ? c.value : null; });
    const matches = (v, opts) => opts.every((o, i) => o === null || v.options[i] === o);

    function update() {
      const opts = selected();
      fieldsets.forEach((f, i) => {
        $("[data-option-value]", f).textContent = opts[i] || "";
        $$("input", f).forEach((input) => {
          const test = opts.slice(); test[i] = input.value;
          const ok = product.variants.some((v) => v.available && matches(v, test));
          input.nextElementSibling.classList.toggle("is-unavailable", !ok);
        });
      });
      const complete = opts.every((o) => o !== null);
      const variant = complete ? product.variants.find((v) => matches(v, opts)) : null;
      idInput.value = variant ? variant.id : "";
      if (!complete) { addBtn.disabled = false; addBtn.textContent = S.addToBag; return; }
      if (!variant) { addBtn.disabled = true; addBtn.textContent = S.unavailable; return; }
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? S.addToBag : S.soldOut;
      const price = $("[data-price]", productSection);
      if (price) price.innerHTML = formatMoney(variant.price) + (variant.compare_at_price > variant.price ? ` <s class="price__was">${formatMoney(variant.compare_at_price)}</s>` : "");
      const url = new URL(location.href); url.searchParams.set("variant", variant.id); history.replaceState(null, "", url);
      if (variant.featured_media) {
        const fig = $(`[data-media-id="${variant.featured_media.id}"]`, productSection);
        const g = $("#gallery");
        if (fig && g && g.scrollWidth > g.clientWidth) g.scrollTo({ left: fig.offsetLeft, behavior: "smooth" });
      }
      msg.textContent = "";
    }
    fieldsets.forEach((f) => f.addEventListener("change", update));
    update();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!idInput.value) { msg.textContent = S.chooseOption; return; }
      addBtn.disabled = true;
      const data = new FormData(form);
      data.append("sections", "cart-drawer");
      data.append("sections_url", location.pathname);
      fetch(T.routes.cartAdd, { method: "POST", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, body: data })
        .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
        .then(({ ok, json }) => {
          if (!ok) { msg.textContent = json.description || json.message || S.addError; return; }
          renderCart(json.sections); setBag(true);
        })
        .catch(() => { msg.textContent = S.addError; })
        .finally(() => { addBtn.disabled = false; update(); });
    });

    const g = $("#gallery"), gc = $("#gallery-count");
    if (g && gc) g.addEventListener("scroll", () => { gc.textContent = `${Math.round(Math.abs(g.scrollLeft) / g.clientWidth) + 1} / ${g.children.length}`; }, { passive: true });
    const sg = $("[data-open-size-guide]", productSection);
    if (sg) sg.addEventListener("click", () => { const d = $("#size-guide"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); } });
  }

  /* ---------- recommendations ---------- */
  $$("[data-recommendations]").forEach((el) => {
    fetch(el.dataset.url).then((r) => r.text()).then((html) => {
      const doc = parseHTML(html);
      const fresh = doc.querySelector("[data-recommendations]");
      if (fresh && fresh.innerHTML.trim()) { el.innerHTML = fresh.innerHTML; bindRailNav(el); syncFavs(); reveal($$(".section__head, .card", el)); }
    }).catch(() => { /* no recommendations */ });
  });

  /* ---------- rails ---------- */
  function bindRailNav(scope) {
    $$("[data-rail-prev], [data-rail-next]", scope).forEach((btn) => btn.addEventListener("click", () => {
      const rail = document.getElementById(btn.dataset.railPrev || btn.dataset.railNext);
      const dir = getComputedStyle(rail).direction === "rtl" ? -1 : 1;
      rail.scrollBy({ left: dir * (btn.dataset.railNext ? 1 : -1) * rail.clientWidth * 0.75, behavior: "smooth" });
    }));
  }
  bindRailNav(document);

  /* ---------- wishlist ---------- */
  let favs = store.get("dream.favs", []);
  function syncFavs() {
    $$("[data-fav-count]").forEach((el) => (el.textContent = favs.length || ""));
    $$("[data-fav]").forEach((b) => b.setAttribute("aria-pressed", favs.includes(b.dataset.fav)));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault();
    const h = b.dataset.fav;
    favs = favs.includes(h) ? favs.filter((f) => f !== h) : [...favs, h];
    store.set("dream.favs", favs);
    syncFavs();
    if (favs.includes(h)) $$(`[data-fav="${h}"]`).forEach((x) => replay(x, "pop"));
    toast(favs.includes(h) ? S.savedToWishlist : S.removedFromWishlist);
    if (wishlistGrid && !favs.includes(h)) { const card = b.closest(".card"); if (card) card.remove(); showWishlistEmpty(); }
  });
  const wishlistGrid = $("[data-wishlist-grid]");
  const showWishlistEmpty = () => { const empty = $("[data-wishlist-empty]"); if (empty) empty.hidden = wishlistGrid.children.length > 0; };
  if (wishlistGrid) {
    const root = (T.routes.root || "/").replace(/\/$/, "");
    Promise.all(favs.map((h) => fetch(`${root}/products/${encodeURIComponent(h)}?section_id=card-render`)
      .then((r) => (r.ok ? r.text() : "")).then((html) => ({ h, html: html ? sectionInner(html, "card-render").trim() : "" }))
      .catch(() => ({ h, html: "" }))))
      .then((items) => {
        const missing = items.filter((i) => !i.html).map((i) => i.h);
        if (missing.length) { favs = favs.filter((f) => !missing.includes(f)); store.set("dream.favs", favs); }
        wishlistGrid.innerHTML = items.map((i) => i.html).join("");
        syncFavs(); showWishlistEmpty(); reveal($$(".card", wishlistGrid));
      });
  }
  syncFavs();

  /* ---------- collection filters ---------- */
  const facets = $("[data-facets]"), filterBtn = $("#filter-btn");
  if (facets && filterBtn) {
    filterBtn.addEventListener("click", () => { facets.hidden = !facets.hidden; filterBtn.setAttribute("aria-expanded", !facets.hidden); });
    facets.addEventListener("change", (e) => { if (e.target.matches("input[type=radio], input[type=checkbox]")) facets.requestSubmit ? facets.requestSubmit() : facets.submit(); });
    facets.addEventListener("submit", () => {
      $$("input[type=number]", facets).forEach((i) => { if (i.value === "") i.disabled = true; });
    });
  }

  /* ---------- newsletter: neutral age check + explicit consent ---------- */
  $$("[data-newsletter]").forEach((nf) => {
    nf.setAttribute("novalidate", "");
    nf.addEventListener("submit", (e) => {
      const msg = $("#news-msg", nf), email = $("[type=email]", nf), year = $("#news-year", nf), consent = $("#news-consent", nf);
      if (!year) return;
      const fail = (text) => { e.preventDefault(); if (msg) msg.textContent = text; };
      let blocked = false;
      try { blocked = sessionStorage.getItem("dream.underage") === "1"; } catch (err) { /* ignore */ }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail(S.newsEmail);
      if (!year.value) return fail(S.newsYear);
      if (blocked || new Date().getFullYear() - +year.value < (T.newsletterMinAge || 16)) {
        try { sessionStorage.setItem("dream.underage", "1"); } catch (err) { /* ignore */ }
        $$("input, select, button", nf).forEach((el) => (el.disabled = true));
        return fail(S.newsUnderage);
      }
      if (!consent.checked) return fail(S.newsConsent);
    });
  });

  /* ---------- cookie preferences (Shopify's cookie banner) ---------- */
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-cookie-settings]")) return;
    if (window.privacyBanner && typeof window.privacyBanner.showPreferences === "function") window.privacyBanner.showPreferences();
    else if (T.cookiePolicyUrl) location.href = T.cookiePolicyUrl;
  });

  /* ---------- address forms: preselect saved country ---------- */
  $$("select[data-default]").forEach((s) => { if (s.dataset.default) s.value = s.dataset.default; });

  /* ---------- motion ---------- */
  const io = !reduceMotion && "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.12 }) : null;
  function reveal(els) {
    if (!io) return;
    let row = 0, lastTop = null;
    els.forEach((el) => {
      if (el.classList.contains("is-in") || el.classList.contains("reveal")) return;
      const t = el.getBoundingClientRect().top;
      row = t === lastTop ? row + 1 : 0; lastTop = t;
      el.style.setProperty("--d", `${Math.min(row, 5) * 70}ms`);
      el.classList.add("reveal"); io.observe(el);
    });
  }
  if (!window.Shopify || !window.Shopify.designMode) {
    reveal($$(".section__head, .rail .card, #product-grid .card, .tile, .campaign > *, .story > div > *, .footer__top > *"));
  }

  // Product image morphs from its card into the product page (cross-document view transitions).
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".card__link");
    const img = a && a.querySelector(".card__media img");
    if (img) { $$("img").forEach((i) => (i.style.viewTransitionName = "")); img.style.viewTransitionName = "pdp-image"; }
  });
  window.addEventListener("pageshow", () => $$(".card__media img").forEach((i) => (i.style.viewTransitionName = "")));
})();
