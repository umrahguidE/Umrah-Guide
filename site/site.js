// Guided Umrah — landing site motion. Plain JS, no libraries.
// Everything here is decoration on top of a page that already works without it.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ── Reveal on scroll, staggered within each parent ──
  const reveals = [...document.querySelectorAll('.reveal')];
  const groups = new Map();
  for (const el of reveals) {
    const list = groups.get(el.parentElement) ?? [];
    el.style.setProperty('--d', `${Math.min(list.length, 6) * 0.08}s`);
    list.push(el);
    groups.set(el.parentElement, list);
  }
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  }

  // ── Nav glass + scroll progress + active section ──
  const nav = document.querySelector('[data-nav]');
  const links = [...document.querySelectorAll('.nav-links a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    const max = document.body.scrollHeight - innerHeight;
    root.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
    let active = -1;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) active = i; });
    links.forEach((a, i) => a.classList.toggle('is-active', i === active));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // ── Cursor glow, phone tilt, floating chip parallax, magnetic buttons ──
  if (finePointer && !reduce) {
    const glow = document.querySelector('.cursor-glow');
    const phone = document.querySelector('[data-tilt]');
    const chips = [...document.querySelectorAll('[data-depth]')];
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my, raf = 0;
    const loop = () => {
      gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
      glow.style.setProperty('--cx', `${gx}px`); glow.style.setProperty('--cy', `${gy}px`);
      const nx = (mx / innerWidth - 0.5), ny = (my / innerHeight - 0.5);
      if (phone && scrollY < innerHeight) phone.style.transform = `rotateY(${nx * 14}deg) rotateX(${-ny * 10}deg)`;
      chips.forEach((c) => { const d = +c.dataset.depth; c.style.transform = `translate3d(${nx * d}px, ${ny * d}px, 0)`; });
      raf = Math.abs(mx - gx) + Math.abs(my - gy) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });

    for (const b of document.querySelectorAll('.magnetic')) {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    }

    for (const t of document.querySelectorAll('[data-glow]')) {
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${e.clientX - r.left}px`);
        t.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
  }

  // ── Sticky story: the phone shows the step being read ──
  const steps = [...document.querySelectorAll('.story-step')];
  const imgs = [...document.querySelectorAll('.story-img')];
  const dots = [...document.querySelectorAll('.story-dots li')];
  const setStep = (n) => {
    imgs.forEach((im) => im.classList.toggle('is-on', +im.dataset.step === n));
    dots.forEach((d, i) => d.classList.toggle('is-on', i === n));
    steps.forEach((s) => s.classList.toggle('is-on', +s.dataset.step === n));
  };
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setStep(+e.target.dataset.step);
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => so.observe(s));
  }
  setStep(0);

  // ── The counter demo: confirm seven rounds ──
  const demo = document.querySelector('[data-demo]');
  if (demo) {
    const total = 7;
    let done = 0;
    const n = demo.querySelector('[data-demo-n]');
    const label = demo.querySelector('[data-demo-label]');
    const btn = demo.querySelector('[data-demo-btn]');
    const reset = demo.querySelector('[data-demo-reset]');
    const fill = demo.querySelector('[data-demo-fill]');
    const ds = [...demo.querySelectorAll('[data-demo-dots] li')];
    const render = (animate) => {
      const finished = done >= total;
      const current = Math.min(done + 1, total);
      fill.style.setProperty('--done', done);
      fill.style.opacity = done ? 1 : 0;
      demo.classList.toggle('is-final', current === total && !finished);
      demo.classList.toggle('is-done', finished);
      label.textContent = finished ? 'Tawaf' : 'Round';
      n.textContent = finished ? 'complete' : String(current);
      if (animate && !reduce) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
      ds.forEach((d, i) => { d.classList.toggle('is-done', i < done); d.classList.toggle('is-current', i === done && !finished); });
      btn.textContent = finished ? '✓ All 7 rounds confirmed' : `✓ Confirm Round ${current} complete`;
      btn.disabled = finished;
    };
    btn.addEventListener('click', () => {
      if (done >= total) return;
      done += 1;
      if (navigator.vibrate) navigator.vibrate(18);
      render(true);
    });
    reset.addEventListener('click', () => { done = 0; render(true); });
    render(false);
  }

  // ── "Guided Umrah" in every language ──
  const word = document.querySelector('[data-lang-word]');
  const langs = [...document.querySelectorAll('.lang-grid li')];
  if (word && langs.length) {
    let i = 0, timer = 0;
    const show = (k) => {
      i = k;
      langs.forEach((l, j) => l.classList.toggle('is-on', j === k));
      if (reduce) { word.textContent = langs[k].dataset.name; word.dir = langs[k].hasAttribute('data-rtl') ? 'rtl' : 'ltr'; return; }
      word.classList.add('is-out');
      setTimeout(() => {
        word.textContent = langs[k].dataset.name;
        word.dir = langs[k].hasAttribute('data-rtl') ? 'rtl' : 'ltr';
        word.classList.remove('is-out');
      }, 380);
    };
    const start = () => { clearInterval(timer); timer = setInterval(() => show((i + 1) % langs.length), 2200); };
    langs.forEach((l, k) => l.addEventListener('pointerenter', () => { show(k); start(); }));
    show(0);
    if (!reduce) start();
  }
})();
