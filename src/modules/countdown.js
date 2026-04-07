// ─────────────────────────────────────────────────────────────
//  countdown.js
//  Drives the fullscreen 5→1 countdown with:
//   - Number fade/scale using GSAP
//   - SVG ring progress indicator
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export class Countdown {
  constructor() {
    this.screen  = document.getElementById('countdown-screen');
    this.numEl   = document.getElementById('countdown-number');
    this.ring    = document.getElementById('ring-progress');
    this.CIRCUMFERENCE = 2 * Math.PI * 90;  // r=90 from SVG
  }

  run() {
    return new Promise(resolve => {
      // Show countdown screen
      gsap.to(this.screen, { opacity: 1, duration: 0.4, pointerEvents: 'none' });

      const total = CONFIG.COUNTDOWN_FROM;
      let   n     = total;

      // Animate ring: drain over total duration
      gsap.to(this.ring, {
        strokeDashoffset: this.CIRCUMFERENCE,
        duration: total,
        ease: 'none',
      });

      const showNumber = () => {
        if (n < 1) {
          // Countdown finished — fade out screen
          gsap.to(this.screen, {
            opacity: 0, scale: 1.05,
            duration: 0.5,
            onComplete: () => {
              this.screen.style.display = 'none';
              resolve();
            },
          });
          return;
        }

        // Set number text
        this.numEl.textContent = n;

        // Animate: pop in then fade out
        gsap.fromTo(this.numEl,
          { opacity: 0, scale: 0.5, filter: 'blur(8px)' },
          {
            opacity: 1, scale: 1, filter: 'blur(0px)',
            duration: 0.3, ease: 'back.out(1.4)',
            onComplete: () => {
              gsap.to(this.numEl, {
                opacity: 0, scale: 1.4, filter: 'blur(6px)',
                duration: 0.55, delay: 0.25, ease: 'power2.in',
                onComplete: () => {
                  n--;
                  showNumber();
                },
              });
            },
          }
        );
      };

      showNumber();
    });
  }
}
