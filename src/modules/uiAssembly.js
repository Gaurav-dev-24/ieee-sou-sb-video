// ─────────────────────────────────────────────────────────────
//  uiAssembly.js
//  Phase 2: Assembles the final UI with premium staggered
//  animations using GSAP timelines and MotionPath.
// ─────────────────────────────────────────────────────────────

export class UIAssembly {
  constructor() {
    this.wrapper = document.getElementById('ui-assembly');
  }

  run() {
    return new Promise(resolve => {
      gsap.set(this.wrapper, { opacity: 1, pointerEvents: 'all' });

      const tl = gsap.timeline({ onComplete: resolve });

      tl.to('#ui-bg', {
        scale: 1,
        duration: 2.4,
        ease: 'power2.out',
      });

      tl.to('#ui-overlay', {
        opacity: 1,
        duration: 0.9,
        ease: 'power2.out',
      }, 0);

      tl.to('#ui-nav', {
        y: 0, duration: 0.95, ease: 'power3.out',
      }, 0.08);

      gsap.set('#nav-logo', { x: -40, opacity: 0 });
      tl.to('#nav-logo', {
        x: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out',
      }, 0.2);

      tl.fromTo('.nav-links li',
        { opacity: 0, y: -14 },
        {
          opacity: 1, y: 0,
          stagger: 0.06,
          duration: 0.44,
          ease: 'power2.out',
        },
        0.28
      );

      tl.fromTo('#nav-cta',
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' },
        0.32
      );

      tl.fromTo('#ui-hero',
        { scale: 1.025 },
        { scale: 1, duration: 1.7, ease: 'power2.out' },
        0.12
      );
    });
  }
}
