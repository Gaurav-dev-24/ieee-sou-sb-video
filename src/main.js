import { CONFIG }    from './config.js';
import { Countdown } from './modules/countdown.js';

function showDiagnostic(message) {
  window.__APP_DIAGNOSTICS__?.show(message);
}

const missingLibs = [
  !window.gsap && 'GSAP',
].filter(Boolean);

if (missingLibs.length) {
  showDiagnostic(`Missing browser libraries: ${missingLibs.join(', ')}. Check your internet connection or CDN access.`);
  throw new Error(`Missing libraries: ${missingLibs.join(', ')}`);
}

const countdown = new Countdown();

// ─────────────────────────────────────────────────────────────
//  PHASE 0: Start Screen
// ─────────────────────────────────────────────────────────────
function initStartScreen() {
  const btn    = document.getElementById('start-btn');
  const screen = document.getElementById('start-screen');

  const trigger = () => {
    btn.removeEventListener('click', trigger);
    document.removeEventListener('keydown', onKey);

    const rocket    = document.getElementById('launch-rocket');
    const cloudsRow = screen.querySelector('.clouds-row');
    const overlay   = document.getElementById('cloud-overlay');
    const H         = window.innerHeight;

    // Step 1: hide button
    gsap.to(btn, {
      opacity: 0, scale: 0.85, duration: 0.3, ease: 'power2.in',
      onComplete: () => {
        btn.style.pointerEvents = 'none';

        // Step 2: rocket + existing clouds fly up
        rocket.classList.remove('hovering');
        gsap.killTweensOf(rocket);
        gsap.to(rocket,    { y: -(H + 200), duration: 1.4, ease: 'power3.in' });
        gsap.to(cloudsRow, { y: -(H + 160), duration: 1.6, ease: 'power2.in' });
        window.__launchParticles?.();

        // Step 3: clouds move up, scale up and fade out
        overlay.style.display = 'block';
        const cloudSVG = `<svg viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="35" rx="55" ry="18" fill="white"/>
          <ellipse cx="40" cy="28" rx="28" ry="20" fill="white"/>
          <ellipse cx="75" cy="25" rx="22" ry="18" fill="white"/>
        </svg>`;

        const positions = [
          { x: -5,  y: 80, s: 1.2, delay: 0.0  },
          { x: 25,  y: 75, s: 1.0, delay: 0.08 },
          { x: 55,  y: 78, s: 1.3, delay: 0.05 },
          { x: 78,  y: 80, s: 1.1, delay: 0.1  },
          { x: 10,  y: 50, s: 1.1, delay: 0.2  },
          { x: 40,  y: 55, s: 1.0, delay: 0.22 },
          { x: 68,  y: 52, s: 1.2, delay: 0.25 },
          { x: -8,  y: 25, s: 1.3, delay: 0.4  },
          { x: 30,  y: 28, s: 1.0, delay: 0.42 },
          { x: 60,  y: 22, s: 1.2, delay: 0.45 },
          { x: 82,  y: 30, s: 1.1, delay: 0.48 },
        ];

        positions.forEach(({ x, y, s, delay }) => {
          const el = document.createElement('div');
          el.className = 'spawn-cloud';
          el.innerHTML = cloudSVG;
          el.style.cssText = `left:${x}%;top:${y}%;width:${Math.round(s * 220)}px;opacity:1;transform:scale(${s}) translateY(0px);`;
          overlay.appendChild(el);
          // rise up, grow big, fade out
          gsap.to(el, {
            y: -(H * 0.6),
            scale: s * 3.5,
            opacity: 0,
            duration: 1.4,
            delay: 0.3 + delay,
            ease: 'power1.in',
          });
        });

        // Step 4: bg fades out early, then overlay cleans up
        gsap.delayedCall(0.6, () => {
          gsap.to(screen, { opacity: 0, duration: 0.5, ease: 'power2.in' });
        });

        gsap.delayedCall(1.9, () => {
          overlay.style.display = 'none';
          overlay.innerHTML     = '';
          screen.style.display  = 'none';
          screen.style.opacity  = '';
          runSequence();
        });
      },
    });
  };

  const onKey = e => { if (e.key === 'Enter') trigger(); };
  btn.addEventListener('click', trigger);
  document.addEventListener('keydown', onKey);
}

// ─────────────────────────────────────────────────────────────
//  PARTICLE ANIMATION (Canvas 2D)
// ─────────────────────────────────────────────────────────────

// Sample pixel positions from text drawn on an offscreen canvas
function sampleTextPositions(lines, canvasW, canvasH) {
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d');

  // Measure and fit font size
  let fontSize = 100;
  ctx.font = `800 ${fontSize}px Inter, sans-serif`;
  while (fontSize > 20) {
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (maxW <= canvasW * 0.88) break;
    fontSize -= 2;
    ctx.font = `800 ${fontSize}px Inter, sans-serif`;
  }

  const lineH   = fontSize * 1.25;
  const totalH  = lineH * lines.length;
  const startY  = (canvasH - totalH) / 2 + fontSize * 0.8;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    ctx.fillText(line, canvasW / 2, startY + i * lineH);
  });

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH).data;
  const step    = 5;
  const points  = [];

  for (let y = 0; y < canvasH; y += step) {
    for (let x = 0; x < canvasW; x += step) {
      const idx = (y * canvasW + x) * 4;
      if (imgData[idx + 3] > 128) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

function runParticleAnimation(canvas, logoEl) {
  return new Promise(resolve => {
    const W   = canvas.width  = window.innerWidth;
    const H   = canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    // Page center — particles burst from here
    const originX  = W / 2;
    const originY  = H / 2;

    // Sample text target positions
    const lines      = ['SILVER OAK UNIVERSITY', 'IEEE STUDENT BRANCH'];
    const textPoints = sampleTextPositions(lines, W, H);
    const COUNT      = Math.min(textPoints.length, 3500);

    // Shuffle text points so particles spread evenly
    for (let i = textPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [textPoints[i], textPoints[j]] = [textPoints[j], textPoints[i]];
    }

    // Build particles
    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const target = textPoints[i % textPoints.length];
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 2 + Math.random() * 5;
      particles.push({
        x:   originX,
        y:   originY,
        vx:  Math.cos(angle) * speed,
        vy:  Math.sin(angle) * speed,
        tx:  target.x,
        ty:  target.y,
        size: 1.5 + Math.random() * 1.5,
        // blue shades
        r: 30  + Math.floor(Math.random() * 60),
        g: 90  + Math.floor(Math.random() * 60),
        b: 200 + Math.floor(Math.random() * 55),
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // ── Animation state machine ──────────────────────────
    // Phase A: burst out (0 → 1.2s)
    // Phase B: drift/float (1.2s → 2.4s)
    // Phase C: converge to text (2.4s → 5s)
    // Phase D: hold as white text (5s → 7.5s)
    // Phase E: fade out (7.5s → 8.5s)

    const T_BURST_END    = 1200;
    const T_DRIFT_END    = 2400;
    const T_CONVERGE_END = 5200;
    const T_HOLD_END     = 7700;
    const T_FADE_END     = 8700;

    let startTime = null;
    let rafId;

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function draw(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      ctx.clearRect(0, 0, W, H);

      // Draw background (dark)
      ctx.fillStyle = '#0a0f1e';
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];

        if (elapsed < T_BURST_END) {
          // Phase A: burst outward from logo
          const t = elapsed / T_BURST_END;
          p.x += p.vx * (1 - t * 0.8);
          p.y += p.vy * (1 - t * 0.8);
          p.alpha = Math.min(1, t * 3);

        } else if (elapsed < T_DRIFT_END) {
          // Phase B: gentle float in place
          const t = (elapsed - T_BURST_END) / (T_DRIFT_END - T_BURST_END);
          p.x += Math.sin(elapsed * 0.001 + p.phase) * 0.4;
          p.y += Math.cos(elapsed * 0.0008 + p.phase * 1.2) * 0.3;
          p.alpha = 1;

        } else if (elapsed < T_CONVERGE_END) {
          // Phase C: converge toward text targets
          const t  = (elapsed - T_DRIFT_END) / (T_CONVERGE_END - T_DRIFT_END);
          const et = easeOutExpo(Math.min(t, 1));
          p.x = p.x + (p.tx - p.x) * et * 0.06;
          p.y = p.y + (p.ty - p.y) * et * 0.06;
          p.alpha = 1;

        } else if (elapsed < T_HOLD_END) {
          // Phase D: snap to text, keep blue
          p.x = p.tx;
          p.y = p.ty;
          p.alpha = 1;

        } else if (elapsed < T_FADE_END) {
          // Phase E: fade out
          const t = (elapsed - T_HOLD_END) / (T_FADE_END - T_HOLD_END);
          p.alpha = 1 - t;

        } else {
          p.alpha = 0;
        }

        if (p.alpha <= 0) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (elapsed < T_FADE_END) {
        rafId = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(rafId);
        resolve();
      }
    }

    rafId = requestAnimationFrame(draw);
  });
}

// ─────────────────────────────────────────────────────────────
//  MAIN SEQUENCE
// ─────────────────────────────────────────────────────────────
async function runSequence() {

  // ── Phase 1: Countdown ──────────────────────────────────
  await countdown.run();

  // ── Phase 2: Show logo ──────────────────────────────────
  const logoEl  = document.getElementById('logo-top');
  const canvas  = document.getElementById('particle-canvas');

  canvas.style.display = 'block';

  gsap.fromTo(logoEl,
    { opacity: 0, y: -12 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
  );

  await sleep(600);

  // ── Phase 3: Particle animation ─────────────────────────
  await runParticleAnimation(canvas, logoEl);

  // Fade canvas + logo out together
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.5s ease';
  await gsap.to(logoEl, { opacity: 0, y: -8, duration: 0.5, ease: 'power2.in' }).then();

  await sleep(200);
  canvas.style.display = 'none';

  // ── Phase 4: Redirect ────────────────────────────────────
  sessionStorage.setItem('from_animation', '1');
  window.location.href = CONFIG.REDIRECT_URL;
}

// ─────────────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────
function initBgParticles() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, dots;
  let launching = false;

  // expose so trigger() can call it
  window.__launchParticles = () => { launching = true; };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeDots() {
    dots = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      if (launching) {
        // accelerate upward each frame
        d.vy -= 0.18;
        d.vy = Math.max(d.vy, -18);
      }
      d.x += d.vx;
      d.y += d.vy;
      if (!launching) {
        if (d.x < 0) d.x = W;
        if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H;
        if (d.y > H) d.y = 0;
      }
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45,108,223,${d.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  makeDots();
  draw();
  window.addEventListener('resize', () => { resize(); makeDots(); });
}

try {
  initBgParticles();
  initStartScreen();
  document.getElementById('launch-rocket')?.classList.add('hovering');
} catch (error) {
  showDiagnostic(`Boot failed: ${error.message}`);
  throw error;
}
