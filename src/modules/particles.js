// ─────────────────────────────────────────────────────────────
//  particles.js
//  Manages the Three.js BufferGeometry particle system.
//
//  Key design:
//   - One large Float32Array backs ALL particle positions.
//   - A separate "home" array stores the idle/text target positions.
//   - needsUpdate = true is set every frame only while animating.
//   - Idle float uses per-particle phase offsets for organic motion.
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export class ParticleSystem {
  constructor(sceneManager) {
    this.sm       = sceneManager;
    this.geometry = null;
    this.material = null;
    this.points   = null;

    // Raw position buffer (x,y,z per particle)
    this.positions   = null;
    // "Rest" positions for text morph targets
    this.textTargets = null;
    // Per-particle phase for floating
    this.phases      = null;
    // Track whether floating is active
    this._floating   = false;
  }

  // ── Build particle system ──────────────────────────────
  init() {
    const count = CONFIG.PARTICLE_COUNT;

    // ── Position buffer: random spread ──────────────────
    this.positions = new Float32Array(count * 3);
    this.phases    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this._setRandomPosition(i);
      this.phases[i] = Math.random() * Math.PI * 2;  // Random phase offset
    }

    // ── BufferGeometry ───────────────────────────────────
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );

    // ── Per-vertex color (mix primary + accent) ──────────
    const colors = new Float32Array(count * 3);
    const pClr   = new THREE.Color(CONFIG.PARTICLE_COLOR);
    const aClr   = new THREE.Color(CONFIG.PARTICLE_COLOR_ALT);
    for (let i = 0; i < count; i++) {
      const t   = Math.random();
      const clr = new THREE.Color().lerpColors(pClr, aClr, t * 0.35);
      colors[i * 3]     = clr.r;
      colors[i * 3 + 1] = clr.g;
      colors[i * 3 + 2] = clr.b;
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // ── Material ─────────────────────────────────────────
    this.material = new THREE.PointsMaterial({
      size:           CONFIG.PARTICLE_SIZE * 0.012,   // Convert px to world units approx
      vertexColors:   true,
      transparent:    true,
      opacity:        0.98,
      depthWrite:     false,
      sizeAttenuation: true,
      blending:       THREE.NormalBlending,
    });

    // ── Points mesh ──────────────────────────────────────
    this.points = new THREE.Points(this.geometry, this.material);
    this.sm.add(this.points);

    return this;
  }

  // ── Set a single particle to a random world position ──
  _setRandomPosition(i) {
    const s = CONFIG.SPREAD;
    this.positions[i * 3]     = (Math.random() - 0.5) * s.x;
    this.positions[i * 3 + 1] = (Math.random() - 0.5) * s.y;
    this.positions[i * 3 + 2] = (Math.random() - 0.5) * s.z;
  }

  // ── Store text target positions ────────────────────────
  setTextTargets(textPositions, textCount) {
    // textPositions is a Float32Array of (x,y,z) for sampled text pixels.
    // We need exactly CONFIG.PARTICLE_COUNT entries.
    // If fewer text points than particles: cycle through text points.
    // If more: truncate.
    const count = CONFIG.PARTICLE_COUNT;
    this.textTargets = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const srcIdx = (i % textCount) * 3;
      // Add tiny Z jitter for depth
      this.textTargets[i * 3]     = textPositions[srcIdx];
      this.textTargets[i * 3 + 1] = textPositions[srcIdx + 1];
      this.textTargets[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
  }

  // ── Idle float tick ───────────────────────────────────
  // Called every frame by sceneManager's tick loop
  tick(elapsed) {
    if (!this._floating || !this.positions) return;

    const count = CONFIG.PARTICLE_COUNT;
    const amp   = CONFIG.FLOAT_AMPLITUDE;
    const spd   = CONFIG.FLOAT_SPEED;
    const pos   = this.positions;

    for (let i = 0; i < count; i++) {
      const phase = this.phases[i];
      // Sinusoidal drift on all three axes, different frequencies
      pos[i * 3]     += Math.sin(elapsed * spd * 1.3 + phase) * amp;
      pos[i * 3 + 1] += Math.cos(elapsed * spd       + phase * 1.1) * amp * 0.6;
      pos[i * 3 + 2] += Math.sin(elapsed * spd * 0.7 + phase * 0.8) * amp * 0.4;
    }

    // ← This is the key Three.js directive to re-upload buffer to GPU
    this.geometry.attributes.position.needsUpdate = true;
  }

  // ── Start / stop floating ─────────────────────────────
  startFloat() { this._floating = true;  }
  stopFloat()  { this._floating = false; }

  // ── Scatter all particles to random positions ─────────
  // Used for disperse effect via GSAP tweening
  getScatterTargets() {
    const count = CONFIG.PARTICLE_COUNT;
    const s     = CONFIG.DISPERSE_SPREAD;
    const arr   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * s;
      arr[i * 3 + 1] = (Math.random() - 0.5) * s * 0.6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * s * 0.4;
    }
    return arr;
  }

  dispose() {
    this.sm.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
