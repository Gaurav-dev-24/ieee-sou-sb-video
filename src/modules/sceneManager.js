// ─────────────────────────────────────────────────────────────
//  sceneManager.js
//  Owns the Three.js Scene, Camera, Renderer.
//  Provides the render loop via an external tick callback.
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export class SceneManager {
  constructor(canvasEl) {
    this.canvas   = canvasEl;
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this._rafId   = null;
    this._tickCbs = [];          // External systems register their tick functions here
  }

  // ── Init ──────────────────────────────────────────────────
  init() {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      CONFIG.CAMERA_NEAR,
      CONFIG.CAMERA_FAR
    );
    this.camera.position.z = CONFIG.CAMERA_Z;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,            // Off for performance with many particles
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2×

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    return this;
  }

  // ── Resize ────────────────────────────────────────────────
  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Render Loop ───────────────────────────────────────────
  /** Register an external tick function: (elapsed, delta) => void */
  addTick(fn) { this._tickCbs.push(fn); }

  startLoop() {
    const clock = new THREE.Clock();
    const loop  = () => {
      this._rafId = requestAnimationFrame(loop);
      const elapsed = clock.getElapsedTime();
      const delta   = clock.getDelta();

      // Notify all registered subsystems
      this._tickCbs.forEach(fn => fn(elapsed, delta));

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stopLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  // ── Helpers ───────────────────────────────────────────────
  add(obj)    { this.scene.add(obj); }
  remove(obj) { this.scene.remove(obj); }
}