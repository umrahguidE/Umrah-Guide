// 3D Canvas, Orbiting Particles, Kaaba Projection, and Scroll Animation Engine.
// Ultra-lightweight, 100% offline-ready, dependency-free 3D rendering pipeline.

export class ThreeDExperience {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // Camera & Scene state
    this.camera = {
      rotX: 0.38,
      rotY: -0.65,
      targetRotX: 0.38,
      targetRotY: -0.65,
      zoom: 1,
      targetZoom: 1,
      distance: 520,
      panY: 0,
    };

    // Interaction state
    this.isDragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.pointerVelocity = { x: 0, y: 0 };
    this.lastScrollY = 0;
    this.scrollY = 0;
    this.targetScrollY = 0;
    this.scrollProgress = 0;

    // Dynamic objects
    this.particles = [];
    this.orbitPilgrims = [];
    this.stars = [];
    this.stageKind = 'home'; // 'home', 'tawaf', 'sai', 'complete', etc.
    this.activeRound = 1;

    this.initParticles();
    this.initOrbitPilgrims();
    this.initStars();
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1000 - 200,
        z: (Math.random() - 0.5) * 800 - 100,
        size: Math.random() * 2 + 0.8,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulsePhase: Math.random() * Math.PI * 2,
        gold: Math.random() > 0.4,
      });
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 45; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 700,
        y: Math.random() * 300 - 150,
        z: (Math.random() - 0.5) * 700,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.4,
        vz: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.6 + 0.2,
        life: Math.random() * 100,
        maxLife: 80 + Math.random() * 120,
      });
    }
  }

  initOrbitPilgrims() {
    this.orbitPilgrims = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const radius = 110 + (i % 5) * 22 + Math.random() * 12;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 0.008 + (0.005 / (radius / 100));
      this.orbitPilgrims.push({
        radius,
        angle,
        speed,
        y: (Math.random() - 0.5) * 6,
        size: Math.random() * 2.2 + 1.2,
        hue: i % 3 === 0 ? 'gold' : 'white',
      });
    }
  }

  mount(container) {
    if (!container) return;
    this.container = container;

    // Create or reuse canvas
    let canvas = container.querySelector('.scene-3d-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'scene-3d-canvas';
      container.appendChild(canvas);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });

    this.bindEvents();
    this.resize();
    this.start();
    this.initScrollAndTiltEngine();
  }

  bindEvents() {
    this.handleResize = () => this.resize();
    window.addEventListener('resize', this.handleResize, { passive: true });

    this.handleScroll = () => {
      this.targetScrollY = window.scrollY || window.pageYOffset || 0;
      const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      this.scrollProgress = Math.min(1, Math.max(0, this.targetScrollY / docHeight));
    };
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Pointer controls for 3D Kaaba
    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', (e) => {
        this.isDragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.canvas.setPointerCapture?.(e.pointerId);
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.camera.targetRotY += dx * 0.007;
        this.camera.targetRotX = Math.max(-0.2, Math.min(1.1, this.camera.targetRotX + dy * 0.007));
        this.lastPointer = { x: e.clientX, y: e.clientY };
      });

      const stopDrag = () => {
        this.isDragging = false;
      };
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);
    }
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || 320;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.ctx) {
      this.ctx.scale(this.dpr, this.dpr);
    }
  }

  setStage(stage, n = 1) {
    this.stageKind = stage;
    this.activeRound = n;
  }

  start() {
    if (this.animId) return;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(64, now - lastTime) / 1000;
      lastTime = now;
      this.update(dt, now);
      this.render(now);
      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  update(dt, now) {
    // Smooth scroll interpolation
    this.scrollY += (this.targetScrollY - this.scrollY) * 0.1;

    // Scroll-driven camera orientation
    const scrollAngle = this.scrollY * 0.0018;
    const scrollTilt = Math.sin(this.scrollProgress * Math.PI) * 0.25;

    // Auto-rotation when not dragging
    if (!this.isDragging) {
      this.camera.targetRotY += dt * 0.15;
    }

    // Smooth camera damping
    this.camera.rotX += (this.camera.targetRotX + scrollTilt - this.camera.rotX) * 0.08;
    this.camera.rotY += (this.camera.targetRotY + scrollAngle * 0.3 - this.camera.rotY) * 0.08;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.08;

    // Update orbiting pilgrims
    for (const p of this.orbitPilgrims) {
      p.angle -= p.speed * (dt * 60);
      if (p.angle < 0) p.angle += Math.PI * 2;
    }

    // Update floating ambient particles
    for (const pt of this.particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.z += pt.vz;
      pt.life += dt * 30;
      if (pt.life > pt.maxLife || pt.y < -160) {
        pt.life = 0;
        pt.y = 120 + Math.random() * 40;
        pt.x = (Math.random() - 0.5) * 500;
        pt.z = (Math.random() - 0.5) * 500;
      }
    }
  }

  // 3D Point Projection to 2D Screen Coordinates
  project(x, y, z, cx, cy) {
    // Rotate Y
    const cosY = Math.cos(this.camera.rotY);
    const sinY = Math.sin(this.camera.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Rotate X
    const cosX = Math.cos(this.camera.rotX);
    const sinX = Math.sin(this.camera.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Perspective divide
    const dist = this.camera.distance;
    const depth = dist + z2;
    if (depth <= 10) return { x: 0, y: 0, scale: 0, z: z2, visible: false };

    const scale = (dist / depth) * this.camera.zoom;
    return {
      x: cx + x1 * scale,
      y: cy + y2 * scale,
      scale,
      z: z2,
      visible: true,
    };
  }

  render(now) {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2 + 15;

    ctx.clearRect(0, 0, w, h);

    // Render Ambient Starlight / Sacred Constellations
    this.renderStars(ctx, cx, cy, now);

    // Render Ground / Mataf Rings
    this.renderMataf(ctx, cx, cy);

    // Render Orbiting Tawaf Particles (Behind Kaaba)
    this.renderPilgrims(ctx, cx, cy, true);

    // Render 3D Kaaba Architecture
    this.renderKaaba(ctx, cx, cy, now);

    // Render Orbiting Tawaf Particles (In Front of Kaaba)
    this.renderPilgrims(ctx, cx, cy, false);

    // Render Floating Aura / Golden Dust
    this.renderParticles(ctx, cx, cy);
  }

  renderStars(ctx, cx, cy, now) {
    for (const s of this.stars) {
      const p = this.project(s.x, s.y, s.z, cx, cy);
      if (!p.visible) continue;
      const alpha = 0.3 + 0.4 * Math.sin(now * s.pulseSpeed + s.pulsePhase);
      ctx.fillStyle = s.gold ? `rgba(245, 218, 122, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, s.size * p.scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderMataf(ctx, cx, cy) {
    // Draw concentric glowing marble rings
    const rings = [90, 130, 170, 210];
    ctx.lineWidth = 1.2;

    rings.forEach((r, idx) => {
      ctx.beginPath();
      let first = true;
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const p = this.project(x, 48, z, cx, cy);
        if (!p.visible) continue;
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = idx === 0 ? 'rgba(212, 175, 55, 0.45)' : 'rgba(52, 178, 122, 0.18)';
      ctx.stroke();
    });

    // Green Starting Line indicator towards Black Stone corner
    const startP1 = this.project(40, 48, 40, cx, cy);
    const startP2 = this.project(180, 48, 180, cx, cy);
    if (startP1.visible && startP2.visible) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startP1.x, startP1.y);
      ctx.lineTo(startP2.x, startP2.y);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Semi-circular Hijr Ismail (Hateem)
    ctx.beginPath();
    let firstH = true;
    for (let i = 0; i <= 16; i++) {
      const theta = Math.PI * 0.75 + (i / 16) * Math.PI * 0.8;
      const x = Math.cos(theta) * 62 - 15;
      const z = Math.sin(theta) * 62 - 15;
      const p = this.project(x, 48, z, cx, cy);
      if (!p.visible) continue;
      if (firstH) {
        ctx.moveTo(p.x, p.y);
        firstH = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  renderKaaba(ctx, cx, cy, now) {
    // Kaaba dimensions
    const sx = 40; // half width
    const sy = 48; // half height
    const sz = 40; // half depth

    // 8 Vertices of the 3D Kaaba Box
    // Center is (0, 0, 0) in model space; ground is at y = 48
    const rawVertices = [
      [-sx, -sy, -sz], // 0: Top NW
      [sx, -sy, -sz],  // 1: Top NE
      [sx, -sy, sz],   // 2: Top SE (Black Stone corner)
      [-sx, -sy, sz],  // 3: Top SW (Yemeni corner)
      [-sx, sy, -sz],  // 4: Bottom NW
      [sx, sy, -sz],   // 5: Bottom NE
      [sx, sy, sz],    // 6: Bottom SE
      [-sx, sy, sz],   // 7: Bottom SW
    ];

    // Project all vertices
    const projected = rawVertices.map((v) => this.project(v[0], v[1], v[2], cx, cy));

    // Define 6 Quad Faces with normal and styling details
    const faces = [
      { indices: [0, 1, 2, 3], name: 'roof', color: '#181b1a', isRoof: true },
      { indices: [3, 2, 6, 7], name: 'south', color: '#0d100e', hasDoor: false, hasCorner: true }, // South/East facing
      { indices: [2, 1, 5, 6], name: 'east', color: '#131715', hasDoor: true },                    // East: Bab al-Kaaba
      { indices: [1, 0, 4, 5], name: 'north', color: '#0a0d0c', hasMizab: true },
      { indices: [0, 3, 7, 4], name: 'west', color: '#111413' },
    ];

    // Calculate face average Z for Painter's Algorithm sorting (back to front)
    faces.forEach((face) => {
      let sumZ = 0;
      let valid = 0;
      face.indices.forEach((idx) => {
        if (projected[idx].visible) {
          sumZ += projected[idx].z;
          valid++;
        }
      });
      face.avgZ = valid > 0 ? sumZ / valid : 9999;
    });

    faces.sort((a, b) => b.avgZ - a.avgZ);

    // Render faces back to front
    faces.forEach((face) => {
      const p0 = projected[face.indices[0]];
      const p1 = projected[face.indices[1]];
      const p2 = projected[face.indices[2]];
      const p3 = projected[face.indices[3]];

      if (!p0.visible || !p1.visible || !p2.visible || !p3.visible) return;

      // Back-face culling via cross product in 2D
      const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
      if (cross <= 0 && !face.isRoof) return;

      // Draw Main Face Body
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();

      // Shading based on angle
      const grad = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
      grad.addColorStop(0, '#1c221e');
      grad.addColorStop(0.5, face.color);
      grad.addColorStop(1, '#080a09');

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Golden Kiswah Calligraphic Belt (Hizam) on side walls
      if (!face.isRoof) {
        // Belt is located around 20% to 35% from the top
        const beltTop0 = { x: p0.x + (p3.x - p0.x) * 0.22, y: p0.y + (p3.y - p0.y) * 0.22 };
        const beltTop1 = { x: p1.x + (p2.x - p1.x) * 0.22, y: p1.y + (p2.y - p1.y) * 0.22 };
        const beltBot1 = { x: p1.x + (p2.x - p1.x) * 0.36, y: p1.y + (p2.y - p1.y) * 0.36 };
        const beltBot0 = { x: p0.x + (p3.x - p0.x) * 0.36, y: p0.y + (p3.y - p0.y) * 0.36 };

        ctx.beginPath();
        ctx.moveTo(beltTop0.x, beltTop0.y);
        ctx.lineTo(beltTop1.x, beltTop1.y);
        ctx.lineTo(beltBot1.x, beltBot1.y);
        ctx.lineTo(beltBot0.x, beltBot0.y);
        ctx.closePath();

        const goldGrad = ctx.createLinearGradient(beltTop0.x, beltTop0.y, beltTop1.x, beltTop1.y);
        const shimmer = Math.sin(now * 0.002 + face.avgZ * 0.01);
        goldGrad.addColorStop(0, '#c89e37');
        goldGrad.addColorStop(0.5 + shimmer * 0.2, '#fff1b0');
        goldGrad.addColorStop(1, '#a67c1e');

        ctx.fillStyle = goldGrad;
        ctx.fill();
        ctx.strokeStyle = '#e6ca65';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Bab al-Kaaba (Golden Door on East Face)
        if (face.hasDoor) {
          const doorL_top = { x: p0.x + (p1.x - p0.x) * 0.25 + (p3.x - p0.x) * 0.38, y: p0.y + (p1.y - p0.y) * 0.25 + (p3.y - p0.y) * 0.38 };
          const doorR_top = { x: p0.x + (p1.x - p0.x) * 0.72 + (p3.x - p0.x) * 0.38, y: p0.y + (p1.y - p0.y) * 0.72 + (p3.y - p0.y) * 0.38 };
          const doorR_bot = { x: p0.x + (p1.x - p0.x) * 0.72 + (p3.x - p0.x) * 0.92, y: p0.y + (p1.y - p0.y) * 0.72 + (p3.y - p0.y) * 0.92 };
          const doorL_bot = { x: p0.x + (p1.x - p0.x) * 0.25 + (p3.x - p0.x) * 0.92, y: p0.y + (p1.y - p0.y) * 0.25 + (p3.y - p0.y) * 0.92 };

          ctx.beginPath();
          ctx.moveTo(doorL_top.x, doorL_top.y);
          ctx.lineTo(doorR_top.x, doorR_top.y);
          ctx.lineTo(doorR_bot.x, doorR_bot.y);
          ctx.lineTo(doorL_bot.x, doorL_bot.y);
          ctx.closePath();

          const doorGrad = ctx.createLinearGradient(doorL_top.x, doorL_top.y, doorR_bot.x, doorR_bot.y);
          doorGrad.addColorStop(0, '#f9e69c');
          doorGrad.addColorStop(0.5, '#d4af37');
          doorGrad.addColorStop(1, '#8f6815');

          ctx.fillStyle = doorGrad;
          ctx.fill();
          ctx.strokeStyle = '#fff5c0';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    });

    // Radiant Hajar al-Aswad (Black Stone) indicator at South-East Corner
    const bs = projected[6]; // Bottom SE corner
    if (bs && bs.visible) {
      ctx.save();
      const glow = 6 + 4 * Math.sin(now * 0.005);
      ctx.shadowColor = '#d4af37';
      ctx.shadowBlur = glow * 2;
      ctx.fillStyle = '#ffdf78';
      ctx.beginPath();
      ctx.arc(bs.x, bs.y - 6, Math.max(3, 4.5 * bs.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  renderPilgrims(ctx, cx, cy, behindKaaba) {
    for (const p of this.orbitPilgrims) {
      const x = Math.cos(p.angle) * p.radius;
      const z = Math.sin(p.angle) * p.radius;

      // Project point
      const proj = this.project(x, 46 + p.y, z, cx, cy);
      if (!proj.visible) continue;

      // Separate into back and front layers for realistic 3D occlusion
      const isBehind = proj.z > 0;
      if (isBehind !== behindKaaba) continue;

      const size = Math.max(1, p.size * proj.scale);
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);

      if (p.hue === 'gold') {
        ctx.fillStyle = 'rgba(230, 202, 101, 0.85)';
        ctx.shadowColor = '#d4af37';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  renderParticles(ctx, cx, cy) {
    for (const pt of this.particles) {
      const p = this.project(pt.x, pt.y, pt.z, cx, cy);
      if (!p.visible) continue;

      const progress = pt.life / pt.maxLife;
      const alpha = pt.alpha * Math.sin(progress * Math.PI);
      const size = Math.max(0.6, pt.size * p.scale);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(247, 231, 169, ${alpha})`;
      ctx.fill();
    }
  }

  // 3D Card Tilt & Holographic Glare Controller
  initScrollAndTiltEngine() {
    this.initCardTilt();
    this.initScrollReveals();
  }

  initCardTilt() {
    // Attach 3D tilt interactions to cards
    const attachTilt = () => {
      const cards = document.querySelectorAll('.card, .tile, .hero, .status-card, .dua, .step-card');
      cards.forEach((card) => {
        if (card.dataset.tiltAttached) return;
        card.dataset.tiltAttached = 'true';

        let isHovered = false;

        card.addEventListener('pointerenter', () => {
          isHovered = true;
          card.classList.add('tilt-active');
        });

        card.addEventListener('pointermove', (e) => {
          if (!isHovered) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const rotX = ((y - centerY) / centerY) * -6; // max 6 deg tilt
          const rotY = ((x - centerX) / centerX) * 6;

          card.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(6px)`;
          card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
          card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
        });

        const resetTilt = () => {
          isHovered = false;
          card.classList.remove('tilt-active');
          card.style.transform = '';
        };

        card.addEventListener('pointerleave', resetTilt);
        card.addEventListener('pointercancel', resetTilt);
      });
    };

    attachTilt();

    // Re-attach whenever DOM updates
    const observer = new MutationObserver(() => attachTilt());
    const appEl = document.getElementById('app');
    if (appEl) {
      observer.observe(appEl, { childList: true, subtree: true });
    }
  }

  initScrollReveals() {
    if (!('IntersectionObserver' in window)) return;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed-3d');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const observeElements = () => {
      const targets = document.querySelectorAll(
        '.page > *, .tiles > *, .dua, .card, .status-card, .hero, .step-card, .lang-grid > *'
      );
      targets.forEach((el) => {
        if (!el.classList.contains('scroll-reveal-item')) {
          el.classList.add('scroll-reveal-item');
          revealObserver.observe(el);
        }
      });
    };

    observeElements();

    const domObs = new MutationObserver(() => observeElements());
    const appEl = document.getElementById('app');
    if (appEl) {
      domObs.observe(appEl, { childList: true, subtree: true });
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('scroll', this.handleScroll);
  }
}

let global3d = null;
export function get3DExperience() {
  if (!global3d) {
    global3d = new ThreeDExperience();
  }
  return global3d;
}
