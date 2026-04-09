// ─────────────────────────────────────────────────────────────
//  textSampler.js
//  Uses an off-screen <canvas> to rasterize the target text,
//  then samples pixel positions to build a 3D point cloud.
//
//  Technique:
//    1. Draw text onto 2D canvas.
//    2. Read pixel data via getImageData().
//    3. Walk through pixels at SAMPLE_STEP stride.
//    4. Keep pixels where alpha > threshold.
//    5. Map pixel (x, y) → world-space (X, Y, Z).
// ─────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export class TextSampler {

  /**
   * Sample world-space positions for the target text.
   * Returns Float32Array with length = numPoints * 3 (x,y,z interleaved).
   *
   * @param {number} worldWidth  — Current viewport world-width (units)
   * @param {number} worldHeight — Current viewport world-height (units)
   * @returns {{ positions: Float32Array, count: number }}
   */
  static async sample(worldWidth, worldHeight) {
    if (CONFIG.TARGET_MODE === 'image') {
      return this.sampleImage(worldWidth, worldHeight);
    }

    return this.sampleText(worldWidth, worldHeight);
  }

  static sampleText(worldWidth, worldHeight) {
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = CONFIG.TEXT_CANVAS_WIDTH;
    measureCanvas.height = CONFIG.TEXT_CANVAS_HEIGHT;
    const measureCtx = measureCanvas.getContext('2d');

    const paddingX = 80;
    const paddingY = 60;
    const maxWidth = measureCanvas.width - paddingX * 2;
    let fontSize = CONFIG.TEXT_FONT_SIZE;

    // Hard-coded two-line split for full branch name
    let lines = ['SILVER OAK UNIVERSITY IEEE', 'STUDENT BRANCH'];

    // Shrink font until both lines fit within maxWidth
    while (fontSize >= 36) {
      measureCtx.font = `${CONFIG.TEXT_FONT_WEIGHT} ${fontSize}px ${CONFIG.TEXT_FONT_FAMILY}`;
      const widestLine = Math.max(...lines.map(l => measureCtx.measureText(l).width));
      if (widestLine <= maxWidth) break;
      fontSize -= 4;
    }

    // Final measurements
    measureCtx.font = `${CONFIG.TEXT_FONT_WEIGHT} ${fontSize}px ${CONFIG.TEXT_FONT_FAMILY}`;
    const metrics = measureCtx.measureText(lines[0]);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.78;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.22;
    const lineH = ascent + descent;
    const lineGap = fontSize * 0.38;           // comfortable inter-line gap
    const totalTextH = lineH * lines.length + lineGap * (lines.length - 1);
    const widestLine = Math.max(...lines.map(l => measureCtx.measureText(l).width));

    const drawPadX = 32;
    const drawPadY = 32;
    const cvs = document.createElement('canvas');
    cvs.width = Math.ceil(widestLine) + drawPadX * 2;
    cvs.height = Math.ceil(totalTextH) + drawPadY * 2;
    const ctx = cvs.getContext('2d');

    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${CONFIG.TEXT_FONT_WEIGHT} ${fontSize}px ${CONFIG.TEXT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const cx = cvs.width / 2;

    lines.forEach((line, i) => {
      const y = drawPadY + ascent + i * (lineH + lineGap);
      ctx.fillText(line, cx, y);
    });

    const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
    const data = imgData.data;
    const step = CONFIG.TEXT_SAMPLE_STEP;
    const points = [];

    for (let y = 0; y < cvs.height; y += step) {
      for (let x = 0; x < cvs.width; x += step) {
        const idx = (y * cvs.width + x) * 4;
        const red = data[idx];
        const alpha = data[idx + 3];
        if (alpha > 0 && red > 180) {
          points.push({ x, y });
        }
      }
    }

    if (!points.length) {
      return { positions: new Float32Array(), count: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const boundsW = Math.max(maxX - minX, 1);
    const boundsH = Math.max(maxY - minY, 1);

    // Allow more world space for full two-line text
    const targetMaxW = worldWidth * 0.88;
    const targetMaxH = worldHeight * 0.52;
    const scale = Math.min(targetMaxW / boundsW, targetMaxH / boundsH);

    const centerX = minX + boundsW / 2;
    const centerY = minY + boundsH / 2;
    const raw = [];

    for (const p of points) {
      const wx = (p.x - centerX) * scale;
      const wy = -(p.y - centerY) * scale + CONFIG.TARGET_OFFSET_Y;
      raw.push(wx, wy, 0);
    }

    const positions = new Float32Array(raw);
    return { positions, count: raw.length / 3 };
  }

  static async sampleImage(worldWidth, worldHeight) {
    const image = await this.loadImage(CONFIG.TARGET_IMAGE_SRC);
    const cvs = document.createElement('canvas');
    cvs.width = image.naturalWidth || image.width;
    cvs.height = image.naturalHeight || image.height;

    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(image, 0, 0, cvs.width, cvs.height);

    const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
    const data = imgData.data;
    const step = CONFIG.TEXT_SAMPLE_STEP;
    const points = [];

    for (let y = 0; y < cvs.height; y += step) {
      for (let x = 0; x < cvs.width; x += step) {
        const idx = (y * cvs.width + x) * 4;
        const alpha = data[idx + 3];

        if (alpha > 96) {
          points.push({ x, y });
        }
      }
    }

    if (!points.length) {
      return { positions: new Float32Array(), count: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    const boundsWidth = Math.max(maxX - minX, 1);
    const boundsHeight = Math.max(maxY - minY, 1);
    const targetMaxWidth = worldWidth * 0.78;
    const targetMaxHeight = worldHeight * 0.22;
    const scale = Math.min(targetMaxWidth / boundsWidth, targetMaxHeight / boundsHeight);
    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;
    const raw = [];

    for (const point of points) {
      const wx = (point.x - centerX) * scale;
      const wy = -(point.y - centerY) * scale + CONFIG.TARGET_OFFSET_Y;
      raw.push(wx, wy, 0);
    }

    const positions = new Float32Array(raw);
    return { positions, count: raw.length / 3 };
  }

  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load target image: ${src}`));
      image.src = src;
    });
  }

  static wrapLines(ctx, words, maxWidth) {
    const lines = [];
    let current = '';

    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  /**
   * Convert camera FOV + distance to world dimensions.
   * Used to map canvas pixel space ↔ 3D world space.
   */
  static worldDimensions(camera) {
    const vFov = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * camera.position.z;
    const width = height * camera.aspect;
    return { width, height };
  }
}
