/* Dream Studios — shared chrome, bag, wishlist and page scripts. */
(function () {
  "use strict";
  const D = window.DREAM;
  const IMG = "assets/img/";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const byId = (id) => D.products.find((p) => p.id === id);
  const money = (n) => `${n.toLocaleString("en-US")} ${D.currency}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- storage (fails soft in private mode / sandboxed previews) ---------- */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  let bag = store.get("dream.bag", []).filter((l) => byId(l.id));
  let favs = store.get("dream.favs", []).filter(byId);

  /* ---------- icons ---------- */
  const ICONS = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="M5 5l14 14M19 5L5 19"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6 8-6s6.8 1.8 8 6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    bag: '<path d="M4.5 9.5h15l-1 10.5h-13z"/><path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/>',
    arrow: '<path d="M4 12h15M14 7l5 5-5 5"/>',
    back: '<path d="M20 12H5M10 7l-5 5 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
  };
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ---------- chrome ---------- */
  const page = document.body.dataset.page;
  const msgs = ["Free shipping on orders over 400 NIS", "30 days easy returns & exchanges", "Taxes included", `New drop ${D.season} is live`];
  const marquee = [...msgs, ...msgs, ...msgs, ...msgs].map((m) => `<span>${m}</span>`).join("");

  const top = $("#site-top");
  top.outerHTML = `
  <div class="bar" role="region" aria-label="Announcements"><div class="bar__track">${marquee}</div></div>
  <header class="header" id="header">
    <div class="header__left">
      <button class="icon-btn" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="menu">${icon("menu")}</button>
      <a class="logo" href="index.html" aria-label="Dream Studios home">Dream<sup>®</sup>Studios</a>
      <nav class="header__nav" aria-label="Primary">
        <a href="collection.html#all">New Arrivals</a>
        <a href="collection.html#tees">T-Shirts</a>
        <a href="collection.html#denim">Denim</a>
        <a href="index.html#universe">Universe</a>
      </nav>
    </div>
    <div class="header__right">
      <button class="icon-btn" id="search-btn" aria-label="Search" aria-expanded="false" aria-controls="search">${icon("search")}</button>
      <a class="icon-btn hide-sm" href="#" aria-label="Account">${icon("user")}</a>
      <a class="icon-btn" href="collection.html#wishlist" aria-label="Wishlist">${icon("heart")}<span class="count" data-fav-count></span></a>
      <button class="icon-btn" id="bag-btn" aria-label="Bag" aria-controls="bag">${icon("bag")}<span class="count" data-bag-count></span></button>
    </div>
  </header>

  <div class="overlay" id="menu" aria-label="Menu">
    <button class="search-field" type="button" data-open-search style="width:100%;text-align:left">${icon("search")}<span style="color:var(--ink-faint);font-size:17px">Type to Search</span></button>
    <nav class="menu__big" aria-label="Featured">
      <a href="collection.html#all">New Arrivals</a>
      <a href="collection.html#tees">Graphic Tees</a>
      <a href="product.html#created-by-god-shorts">Created By God</a>
      <a href="collection.html#all">${D.season}<sup>New</sup></a>
    </nav>
    <div class="menu__rows">
      <a class="row-link" href="collection.html#tees">T-Shirts ${icon("arrow")}</a>
      <a class="row-link" href="collection.html#denim">Denim ${icon("arrow")}</a>
      <a class="row-link" href="collection.html#wishlist">Wishlist ${icon("arrow")}</a>
    </div>
    <div class="menu__foot">
      <a class="row-link" href="index.html#universe">Universe ${icon("arrow")}</a>
      <a class="row-link" href="#footer">Support ${icon("arrow")}</a>
    </div>
  </div>

  <div class="overlay" id="search" aria-label="Search">
    <form class="search-field" role="search" id="search-form">
      <button type="button" id="search-back" aria-label="Close search">${icon("back")}</button>
      <label class="sr-only" for="search-input">Search products</label>
      <input id="search-input" type="search" placeholder="Type to Search" autocomplete="off">
    </form>
    <div class="search__body">
      <div id="search-suggest">
        <p class="label-muted">Popular Searches</p>
        <ul class="popular">${D.products.map((p) => `<li><button type="button" data-q="${esc(p.name.replace(/ Navy$/, ""))}">${esc(p.name.replace(/ Navy$/, ""))}</button></li>`).join("")}</ul>
        <p class="label-muted">Recommended For You</p>
      </div>
      <div class="grid" id="search-results" style="margin-inline:calc(-1 * var(--gutter))"></div>
    </div>
  </div>

  <div class="scrim" id="scrim"></div>
  <aside class="drawer" id="bag" aria-label="Your bag" aria-hidden="true">
    <div class="drawer__head"><h2 class="drawer__title">Your Bag<sup data-bag-count></sup></h2><button class="icon-btn" id="bag-close" aria-label="Close bag">${icon("close")}</button></div>
    <div class="ship" id="ship"></div>
    <div class="drawer__items" id="bag-items"></div>
    <div class="drawer__foot" id="bag-foot"></div>
  </aside>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  const foot = $("#site-footer");
  if (foot) foot.outerHTML = `
  <footer class="footer" id="footer">
    <div class="footer__top">
      <div class="news">
        <h3 class="news__title">Join the <span class="script">Dream</span></h3>
        <p>New drops first. No spam.</p>
        <form id="news-form" novalidate>
          <label class="sr-only" for="news-email">Email address</label>
          <input class="news__field" id="news-email" type="email" placeholder="Email address" autocomplete="email" required>
          <label class="sr-only" for="news-year">Year of birth</label>
          <select class="news__field" id="news-year" required>
            <option value="">Year of birth</option>
            ${Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - i).map((y) => `<option>${y}</option>`).join("")}
          </select>
          <label class="consent" for="news-consent">
            <input id="news-consent" type="checkbox" required>
            <span>I agree to receive marketing emails from ${esc(D.business.name)} about drops and offers, about twice a month. Unsubscribe anytime with the link in every email.</span>
          </label>
          <button class="pill pill--ink" type="submit">Subscribe</button>
        </form>
        <div class="news__msg" id="news-msg" role="status"></div>
      </div>
      <div class="fcol"><h4>Shop</h4><ul>
        <li><a href="collection.html#all">New Arrivals</a></li>
        <li><a href="collection.html#tees">T-Shirts</a></li>
        <li><a href="collection.html#denim">Denim</a></li>
        <li><a href="collection.html#wishlist">Wishlist</a></li></ul></div>
      <div class="fcol"><h4>Help</h4><ul>
        <li><a href="#">Shipping</a></li>
        <li><a href="#">Returns &amp; Exchanges</a></li>
        <li><a href="#">Size Guide</a></li>
        <li><a href="#">Contact</a></li></ul></div>
      <div class="fcol"><h4>Universe</h4><ul>
        <li><a href="index.html#universe">About Dream</a></li>
        <li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>
        <li><a href="https://tiktok.com" target="_blank" rel="noopener">TikTok</a></li></ul></div>
    </div>
    <div class="footer__mark" aria-hidden="true">Dream<sup>®</sup>Studios</div>
    <div class="footer__legal"><span>© 2026 ${esc(D.business.name)}. All rights reserved.</span><span>${esc(D.business.address)} · ${esc(D.business.email)}</span><span>Prices in ${D.currency} · Taxes included</span></div>
  </footer>`;

  /* ---------- header behaviour ---------- */
  const header = $("#header");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    if (page === "home") header.classList.toggle("is-solid", y > 40);
    const overlayOpen = document.body.classList.contains("menu-open") || document.body.classList.contains("search-open");
    if (Math.abs(y - lastY) > 6) { header.classList.toggle("is-hidden", y > lastY && y > 240 && !overlayOpen); lastY = y; }
  };
  if (page !== "home") header.classList.add("is-solid");
  onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
  // Overlays open right under the header, wherever the page is scrolled.
  const placeOverlays = () => {
    header.classList.remove("is-hidden");
    const top = Math.max(0, header.getBoundingClientRect().bottom);
    $$(".overlay").forEach((o) => (o.style.paddingTop = `${top}px`));
  };

  const body = document.body;
  const menu = $("#menu"), search = $("#search"), menuBtn = $("#menu-btn"), searchBtn = $("#search-btn");
  function setMenu(open) {
    if (open) { setSearch(false); placeOverlays(); }
    menu.classList.toggle("is-open", open);
    body.classList.toggle("menu-open", open);
    body.classList.toggle("is-locked", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuBtn.innerHTML = icon(open ? "close" : "menu");
  }
  function setSearch(open) {
    if (open && menu.classList.contains("is-open")) setMenu(false);
    if (open) placeOverlays();
    search.classList.toggle("is-open", open);
    body.classList.toggle("search-open", open);
    body.classList.toggle("is-locked", open);
    searchBtn.setAttribute("aria-expanded", open);
    if (open) { renderSearch(""); setTimeout(() => $("#search-input").focus(), 60); }
  }
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  searchBtn.addEventListener("click", () => setSearch(!search.classList.contains("is-open")));
  $("[data-open-search]").addEventListener("click", () => setSearch(true));
  $("#search-back").addEventListener("click", () => setSearch(false));
  $$("#menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  function renderSearch(q) {
    const term = q.trim().toLowerCase();
    const hits = term ? D.products.filter((p) => `${p.name} ${p.line} ${D.categories[p.category]} ${p.color.name}`.toLowerCase().includes(term)) : D.products.slice(0, 4);
    $("#search-suggest").hidden = !!term;
    $("#search-results").innerHTML = hits.length ? hits.map(card).join("") :
      `<div class="empty" style="grid-column:1/-1">No products match “${esc(q)}”. Try “tee” or “denim”.</div>`;
  }
  $("#search-input").addEventListener("input", (e) => renderSearch(e.target.value));
  $("#search-form").addEventListener("submit", (e) => e.preventDefault());
  $$(".popular button").forEach((b) => b.addEventListener("click", () => { $("#search-input").value = b.dataset.q; renderSearch(b.dataset.q); }));

  /* ---------- bag ---------- */
  const drawer = $("#bag"), scrim = $("#scrim");
  function setBag(open) {
    drawer.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", !open);
    body.classList.toggle("is-locked", open);
    if (open) $("#bag-close").focus();
  }
  $("#bag-btn").addEventListener("click", () => setBag(true));
  $("#bag-close").addEventListener("click", () => setBag(false));
  scrim.addEventListener("click", () => setBag(false));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setBag(false); if (menu.classList.contains("is-open")) setMenu(false); if (search.classList.contains("is-open")) setSearch(false);
  });

  function saveBag() { store.set("dream.bag", bag); renderBag(); }
  function addToBag(id, size) {
    const line = bag.find((l) => l.id === id && l.size === size);
    if (line) line.qty += 1; else bag.push({ id, size, qty: 1 });
    saveBag();
  }
  let shownCount = null;
  function renderBag() {
    const count = bag.reduce((n, l) => n + l.qty, 0);
    const total = bag.reduce((n, l) => n + l.qty * byId(l.id).price, 0);
    $$("[data-bag-count]").forEach((el) => {
      if (shownCount !== null && count > shownCount) replay(el, "bump");
      el.textContent = count || "";
    });
    shownCount = count;
    const left = D.freeShippingFrom - total;
    $("#ship").innerHTML = (left > 0 ? `You're <strong>${money(left)}</strong> away from free shipping` : "You've unlocked <strong>free shipping</strong>") +
      `<div class="ship__track"><div class="ship__fill" style="width:${Math.min(100, (total / D.freeShippingFrom) * 100)}%"></div></div>`;
    $("#bag-items").innerHTML = bag.length ? bag.map((l, i) => {
      const p = byId(l.id);
      return `<div class="line-item">
        <a href="product.html#${p.id}"><img src="${IMG + p.images[0]}" alt="${esc(p.name)}" loading="lazy"></a>
        <div>
          <div class="line-item__top"><a class="line-item__name" href="product.html#${p.id}">${esc(p.name)}</a><span>${money(p.price * l.qty)}</span></div>
          <div class="line-item__meta">${esc(p.color.name)} · Size ${esc(l.size)}</div>
          <div class="line-item__bottom">
            <div class="qty"><button type="button" data-dec="${i}" aria-label="Decrease quantity">−</button><span>${l.qty}</span><button type="button" data-inc="${i}" aria-label="Increase quantity">+</button></div>
            <button type="button" class="link-btn" data-rm="${i}">Remove</button>
          </div>
        </div></div>`;
    }).join("") : `<div class="drawer__empty"><span>Your bag is empty.</span><a class="pill pill--ink" href="collection.html#all">Shop New Arrivals</a></div>`;
    $("#bag-foot").innerHTML = bag.length ? `<div class="drawer__total"><span>Subtotal</span><span>${money(total)}</span></div>
      <button class="pill pill--ink pill--block" type="button" id="checkout">Checkout</button>
      <p class="fine">Taxes included. Shipping calculated at checkout, free over ${money(D.freeShippingFrom)}. Free returns within 30 days of delivery, unworn with tags attached.</p>` : "";
    const co = $("#checkout");
    if (co) co.addEventListener("click", () => toast("Checkout opens with the store launch"));
  }
  $("#bag-items").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.inc) bag[+t.dataset.inc].qty++;
    else if (t.dataset.dec) { const l = bag[+t.dataset.dec]; l.qty--; if (!l.qty) bag.splice(+t.dataset.dec, 1); }
    else if (t.dataset.rm) bag.splice(+t.dataset.rm, 1);
    else return;
    saveBag();
  });

  /* ---------- wishlist ---------- */
  function toggleFav(id) {
    favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    store.set("dream.favs", favs);
    renderFavs();
    if (favs.includes(id)) $$(`[data-fav="${id}"]`).forEach((b) => replay(b, "pop"));
    toast(favs.includes(id) ? "Saved to wishlist" : "Removed from wishlist");
    document.dispatchEvent(new CustomEvent("favs:change"));
  }
  function renderFavs() {
    $$("[data-fav-count]").forEach((el) => (el.textContent = favs.length || ""));
    $$("[data-fav]").forEach((b) => b.setAttribute("aria-pressed", favs.includes(b.dataset.fav)));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault(); toggleFav(b.dataset.fav);
  });

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
  }

  /* ---------- product card ---------- */
  function card(p) {
    const [a, b] = p.images;
    const imgs = b
      ? `<img src="${IMG + a}" alt="${esc(p.name)}" loading="lazy"><img class="alt" src="${IMG + b}" alt="" loading="lazy">`
      : `<img class="solo" src="${IMG + a}" alt="${esc(p.name)}" loading="lazy">`;
    return `<article class="card">
      <a href="product.html#${p.id}" data-pid="${p.id}">
        <div class="card__media">${imgs}${p.tag ? `<span class="card__tag">${esc(p.tag)}</span>` : ""}</div>
        <div class="card__info">
          <span class="card__name">${esc(p.name)}</span>
          <span class="card__price">${money(p.price)}</span>
          <span class="swatches"><span class="swatch is-active" style="background:${p.color.hex}" title="${esc(p.color.name)}"></span></span>
        </div>
      </a>
      <button class="card__fav" type="button" data-fav="${p.id}" aria-pressed="${favs.includes(p.id)}" aria-label="Save ${esc(p.name)} to wishlist">${icon("heart")}</button>
    </article>`;
  }
  // Remember the product a card links to, in case the host drops the URL hash.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='product.html#']");
    if (!a) return;
    try { sessionStorage.setItem("dream.pid", a.getAttribute("href").split("#")[1]); } catch (err) { /* ignore */ }
    // Name the clicked image so the browser morphs it into the product page gallery.
    const img = a.querySelector(".card__media img");
    if (img) { $$("img").forEach((i) => (i.style.viewTransitionName = "")); img.style.viewTransitionName = "pdp-image"; }
  });
  window.addEventListener("pageshow", () => $$(".card__media img").forEach((i) => (i.style.viewTransitionName = "")));

  /* ---------- motion helpers ---------- */
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // Scroll reveal: content rises in as it enters the viewport. Skipped for reduced motion.
  const io = !reduceMotion && "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.12 }) : null;
  function reveal(els) {
    if (!io) return;
    let row = 0, lastTop = null;
    els.forEach((el) => {
      if (el.classList.contains("is-in")) return;
      const t = el.getBoundingClientRect().top;
      row = t === lastTop ? row + 1 : 0; lastTop = t;
      el.style.setProperty("--d", `${Math.min(row, 5) * 70}ms`);
      el.classList.add("reveal"); io.observe(el);
    });
  }

  function bindRailNav(scope) {
    $$("[data-rail-prev], [data-rail-next]", scope).forEach((btn) => btn.addEventListener("click", () => {
      const rail = document.getElementById(btn.dataset.railPrev || btn.dataset.railNext);
      rail.scrollBy({ left: (btn.dataset.railNext ? 1 : -1) * rail.clientWidth * 0.75, behavior: "smooth" });
    }));
  }

  /* ---------- pages ---------- */
  function initHome() {
    $("#rail-new").innerHTML = D.products.filter((p) => p.tag === "New").concat(D.products.filter((p) => p.tag !== "New")).map(card).join("");
    $("#rail-wanted").innerHTML = [...D.products].reverse().map(card).join("");
    $$("[data-count]").forEach((el) => (el.textContent = D.products.length));
    reveal($$(".section__head, .rail .card, .tile, .campaign > *, .story > div > *"));
    bindRailNav(document);
  }

  function initCollection() {
    const tabs = [["all", "View All"], ["tees", "T-Shirts"], ["denim", "Denim"], ["wishlist", "Wishlist"]];
    let state = { cat: "all", line: "all", sort: "featured" };
    const read = () => { const h = location.hash.slice(1); state.cat = tabs.some((t) => t[0] === h) ? h : "all"; state.line = "all"; };

    function render() {
      $("#tabs").innerHTML = tabs.map(([k, label]) => `<a href="#${k}" aria-current="${state.cat === k}" class="${state.cat === k ? "dot" : ""}">${label}</a>`).join("");
      let list = state.cat === "wishlist" ? D.products.filter((p) => favs.includes(p.id))
        : D.products.filter((p) => state.cat === "all" || p.category === state.cat);
      const lines = [...new Set(list.map((p) => p.line))];
      if (state.line !== "all") list = list.filter((p) => p.line === state.line);
      if (state.sort === "low") list = [...list].sort((a, b) => a.price - b.price);
      if (state.sort === "high") list = [...list].sort((a, b) => b.price - a.price);
      if (state.sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

      const title = state.cat === "all" ? "New Arrivals" : tabs.find((t) => t[0] === state.cat)[1];
      $("#coll-title").innerHTML = `${title}<sup>${list.length}</sup>`;
      document.title = `${title} | Dream Studios`;
      $("#chips").innerHTML = lines.length > 1 ? [["all", "View All"], ...lines.map((l) => [l, l])].map(([k, label]) =>
        `<button type="button" data-line="${esc(k)}" aria-pressed="${state.line === k}" class="${state.line === k ? "dot" : ""}">${esc(label)}</button>`).join("") : "";
      $("#chips").hidden = lines.length <= 1;
      $("#grid").innerHTML = list.map(card).join("");
      reveal($$("#grid .card"));
      $("#empty").hidden = list.length > 0;
      $("#empty-msg").textContent = state.cat === "wishlist" ? "Your wishlist is empty. Tap the heart on any product to save it here." : "Nothing here yet. New pieces drop soon.";
    }
    $("#chips").addEventListener("click", (e) => { const b = e.target.closest("[data-line]"); if (b) { state.line = b.dataset.line; render(); } });
    $("#filter-btn").addEventListener("click", () => { const p = $("#sort-panel"); p.hidden = !p.hidden; $("#filter-btn").setAttribute("aria-expanded", !p.hidden); });
    $$("#sort-panel input").forEach((r) => r.addEventListener("change", () => { state.sort = r.value; render(); }));
    window.addEventListener("hashchange", () => { read(); render(); window.scrollTo({ top: 0 }); });
    document.addEventListener("favs:change", () => { if (state.cat === "wishlist") render(); });
    read(); render();
  }

  function initProduct() {
    let id = location.hash.slice(1);
    if (!byId(id)) { try { id = sessionStorage.getItem("dream.pid"); } catch (e) { id = null; } }
    const p = byId(id) || D.products[0];
    document.title = `${p.name} | Dream Studios`;
    const sizeRows = p.category === "denim"
      ? [["Waist", "28", "30", "32", "34", "36"], ["Waist (cm)", "72", "77", "82", "87", "92"], ["Length (cm)", "54", "55", "56", "57", "58"]]
      : [["Size", "XS", "S", "M", "L", "XL", "XXL"], ["Chest (cm)", "56", "59", "62", "65", "68", "71"], ["Length (cm)", "67", "69", "71", "73", "75", "77"]];

    $("#pdp").innerHTML = `
      <div class="gallery-wrap">
        <div class="gallery" id="gallery">${p.images.map((src, i) => `<figure><img src="${IMG + src}" alt="${esc(p.name)}, view ${i + 1}" ${i ? 'loading="lazy"' : 'style="view-transition-name:pdp-image"'}></figure>`).join("")}</div>
        ${p.images.length > 1 ? `<span class="gallery-count" id="gallery-count">1 / ${p.images.length}</span>` : ""}
      </div>
      <div class="buy"><div class="buy__inner">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="collection.html#all">Shop</a><span>/</span><a href="collection.html#${p.category}">${D.categories[p.category]}</a><span>/</span><span>${esc(p.line)}</span></nav>
        <h1 class="buy__name">${esc(p.name)}</h1>
        <div class="buy__price">${money(p.price)}</div>
        <div class="buy__tax">Taxes included.</div>
        <div class="opt">
          <div class="opt__label">Colour <span>${esc(p.color.name)}</span></div>
          <div class="swatches" style="margin:0"><span class="swatch is-active" style="background:${p.color.hex};width:22px;height:22px" title="${esc(p.color.name)}"></span></div>
        </div>
        <div class="opt">
          <div class="opt__label">Size <button type="button" class="link-btn" id="size-guide-btn">Size Guide</button></div>
          <div class="sizes" id="sizes" role="group" aria-label="Choose a size">${p.sizes.map((s) => `<button type="button" aria-pressed="false" data-size="${s}">${s}</button>`).join("")}</div>
        </div>
        <div class="buy__cta">
          <div class="buy__row">
            <button class="pill pill--ink pill--block" type="button" id="add">Add to Bag · ${money(p.price)}</button>
            <button class="fav-btn" type="button" data-fav="${p.id}" aria-pressed="${favs.includes(p.id)}" aria-label="Save to wishlist">${icon("heart")}</button>
          </div>
          <p class="buy__msg" id="buy-msg" role="status"></p>
          <p class="fine">Taxes included. Free shipping over ${money(D.freeShippingFrom)}. Free returns within 30 days of delivery, unworn with tags attached.</p>
        </div>
        <div class="acc">
          <details open><summary>Description ${icon("plus")}</summary><div class="acc__body"><p>${esc(p.description)}</p></div></details>
          <details><summary>Details &amp; Fit ${icon("plus")}</summary><div class="acc__body"><ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div></details>
          <details id="size-guide"><summary>Size Guide ${icon("plus")}</summary><div class="acc__body"><div class="table-scroll"><table class="size-table">
            ${sizeRows.map((r, i) => `<tr>${r.map((c) => (i ? "<td>" : "<th>") + c + (i ? "</td>" : "</th>")).join("")}</tr>`).join("")}
          </table></div><p style="margin-top:10px">Measured flat. For a less oversized look, size down.</p></div></details>
          <details><summary>Shipping &amp; Returns ${icon("plus")}</summary><div class="acc__body"><p>Free shipping on orders over ${money(D.freeShippingFrom)}. Returns and exchanges within 30 days of delivery, unworn with tags attached.</p></div></details>
        </div>
      </div></div>`;

    let size = null;
    $("#sizes").addEventListener("click", (e) => {
      const b = e.target.closest("[data-size]"); if (!b) return;
      size = b.dataset.size;
      $$("#sizes button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      $("#buy-msg").textContent = "";
    });
    $("#add").addEventListener("click", () => {
      if (!size) { $("#buy-msg").textContent = "Choose a size to add this to your bag."; return; }
      addToBag(p.id, size); setBag(true);
    });
    $("#size-guide-btn").addEventListener("click", () => { const d = $("#size-guide"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); });
    const g = $("#gallery"), gc = $("#gallery-count");
    if (gc) g.addEventListener("scroll", () => { gc.textContent = `${Math.round(g.scrollLeft / g.clientWidth) + 1} / ${p.images.length}`; }, { passive: true });

    $("#rail-related").innerHTML = D.products.filter((x) => x.id !== p.id).map(card).join("");
    reveal($$(".section__head, #rail-related .card"));
    bindRailNav(document);
    window.addEventListener("hashchange", () => { if (byId(location.hash.slice(1))) location.reload(); });
  }

  /* ---------- newsletter ---------- */
  const nf = $("#news-form");
  if (nf) nf.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#news-msg");
    const v = $("#news-email").value.trim();
    const year = +$("#news-year").value;
    let blocked = false;
    try { blocked = sessionStorage.getItem("dream.underage") === "1"; } catch (err) { /* ignore */ }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msg.textContent = "Enter a valid email address, like name@example.com."; return; }
    if (!year) { msg.textContent = "Choose your year of birth."; return; }
    // Neutral age screen: the cut-off isn't shown up front, and a rejected visitor can't retry this session.
    if (blocked || new Date().getFullYear() - year < D.newsletterMinAge) {
      try { sessionStorage.setItem("dream.underage", "1"); } catch (err) { /* ignore */ }
      msg.textContent = `Sorry, you need to be ${D.newsletterMinAge} or older to join the newsletter.`;
      nf.querySelectorAll("input, select, button").forEach((el) => (el.disabled = true));
      return;
    }
    if (!$("#news-consent").checked) { msg.textContent = "Tick the box to agree to marketing emails."; return; }
    msg.textContent = "You're on the list. See you at the next drop.";
  });

  if (page === "home") initHome();
  if (page === "collection") initCollection();
  if (page === "product") initProduct();
  renderBag(); renderFavs();
  reveal($$(".footer__top > *"));
})();
