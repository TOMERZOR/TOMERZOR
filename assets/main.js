// Whatsupphone landing page: small progressive enhancements, no dependencies.
(() => {
  const root = document.documentElement;

  // Hero entrance starts once fonts are ready so the headline does not reflow mid-animation.
  const start = () => requestAnimationFrame(() => root.classList.add('is-loaded'));
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(start);
  } else {
    start();
  }

  // Reveal sections as they enter. The phone rig also uses this when scroll timelines are unsupported.
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  document.querySelectorAll('.reveal, .rig').forEach(el => reveal.observe(el));

  // Mobile dock steps aside while the hero or closing call already show the same buttons.
  const dock = document.querySelector('.dock');
  const ctaZones = document.querySelectorAll('.hero, .closer');
  if (dock && ctaZones.length) {
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      dock.classList.toggle('is-hidden', visible.size > 0);
    }, { threshold: 0.25 });
    ctaZones.forEach(z => io.observe(z));
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
