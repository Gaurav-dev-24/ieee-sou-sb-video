// ─────────────────────────────────────────────────────────────
//  morphEngine.js
//  Orchestrates the morph, scale, and disperse animations
//  using GSAP to tween individual particle positions.
//
//  Strategy for performance:
//   - Use a single GSAP proxy object per particle.
//   - Batch update via onUpdate callback that copies proxy → buffer.
//   - Stagger particles in small groups for wave-like effect.
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export class MorphEngine {
  constructor(particleSystem) {
    this.ps = particleSystem;
  }

  // ── Morph particles → text shape ──────────────────────
  /**
   * @returns {Promise} resolves when all particles have settled
   */
  morphToText() {
    return new Promise(resolve => {
      const ps      = this.ps;
      const count   = CONFIG.PARTICLE_COUNT;
      const pos     = ps.positions;
      const targets = ps.textTargets;
      const dur     = CONFIG.MORPH_DURATION;

      ps.stopFloat();   // Halt idle drift during morph

      let completed = 0;

      // GSAP batch tween — each particle gets a proxy object
      // We tween the proxy, then copy into the shared buffer in onUpdate
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Proxy mirrors current position
        const proxy = {
          x: pos[i3],
          y: pos[i3 + 1],
          z: pos[i3 + 2],
        };

        // Stagger: particles in different "rings" animate at different times
        const staggerDelay = (i / count) * 0.55;

        gsap.to(proxy, {
          x: targets[i3],
          y: targets[i3 + 1],
          z: targets[i3 + 2],
          duration: dur + Math.random() * 0.22,
          delay:    staggerDelay,
          ease:     CONFIG.MORPH_EASE,
          onUpdate: () => {
            // Write proxy back into shared Float32Array
            pos[i3]     = proxy.x;
            pos[i3 + 1] = proxy.y;
            pos[i3 + 2] = proxy.z;
            // needsUpdate is set in a single place (see below)
          },
          onComplete: () => {
            completed++;
            if (completed === count) resolve();
          },
        });
      }

      // Single RAF-based updater so we set needsUpdate once per frame
      // rather than per-tween (major performance win)
      this._startBufferSync(ps);
    });
  }

  // ── Scale the particle mesh (3D zoom) ─────────────────
  scaleText() {
    return new Promise(resolve => {
      const mesh = this.ps.points;
      mesh.scale.setScalar(CONFIG.SCALE_FROM);

      gsap.to(mesh.scale, {
        x: CONFIG.SCALE_TO,
        y: CONFIG.SCALE_TO,
        z: CONFIG.SCALE_TO,
        duration: CONFIG.SCALE_DURATION,
        ease: 'expo.out',
        onComplete: resolve,
      });
    });
  }

  // ── Disperse particles → random scatter ───────────────
  disperse() {
    return new Promise(resolve => {
      const ps      = this.ps;
      const count   = CONFIG.PARTICLE_COUNT;
      const pos     = ps.positions;
      const scatter = ps.getScatterTargets();
      const dur     = CONFIG.DISPERSE_DURATION;

      let completed = 0;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const proxy = { x: pos[i3], y: pos[i3 + 1], z: pos[i3 + 2] };

        gsap.to(proxy, {
          x: scatter[i3],
          y: scatter[i3 + 1],
          z: scatter[i3 + 2],
          duration: dur * (0.7 + Math.random() * 0.45),
          ease: CONFIG.DISPERSE_EASE,
          onUpdate: () => {
            pos[i3]     = proxy.x;
            pos[i3 + 1] = proxy.y;
            pos[i3 + 2] = proxy.z;
          },
          onComplete: () => {
            completed++;
            if (completed === count) resolve();
          },
        });
      }

      this._startBufferSync(ps);

      // Reset scale during disperse
      gsap.to(this.ps.points.scale, {
        x: 1, y: 1, z: 1,
        duration: dur * 0.5,
        ease: 'power2.out',
      });
    });
  }

  // ── Single per-frame buffer sync (needsUpdate) ────────
  // Runs a persistent RAF loop while _syncing flag is true.
  // This avoids calling needsUpdate thousands of times per frame.
  _startBufferSync(ps) {
    if (this._syncActive) return;
    this._syncActive = true;

    const loop = () => {
      if (!this._syncActive) return;
      // Signal Three.js to re-upload position buffer to GPU
      ps.geometry.attributes.position.needsUpdate = true;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stopSync() {
    this._syncActive = false;
  }
}
