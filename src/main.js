// ─────────────────────────────────────────────────────────────
//  main.js — Master Orchestrator
//
//  Controls the full animation sequence via a GSAP master timeline:
//    Phase 0: Start screen
//    Phase 1: Countdown
//    Phase 2: Particle system init + idle float
//    Phase 3: Morph to text
//    Phase 4: Scale zoom
//    Phase 5: Disperse
//    Phase 6: UI assembly
//
//  All modules are imported and wired here.
// ─────────────────────────────────────────────────────────────

import { CONFIG }       from './config.js';
import { SceneManager } from './modules/sceneManager.js';
import { ParticleSystem } from './modules/particles.js';
import { TextSampler }  from './modules/textSampler.js';
import { MorphEngine }  from './modules/morphEngine.js';
import { Countdown }    from './modules/countdown.js';
import { UIAssembly }   from './modules/uiAssembly.js';

function showDiagnostic(message) {
  window.__APP_DIAGNOSTICS__?.show(message);
}

const missingLibs = [
  !window.gsap && 'GSAP',
  !window.MotionPathPlugin && 'MotionPathPlugin',
  !window.THREE && 'Three.js',
].filter(Boolean);

if (missingLibs.length) {
  showDiagnostic(`Missing browser libraries: ${missingLibs.join(', ')}. Check your internet connection or CDN access.`);
  throw new Error(`Missing libraries: ${missingLibs.join(', ')}`);
}

// ── Register GSAP plugins ──────────────────────────────────
gsap.registerPlugin(MotionPathPlugin);

// ── Module instances ───────────────────────────────────────
let sceneManager, particleSystem, morphEngine;
const countdown  = new Countdown();
const uiAssembly = new UIAssembly();

// ─────────────────────────────────────────────────────────────
//  PHASE 0: Start Screen
// ─────────────────────────────────────────────────────────────
function initStartScreen() {
  const btn    = document.getElementById('start-btn');
  const screen = document.getElementById('start-screen');

  const trigger = () => {
    // Prevent double-trigger
    btn.removeEventListener('click', trigger);
    document.removeEventListener('keydown', onKey);

    // Animate start screen out
    gsap.to(screen, {
      opacity: 0, scale: 1.05,
      duration: 0.6, ease: 'power2.in',
      onComplete: () => {
        screen.style.display = 'none';
        runSequence();          // ← Kick off the full sequence
      },
    });
  };

  const onKey = e => { if (e.key === 'Enter') trigger(); };

  btn.addEventListener('click', trigger);
  document.addEventListener('keydown', onKey);
}

// ─────────────────────────────────────────────────────────────
//  MAIN SEQUENCE
// ─────────────────────────────────────────────────────────────
async function runSequence() {

  // ── Phase 1: Countdown ──────────────────────────────────
  await countdown.run();

  // ── Phase 2: Initialize Three.js scene & particles ──────
  const canvas = document.getElementById('particle-canvas');
  canvas.style.display = 'block';

  sceneManager   = new SceneManager(canvas).init();
  particleSystem = new ParticleSystem(sceneManager).init();
  morphEngine    = new MorphEngine(particleSystem);

  // Register particle float tick into render loop
  sceneManager.addTick((elapsed) => particleSystem.tick(elapsed));
  sceneManager.startLoop();

  // Fade canvas in
  gsap.to(canvas, { opacity: 1, duration: 0.8, ease: 'power2.out' });

  // Sample text positions in world space
  const { width: wW, height: wH } = TextSampler.worldDimensions(sceneManager.camera);
  const { positions, count }       = await TextSampler.sample(wW, wH);
  particleSystem.setTextTargets(positions, count);

  // Start idle float briefly before morphing into the full branch name
  particleSystem.startFloat();
  await sleep(1200);

  // ── Phase 3: Morph to text ──────────────────────────────
  await morphEngine.morphToText();
  await sleep(700);

  // ── Phase 4: Scale zoom ─────────────────────────────────
  await morphEngine.scaleText();
  await sleep(440);

  // ── Phase 5: Disperse ───────────────────────────────────
  await morphEngine.disperse();
  morphEngine.stopSync();

  // Fade canvas out
  await gsap.to(canvas, { opacity: 0, duration: 0.8, ease: 'power2.out' }).then();
  canvas.style.display = 'none';

  // Dispose Three.js resources
  sceneManager.stopLoop();
  particleSystem.dispose();

  // ── Phase 6: UI Assembly ─────────────────────────────────
  await uiAssembly.run();

  // Allow page scrolling after assembly
  document.body.style.overflow = 'auto';
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
try {
  initStartScreen();
} catch (error) {
  showDiagnostic(`Boot failed: ${error.message}`);
  throw error;
}
