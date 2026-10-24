(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const wide = matchMedia("(min-width: 1100px)");
  const CATEGORY = { sport: "ספורט", party: "מסיבות", event: "אירועים", portrait: "פורטרטים", street: "רחוב" };

  /* ---------- Header: solid once the hero is behind it ---------- */
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  if (header && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      header.classList.toggle("is-solid", !entry.isIntersecting);
    }, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` }).observe(hero);
  } else if (header) {
    header.classList.add("is-solid");
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.querySelector(".menu-toggle__label").textContent = open ? "סגירה" : "תפריט";
    header.classList.toggle("menu-open", open);
  };
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); }
    });
  }

  /* ---------- Hero slideshow ---------- */
  const slides = [...document.querySelectorAll(".hero__slide")];
  let current = 0;
  let heroTimer = 0;
  let heroVisible = true;
  const hydrateSlide = (slide) => {
    slide.querySelectorAll("[data-srcset]").forEach((el) => {
      el.srcset = el.dataset.srcset;
      el.removeAttribute("data-srcset");
    });
  };
  const scheduleHero = () => {
    clearTimeout(heroTimer);
    if (slides.length < 2 || reduceMotion.matches || !heroVisible || document.hidden) return;
    heroTimer = setTimeout(async () => {
      const next = (current + 1) % slides.length;
      hydrateSlide(slides[next]);
      const img = slides[next].querySelector("img");
      try { await img.decode(); } catch (_) { /* show it anyway */ }
      slides[current].classList.remove("is-active");
      slides[next].classList.add("is-active");
      current = next;
      scheduleHero();
    }, 5200);
  };
  if (slides.length > 1) {
    window.addEventListener("load", () => setTimeout(() => slides.slice(1).forEach(hydrateSlide), 600), { once: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; scheduleHero(); }).observe(hero);
    }
    document.addEventListener("visibilitychange", scheduleHero);
    reduceMotion.addEventListener("change", scheduleHero);
    scheduleHero();
  }

  /* ---------- Reveal on scroll ---------- */
  const revealables = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Gallery: masonry + filters ---------- */
  const gallery = document.querySelector(".gallery");
  const tiles = gallery ? [...gallery.querySelectorAll(".tile")] : [];
  const chips = [...document.querySelectorAll(".chip")];
  let filter = "all";
  let visibleTiles = tiles;

  tiles.forEach((tile) => {
    const img = tile.querySelector("img");
    const done = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }
  });

  const layout = () => {
    if (!gallery) return;
    const count = wide.matches ? 3 : 2;
    visibleTiles = tiles.filter((t) => filter === "all" || t.dataset.cat === filter);
    const cols = Array.from({ length: count }, () => {
      const col = document.createElement("div");
      col.className = "gallery__col";
      return col;
    });
    const heights = new Array(count).fill(0);
    visibleTiles.forEach((tile) => {
      const shortest = heights.indexOf(Math.min(...heights));
      cols[shortest].appendChild(tile);
      heights[shortest] += Number(tile.dataset.h) / Number(tile.dataset.w) + 0.03;
    });
    gallery.style.setProperty("--cols", count);
    gallery.replaceChildren(...cols);
    gallery.classList.add("is-masonry");
  };

  const applyFilter = (value) => {
    if (value === filter) return;
    filter = value;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === value)));
    if (reduceMotion.matches) { layout(); return; }
    gallery.classList.add("is-switching");
    setTimeout(() => {
      layout();
      requestAnimationFrame(() => gallery.classList.remove("is-switching"));
    }, 220);
  };

  if (gallery) {
    layout();
    wide.addEventListener("change", layout);
    chips.forEach((chip) => chip.addEventListener("click", () => applyFilter(chip.dataset.filter)));
  }

  /* ---------- Shared dialog helpers ---------- */
  let lastOpener = null;
  const openDialog = (dialog, opener) => {
    lastOpener = opener;
    root.classList.add("is-locked");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  const closeDialog = (dialog) => {
    if (typeof dialog.close === "function") dialog.close();
    else { dialog.removeAttribute("open"); dialog.dispatchEvent(new Event("close")); }
  };
  const onClosed = () => {
    root.classList.remove("is-locked");
    if (lastOpener) lastOpener.focus({ preventScroll: true });
  };

  /* ---------- Lightbox ---------- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox && tiles.length) {
    const stage = lightbox.querySelector(".viewer__stage");
    const lbImg = stage.querySelector("img");
    const lbCaption = lightbox.querySelector(".viewer__caption");
    const lbCat = lightbox.querySelector(".viewer__cat");
    const lbCount = lightbox.querySelector(".viewer__count");
    let index = 0;
    let token = 0;

    const show = (i) => {
      index = (i + visibleTiles.length) % visibleTiles.length;
      const tile = visibleTiles[index];
      const thumb = tile.querySelector("img");
      const my = ++token;
      lbImg.alt = thumb.alt;
      lbImg.width = Number(tile.dataset.w);
      lbImg.height = Number(tile.dataset.h);
      // Show the already-loaded thumbnail at once, then swap in the large file.
      lbImg.src = thumb.currentSrc || thumb.src;
      const full = new Image();
      full.decoding = "async";
      full.src = tile.dataset.full;
      full.decode().then(() => { if (my === token) lbImg.src = full.src; }).catch(() => {});
      lbCaption.textContent = thumb.alt;
      lbCat.textContent = CATEGORY[tile.dataset.cat] || "";
      lbCount.textContent = `${index + 1} / ${visibleTiles.length}`;
      [1, -1].forEach((d) => {
        const n = visibleTiles[(index + d + visibleTiles.length) % visibleTiles.length];
        if (n) { const pre = new Image(); pre.src = n.dataset.full; }
      });
    };
    // RTL: "next" sits on the left.
    const next = () => show(index + 1);
    const prev = () => show(index - 1);

    gallery.addEventListener("click", (e) => {
      const btn = e.target.closest(".tile__btn");
      if (!btn) return;
      show(visibleTiles.indexOf(btn.closest(".tile")));
      openDialog(lightbox, btn);
    });
    lightbox.querySelector(".viewer__next").addEventListener("click", next);
    lightbox.querySelector(".viewer__prev").addEventListener("click", prev);
    lightbox.querySelector(".viewer__close").addEventListener("click", () => closeDialog(lightbox));
    lightbox.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); next(); }
      if (e.key === "ArrowRight") { e.preventDefault(); prev(); }
    });
    stage.addEventListener("click", (e) => { if (e.target === stage) closeDialog(lightbox); });
    lightbox.addEventListener("close", onClosed);

    let startX = 0;
    let startY = 0;
    stage.addEventListener("pointerdown", (e) => { startX = e.clientX; startY = e.clientY; });
    stage.addEventListener("pointerup", (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) next(); else prev();
    });
  }

  /* ---------- Video previews ---------- */
  const vtiles = [...document.querySelectorAll(".vtile")];
  const playPreview = (tile) => {
    if (reduceMotion.matches) return;
    const video = tile.querySelector("video");
    if (!video.src) video.src = video.dataset.src;
    const p = video.play();
    if (p) p.then(() => tile.classList.add("is-playing")).catch(() => {});
  };
  const stopPreview = (tile) => {
    const video = tile.querySelector("video");
    tile.classList.remove("is-playing");
    if (!video.paused) video.pause();
  };
  const stopAllPreviews = () => vtiles.forEach(stopPreview);

  if ("IntersectionObserver" in window) {
    const autoplayIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) playPreview(entry.target);
        else stopPreview(entry.target);
      });
    }, { threshold: [0, 0.6] });
    vtiles.forEach((tile) => {
      const featured = tile.closest(".vfeature");
      if (featured || !finePointer.matches) autoplayIO.observe(tile);
      if (!featured && finePointer.matches) {
        tile.addEventListener("mouseenter", () => playPreview(tile));
        tile.addEventListener("mouseleave", () => stopPreview(tile));
        tile.addEventListener("focus", () => playPreview(tile));
        tile.addEventListener("blur", () => stopPreview(tile));
      }
    });
  }

  /* ---------- Video player ---------- */
  const player = document.getElementById("player");
  if (player && vtiles.length) {
    const video = player.querySelector("video");
    const caption = player.querySelector(".viewer__caption");
    const meta = player.querySelector(".viewer__meta");
    vtiles.forEach((tile) => {
      tile.addEventListener("click", () => {
        stopAllPreviews();
        video.poster = tile.querySelector("img").currentSrc || "";
        video.src = tile.dataset.full;
        caption.textContent = tile.dataset.title;
        meta.textContent = tile.dataset.meta;
        openDialog(player, tile);
        const p = video.play();
        if (p) p.catch(() => {});
      });
    });
    player.querySelector(".viewer__close").addEventListener("click", () => closeDialog(player));
    player.querySelector(".viewer__stage").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeDialog(player);
    });
    player.addEventListener("close", () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      onClosed();
    });
  }
})();
