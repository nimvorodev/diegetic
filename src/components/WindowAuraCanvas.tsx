import React, { useEffect, useRef } from 'react';
import { BorderThickness, RenderStyle } from '../types/desktop';

interface WindowAuraCanvasProps {
  width: number;
  height: number;
  cobwebIntensity: number; // 0..1
  heatIntensity: number; // 0..1
  frostIntensity: number; // 0..1
  hasSpider: boolean;
  renderStyle: RenderStyle;
  thickness: BorderThickness;
  brushingUntil: number;
  brushedWebAmount: number;
  seedOffset: number;
}

const PAD = 54;

interface SilkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  vRot: number;
}

// 11x9 pixel-art spider matrix (1 = dark body/leg, 2 = eye)
const PIXEL_SPIDER: number[][] = [
  [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
  [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 1, 2, 1, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pxSize: number
) {
  const sx = Math.round(x / pxSize) * pxSize;
  const sy = Math.round(y / pxSize) * pxSize;
  const sw = Math.max(pxSize, Math.round(w / pxSize) * pxSize);
  const sh = Math.max(pxSize, Math.round(h / pxSize) * pxSize);
  ctx.fillRect(sx, sy, sw, sh);
}

function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pxSize: number
) {
  let ix0 = Math.round(x0 / pxSize);
  let iy0 = Math.round(y0 / pxSize);
  const ix1 = Math.round(x1 / pxSize);
  const iy1 = Math.round(y1 / pxSize);

  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    ctx.fillRect(ix0 * pxSize, iy0 * pxSize, pxSize, pxSize);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

export const WindowAuraCanvas: React.FC<WindowAuraCanvasProps> = ({
  width,
  height,
  cobwebIntensity,
  heatIntensity,
  frostIntensity,
  hasSpider,
  renderStyle,
  thickness,
  brushingUntil,
  brushedWebAmount,
  seedOffset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<SilkParticle[]>([]);
  const lastBrushRef = useRef<number>(0);

  const thicknessMult = thickness === 'thin' ? 0.75 : thickness === 'thick' ? 1.32 : 1.0;

  // Spawn silk brush-away particles when brushingUntil updates
  useEffect(() => {
    if (brushingUntil > lastBrushRef.current && brushingUntil > Date.now()) {
      lastBrushRef.current = brushingUntil;
      const particles: SilkParticle[] = [];
      const count = Math.max(22, Math.round(38 * Math.max(0.35, brushedWebAmount)));

      // Spawn particles from top-left, top-right, and bottom corners
      const corners = [
        { cx: PAD + 26, cy: PAD + 24, dirX: 1, dirY: 1 },
        { cx: PAD + width - 26, cy: PAD + 24, dirX: -1, dirY: 1 },
        { cx: PAD + 22, cy: PAD + height - 20, dirX: 1, dirY: -1 },
        { cx: PAD + width - 22, cy: PAD + height - 20, dirX: -1, dirY: -1 },
      ];

      for (let i = 0; i < count; i++) {
        const c = corners[i % corners.length];
        particles.push({
          x: c.cx + (Math.random() - 0.5) * 38,
          y: c.cy + (Math.random() - 0.5) * 34,
          vx: c.dirX * (1.2 + Math.random() * 3.2) + (Math.random() - 0.5) * 1.5,
          vy: c.dirY * (0.6 + Math.random() * 2.4) - Math.random() * 1.6,
          size: 2 + Math.random() * 4.5,
          alpha: 0.85 + Math.random() * 0.15,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.2,
        });
      }
      particlesRef.current = particles;
    }
  }, [brushingUntil, brushedWebAmount, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const totalW = width + PAD * 2;
    const totalH = height + PAD * 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderFrame = (timeMs: number) => {
      const now = Date.now();
      const t = timeMs * 0.001 + seedOffset;
      const isBrushing = now < brushingUntil;
      const brushProgress = isBrushing
        ? Math.min(1, Math.max(0, 1 - (brushingUntil - now) / 560))
        : 1;

      const hasParticles = particlesRef.current.length > 0;
      const activeCobweb = isBrushing
        ? brushedWebAmount * Math.max(0, 1 - brushProgress * 1.5)
        : cobwebIntensity;

      ctx.clearRect(0, 0, totalW, totalH);

      if (
        activeCobweb <= 0.005 &&
        heatIntensity <= 0.005 &&
        frostIntensity <= 0.005 &&
        !isBrushing &&
        !hasParticles
      ) {
        // Nothing to animate — stop the loop; the effect deps restart it on change
        return;
      }

      // =========================================================
      // 1. HEAT: GLOWING RED-HOT CAST IRON & RISING HEAT WAVES
      // =========================================================
      if (heatIntensity > 0.01) {
        const borderW = Math.round((8 + heatIntensity * 8) * thicknessMult);
        const pulse = 0.86 + Math.sin(t * 3.4) * 0.14;
        const glow = heatIntensity * pulse;

        if (renderStyle === 'pixel') {
          const px = 4;
          // Dark forged cast-iron outer frame
          ctx.fillStyle = `rgba(28, 20, 18, ${0.88 + heatIntensity * 0.12})`;
          drawPixelRect(ctx, PAD - borderW, PAD - borderW, width + borderW * 2, borderW, px);
          drawPixelRect(ctx, PAD - borderW, PAD + height, width + borderW * 2, borderW, px);
          drawPixelRect(ctx, PAD - borderW, PAD, borderW, height, px);
          drawPixelRect(ctx, PAD + width, PAD, borderW, height, px);

          // Flickering molten pixel fissures along all 4 edges
          const step = px * 2;
          for (let x = PAD - borderW; x < PAD + width + borderW; x += step) {
            const waveTop = Math.sin(x * 0.07 + t * 5.2);
            const waveBot = Math.cos(x * 0.06 - t * 4.7);
            if (waveTop > -0.35) {
              ctx.fillStyle =
                waveTop > 0.55 && glow > 0.65
                  ? '#FEF08A'
                  : waveTop > 0.15
                  ? '#F97316'
                  : '#DC2626';
              drawPixelRect(ctx, x, PAD - borderW + px, px, borderW - px, px);
            }
            if (waveBot > -0.35) {
              ctx.fillStyle =
                waveBot > 0.55 && glow > 0.65
                  ? '#FEF08A'
                  : waveBot > 0.15
                  ? '#F97316'
                  : '#DC2626';
              drawPixelRect(ctx, x, PAD + height, px, borderW - px, px);
            }
          }

          for (let y = PAD; y < PAD + height; y += step) {
            const waveL = Math.sin(y * 0.08 - t * 5.0);
            const waveR = Math.cos(y * 0.08 + t * 4.5);
            if (waveL > -0.3) {
              ctx.fillStyle = waveL > 0.45 ? '#FB923C' : '#DC2626';
              drawPixelRect(ctx, PAD - borderW + px, y, borderW - px, px, px);
            }
            if (waveR > -0.3) {
              ctx.fillStyle = waveR > 0.45 ? '#FB923C' : '#DC2626';
              drawPixelRect(ctx, PAD + width, y, borderW - px, px, px);
            }
          }

          // Rising pixel heat blocks above top edge
          const numPuffs = Math.floor(14 * heatIntensity);
          for (let i = 0; i < numPuffs; i++) {
            const seed = (i * 73 + Math.floor(seedOffset * 10)) % 100;
            const cycle = (t * (0.85 + (seed % 5) * 0.15) + seed * 0.13) % 1;
            const pxX = PAD + ((seed / 100) * width) + Math.sin(cycle * 6 + i) * 8;
            const pxY = PAD - borderW - cycle * 38;
            const alpha = (1 - cycle) * 0.72 * heatIntensity;
            ctx.fillStyle =
              cycle < 0.35
                ? `rgba(254, 240, 138, ${alpha})`
                : cycle < 0.7
                ? `rgba(249, 115, 22, ${alpha})`
                : `rgba(220, 38, 38, ${alpha * 0.7})`;
            drawPixelRect(ctx, pxX, pxY, px * 1.5, px * 1.5, px);
          }
        } else {
          // ORGANIC PROCEDURAL CAST IRON + RISING HEAT WAVES
          ctx.save();

          // Outer thermal bloom
          ctx.shadowColor = `rgba(255, 68, 0, ${0.85 * glow})`;
          ctx.shadowBlur = 20 * heatIntensity;

          // Forged dark iron base ring
          ctx.strokeStyle = `rgba(34, 23, 20, ${0.92})`;
          ctx.lineWidth = borderW;
          ctx.lineJoin = 'round';
          ctx.strokeRect(
            PAD - borderW * 0.42,
            PAD - borderW * 0.42,
            width + borderW * 0.84,
            height + borderW * 0.84
          );

          // Glowing red-hot molten core inside the iron frame
          const grad = ctx.createLinearGradient(PAD, PAD, PAD + width, PAD + height);
          grad.addColorStop(0, `rgba(255, 214, 102, ${0.92 * glow})`);
          grad.addColorStop(0.22, `rgba(255, 94, 0, ${0.95 * glow})`);
          grad.addColorStop(0.5, `rgba(220, 38, 38, ${0.88 * glow})`);
          grad.addColorStop(0.78, `rgba(255, 115, 0, ${0.95 * glow})`);
          grad.addColorStop(1, `rgba(254, 224, 112, ${0.9 * glow})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = borderW * 0.54;
          ctx.strokeRect(
            PAD - borderW * 0.35,
            PAD - borderW * 0.35,
            width + borderW * 0.7,
            height + borderW * 0.7
          );

          // Cast-iron hammer-forged dark texture bumps along edges
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(24, 16, 14, 0.52)';
          const bumpSpacing = 14;
          for (let x = PAD; x <= PAD + width; x += bumpSpacing) {
            const r = 2.2 + Math.sin(x * 0.31) * 1.1;
            ctx.beginPath();
            ctx.arc(x, PAD - borderW * 0.55, r, 0, Math.PI * 2);
            ctx.arc(x, PAD + height + borderW * 0.55, r, 0, Math.PI * 2);
            ctx.fill();
          }

          // Rising wavy heat distortion ribbons above the window
          const ribbonCount = Math.max(6, Math.round(14 * heatIntensity));
          for (let i = 0; i < ribbonCount; i++) {
            const frac = (i + 0.5) / ribbonCount;
            const baseX = PAD + 16 + frac * (width - 32);
            const phase = t * 4.2 + i * 1.37;
            const waveH = (24 + (i % 3) * 9) * heatIntensity;

            const ribbonGrad = ctx.createLinearGradient(baseX, PAD - 4, baseX, PAD - 4 - waveH);
            ribbonGrad.addColorStop(0, `rgba(255, 115, 29, ${0.55 * glow})`);
            ribbonGrad.addColorStop(0.5, `rgba(255, 195, 113, ${0.28 * glow})`);
            ribbonGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.strokeStyle = ribbonGrad;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let dy = 0; dy <= waveH; dy += 3) {
              const progress = dy / waveH;
              const wx = baseX + Math.sin(progress * 5.5 - phase) * (4.5 * progress + 1.5);
              const wy = PAD - borderW * 0.6 - dy;
              if (dy === 0) ctx.moveTo(wx, wy);
              else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
          }

          // Rising glowing ember motes
          const emberCount = Math.round(10 * heatIntensity);
          for (let i = 0; i < emberCount; i++) {
            const cycle = (t * 0.75 + i * 0.29) % 1;
            const ex = PAD + ((i * 97) % width) + Math.sin(cycle * 7 + i) * 7;
            const ey = PAD - borderW * 0.6 - cycle * 42;
            const alpha = (1 - cycle) * 0.85 * glow;
            ctx.fillStyle = cycle < 0.4 ? `rgba(254, 240, 138, ${alpha})` : `rgba(255, 94, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(ex, ey, (1 - cycle * 0.5) * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // =========================================================
      // 2. FROST: IDLE APPS SLOWLY FROST OVER AT THE EDGES
      // =========================================================
      if (frostIntensity > 0.01) {
        const rimW = Math.round((7 + frostIntensity * 12) * thicknessMult);

        if (renderStyle === 'pixel') {
          const px = 4;
          // Stepped icy cyan-white rim
          ctx.fillStyle = `rgba(224, 242, 254, ${0.72 * frostIntensity})`;
          drawPixelRect(ctx, PAD - px * 2, PAD - px * 2, width + px * 4, px * 2, px);
          drawPixelRect(ctx, PAD - px * 2, PAD + height, width + px * 4, px * 2, px);
          drawPixelRect(ctx, PAD - px * 2, PAD, px * 2, height, px);
          drawPixelRect(ctx, PAD + width, PAD, px * 2, height, px);

          // Pixel frost teeth encroaching inward + hanging icicles
          const toothStep = px * 3;
          for (let x = PAD; x < PAD + width; x += toothStep) {
            const hTop = Math.round((1 + ((x * 7) % 3)) * frostIntensity) * px;
            const hBot = Math.round((2 + ((x * 13) % 4)) * frostIntensity) * px;
            ctx.fillStyle = `rgba(186, 230, 253, ${0.85 * frostIntensity})`;
            drawPixelRect(ctx, x, PAD, px * 2, hTop, px);
            // Hanging icicle below window
            ctx.fillStyle = `rgba(125, 211, 252, ${0.88 * frostIntensity})`;
            drawPixelRect(ctx, x, PAD + height + px, px, hBot, px);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * frostIntensity})`;
            drawPixelRect(ctx, x, PAD + height + px, px, px, px);
          }
        } else {
          ctx.save();

          // Outer & inner frosted rime glow
          const frostGrad = ctx.createLinearGradient(PAD, PAD, PAD, PAD + height);
          frostGrad.addColorStop(0, `rgba(240, 249, 255, ${0.88 * frostIntensity})`);
          frostGrad.addColorStop(0.5, `rgba(186, 230, 253, ${0.72 * frostIntensity})`);
          frostGrad.addColorStop(1, `rgba(224, 242, 254, ${0.88 * frostIntensity})`);

          ctx.shadowColor = `rgba(125, 211, 252, ${0.75 * frostIntensity})`;
          ctx.shadowBlur = 14 * frostIntensity;
          ctx.strokeStyle = frostGrad;
          ctx.lineWidth = rimW * 0.72;
          ctx.lineJoin = 'round';
          ctx.strokeRect(PAD - 2, PAD - 2, width + 4, height + 4);

          // Crisp white inner crystalline edge
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * frostIntensity})`;
          ctx.lineWidth = 1.6;
          ctx.strokeRect(PAD, PAD, width, height);

          // Procedural dendritic frost crystals growing inward from all 4 edges
          const crystalCountTop = Math.floor(width / 26);
          ctx.lineCap = 'round';

          const drawIceFern = (
            ox: number,
            oy: number,
            angle: number,
            len: number,
            alpha: number
          ) => {
            const ex = ox + Math.cos(angle) * len;
            const ey = oy + Math.sin(angle) * len;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Side barbs
            const barbs = 3;
            for (let b = 1; b <= barbs; b++) {
              const frac = b / (barbs + 1);
              const bx = ox + Math.cos(angle) * len * frac;
              const by = oy + Math.sin(angle) * len * frac;
              const bLen = len * 0.42 * (1 - frac * 0.5);

              ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle + 0.65) * bLen, by + Math.sin(angle + 0.65) * bLen);
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle - 0.65) * bLen, by + Math.sin(angle - 0.65) * bLen);
              ctx.stroke();
            }
          };

          for (let i = 0; i <= crystalCountTop; i++) {
            const x = PAD + (i / crystalCountTop) * width;
            const pseudo = Math.abs(Math.sin(i * 12.9898 + seedOffset));
            const len = (8 + pseudo * 18) * frostIntensity * thicknessMult;
            const tilt = (pseudo - 0.5) * 0.55;
            drawIceFern(x, PAD, Math.PI / 2 + tilt, len, 0.82 * frostIntensity);
            drawIceFern(x, PAD + height, -Math.PI / 2 - tilt, len * 0.9, 0.78 * frostIntensity);
          }

          const crystalCountSide = Math.floor(height / 28);
          for (let i = 1; i < crystalCountSide; i++) {
            const y = PAD + (i / crystalCountSide) * height;
            const pseudo = Math.abs(Math.cos(i * 7.23 + seedOffset));
            const len = (7 + pseudo * 16) * frostIntensity * thicknessMult;
            drawIceFern(PAD, y, (pseudo - 0.5) * 0.5, len, 0.76 * frostIntensity);
            drawIceFern(PAD + width, y, Math.PI + (pseudo - 0.5) * 0.5, len, 0.76 * frostIntensity);
          }

          // Twinkling ice sparkles on corners
          const corners = [
            [PAD + 4, PAD + 4],
            [PAD + width - 4, PAD + 4],
            [PAD + 4, PAD + height - 4],
            [PAD + width - 4, PAD + height - 4],
          ];
          corners.forEach(([cx, cy], idx) => {
            const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.5 + idx * 1.7));
            ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * frostIntensity})`;
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.restore();
        }
      }

      // =========================================================
      // 3. COBWEBS (> 2 HOURS UNFOCUSED) + TINY SPIDER
      // =========================================================
      if (activeCobweb > 0.01) {
        const webScale = (0.55 + activeCobweb * 0.65) * thicknessMult;
        const webAlpha = Math.min(0.95, 0.38 + activeCobweb * 0.62);

        const cornerConfigs = [
          { x: PAD - 2, y: PAD - 2, dx: 1, dy: 1, size: 78 * webScale, active: true },
          { x: PAD + width + 2, y: PAD - 2, dx: -1, dy: 1, size: 86 * webScale, active: true },
          {
            x: PAD - 2,
            y: PAD + height + 2,
            dx: 1,
            dy: -1,
            size: 62 * webScale,
            active: activeCobweb > 0.34,
          },
          {
            x: PAD + width + 2,
            y: PAD + height + 2,
            dx: -1,
            dy: -1,
            size: 66 * webScale,
            active: activeCobweb > 0.48,
          },
        ];

        if (renderStyle === 'pixel') {
          const px = 3;
          cornerConfigs.forEach((c) => {
            if (!c.active) return;
            const spokes = 5;
            const rings = Math.max(3, Math.round(3 + activeCobweb * 3));

            // Shadow pass for crisp readability on light OR dark titlebars
            ctx.fillStyle = `rgba(15, 23, 42, ${webAlpha * 0.42})`;
            for (let s = 0; s < spokes; s++) {
              const ang = (s / (spokes - 1)) * (Math.PI / 2);
              const ex = c.x + c.dx * Math.cos(ang) * c.size;
              const ey = c.y + c.dy * Math.sin(ang) * c.size;
              drawPixelLine(ctx, c.x + px, c.y + px, ex + px, ey + px, px);
            }

            // Silk white pass
            ctx.fillStyle = `rgba(248, 250, 252, ${webAlpha})`;
            for (let s = 0; s < spokes; s++) {
              const ang = (s / (spokes - 1)) * (Math.PI / 2);
              const ex = c.x + c.dx * Math.cos(ang) * c.size;
              const ey = c.y + c.dy * Math.sin(ang) * c.size;
              drawPixelLine(ctx, c.x, c.y, ex, ey, px);
            }

            // Concentric stepped silk rings (with dark pixel shadow for light/dark contrast)
            for (let r = 1; r <= rings; r++) {
              const rad = (r / rings) * c.size * 0.88;
              for (let s = 0; s < spokes - 1; s++) {
                const a1 = (s / (spokes - 1)) * (Math.PI / 2);
                const a2 = ((s + 1) / (spokes - 1)) * (Math.PI / 2);
                const x1 = c.x + c.dx * Math.cos(a1) * rad;
                const y1 = c.y + c.dy * Math.sin(a1) * rad;
                const x2 = c.x + c.dx * Math.cos(a2) * rad;
                const y2 = c.y + c.dy * Math.sin(a2) * rad;
                ctx.fillStyle = `rgba(15, 23, 42, ${webAlpha * 0.34})`;
                drawPixelLine(ctx, x1 + px, y1 + px, x2 + px, y2 + px, px);
                ctx.fillStyle =
                  r % 2 === 0
                    ? `rgba(255, 255, 255, ${webAlpha * 0.96})`
                    : `rgba(226, 232, 240, ${webAlpha * 0.9})`;
                drawPixelLine(ctx, x1, y1, x2, y2, px);
              }
            }
          });

          // Pixel-art spider dangling in top-right corner
          if (hasSpider || (isBrushing && brushedWebAmount >= 0.22)) {
            const baseSpiderX = PAD + width - 38;
            const threadLen = isBrushing
              ? Math.max(0, (1 - brushProgress * 1.6) * 34)
              : 24 + Math.sin(t * 2.3) * 4;
            const spiderY = PAD + 6 + threadLen;

            // Vertical silk thread
            ctx.fillStyle = `rgba(248, 250, 252, ${webAlpha})`;
            drawPixelLine(ctx, baseSpiderX + 15, PAD, baseSpiderX + 15, spiderY, px);

            // Pixel spider sprite
            if (!isBrushing || brushProgress < 0.65) {
              for (let row = 0; row < PIXEL_SPIDER.length; row++) {
                for (let col = 0; col < PIXEL_SPIDER[row].length; col++) {
                  const cell = PIXEL_SPIDER[row][col];
                  if (cell === 0) continue;
                  ctx.fillStyle = cell === 2 ? '#F8FAFC' : '#18181B';
                  ctx.fillRect(baseSpiderX + col * px, spiderY + row * px, px, px);
                }
              }
            }
          }
        } else {
          // ORGANIC PROCEDURAL COBWEBS + TINY SPIDER
          ctx.save();
          ctx.lineCap = 'round';

          cornerConfigs.forEach((c) => {
            if (!c.active) return;
            const spokes = 6;
            const rings = Math.max(4, Math.round(4 + activeCobweb * 4));

            // Subtle corner dust shadow so white silk stands out on both light and dark windows
            const dustGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.size * 0.95);
            dustGrad.addColorStop(0, `rgba(15, 23, 42, ${webAlpha * 0.22})`);
            dustGrad.addColorStop(0.65, `rgba(30, 41, 59, ${webAlpha * 0.08})`);
            dustGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            ctx.fillStyle = dustGrad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size * 0.95, 0, Math.PI * 2);
            ctx.fill();

            // 1. Radial anchor threads
            for (let s = 0; s < spokes; s++) {
              const ang = (s / (spokes - 1)) * (Math.PI / 2);
              const len = c.size * (s === 0 || s === spokes - 1 ? 1.08 : 0.94);
              const ex = c.x + c.dx * Math.cos(ang) * len;
              const ey = c.y + c.dy * Math.sin(ang) * len;

              // Subtle dark backing for high contrast
              ctx.strokeStyle = `rgba(15, 23, 42, ${webAlpha * 0.28})`;
              ctx.lineWidth = 2.1;
              ctx.beginPath();
              ctx.moveTo(c.x, c.y);
              ctx.lineTo(ex, ey);
              ctx.stroke();

              // Crisp white silk strand
              ctx.strokeStyle = `rgba(255, 255, 255, ${webAlpha * 0.92})`;
              ctx.lineWidth = 1.15;
              ctx.beginPath();
              ctx.moveTo(c.x, c.y);
              ctx.lineTo(ex, ey);
              ctx.stroke();
            }

            // 2. Sagging catenary spiral silk rings
            for (let r = 1; r <= rings; r++) {
              const rad = (r / rings) * c.size * 0.88;

              ctx.beginPath();
              for (let s = 0; s < spokes - 1; s++) {
                const a1 = (s / (spokes - 1)) * (Math.PI / 2);
                const a2 = ((s + 1) / (spokes - 1)) * (Math.PI / 2);
                const x1 = c.x + c.dx * Math.cos(a1) * rad;
                const y1 = c.y + c.dy * Math.sin(a1) * rad;
                const x2 = c.x + c.dx * Math.cos(a2) * rad;
                const y2 = c.y + c.dy * Math.sin(a2) * rad;

                // Sag slightly inward toward the corner apex
                const midX = (x1 + x2) * 0.5 - c.dx * (rad * 0.08);
                const midY = (y1 + y2) * 0.5 - c.dy * (rad * 0.08);

                if (s === 0) ctx.moveTo(x1, y1);
                ctx.quadraticCurveTo(midX, midY, x2, y2);
              }

              // Dark backing stroke for crisp visibility on light & dark titlebars
              ctx.strokeStyle = `rgba(15, 23, 42, ${webAlpha * 0.24})`;
              ctx.lineWidth = 1.8;
              ctx.stroke();

              // Crisp white silk stroke
              ctx.strokeStyle = `rgba(255, 255, 255, ${webAlpha * (0.9 - r * 0.035)})`;
              ctx.lineWidth = 1.0;
              ctx.stroke();
            }
          });

          // Tiny animated 8-legged spider hanging in the top-right corner!
          if (hasSpider || (isBrushing && brushedWebAmount >= 0.22)) {
            const sx = PAD + width - 34;
            const threadLen = isBrushing
              ? Math.max(0, (1 - brushProgress * 1.7) * 34)
              : 24 + Math.sin(t * 2.2) * 4.5;
            const sy = PAD + 8 + threadLen;

            // Vertical silk thread
            ctx.strokeStyle = `rgba(255, 255, 255, ${webAlpha * 0.85})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, PAD);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            if (!isBrushing || brushProgress < 0.65) {
              ctx.save();
              ctx.translate(sx, sy);
              const wiggle = Math.sin(t * 7.5) * 0.14;

              // 8 jointed legs
              ctx.strokeStyle = '#18181B';
              ctx.lineWidth = 1.25;
              for (let side of [-1, 1]) {
                for (let leg = 0; leg < 4; leg++) {
                  const baseAngle = (leg - 1.5) * 0.36 + (leg % 2 === 0 ? wiggle : -wiggle);
                  const kx = side * Math.cos(baseAngle) * 5.2;
                  const ky = Math.sin(baseAngle) * 4.5 - 1.2;
                  const fx = side * (Math.cos(baseAngle) * 8.4);
                  const fy = Math.sin(baseAngle) * 7.2 + 2.1;

                  ctx.beginPath();
                  ctx.moveTo(0, 0);
                  ctx.lineTo(kx, ky);
                  ctx.lineTo(fx, fy);
                  ctx.stroke();
                }
              }

              // Abdomen & head
              ctx.fillStyle = '#18181B';
              ctx.beginPath();
              ctx.ellipse(0, -2.6, 3.3, 4.1, 0, 0, Math.PI * 2);
              ctx.fill();

              ctx.beginPath();
              ctx.arc(0, 2.2, 2.3, 0, Math.PI * 2);
              ctx.fill();

              // Subtle sheen & two tiny eyes
              ctx.fillStyle = '#F8FAFC';
              ctx.beginPath();
              ctx.arc(-0.9, 3.6, 0.65, 0, Math.PI * 2);
              ctx.arc(0.9, 3.6, 0.65, 0, Math.PI * 2);
              ctx.fill();

              ctx.restore();
            }
          }

          ctx.restore();
        }
      }

      // =========================================================
      // 4. BRUSH-AWAY PARTICLES & DUSTER SWEEP
      // =========================================================
      if (particlesRef.current.length > 0) {
        const nextParticles: SilkParticle[] = [];
        ctx.save();
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.04; // gentle float gravity
          p.vx *= 0.97;
          p.rotation += p.vRot;
          p.alpha -= 0.022;

          if (p.alpha > 0.02) {
            nextParticles.push(p);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha * 0.8})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-p.size, 0);
            ctx.quadraticCurveTo(0, -p.size * 0.5, p.size, p.size * 0.2);
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
        particlesRef.current = nextParticles;
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [
    width,
    height,
    cobwebIntensity,
    heatIntensity,
    frostIntensity,
    hasSpider,
    renderStyle,
    thicknessMult,
    brushingUntil,
    brushedWebAmount,
    seedOffset,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: -PAD,
        left: -PAD,
        width: width + PAD * 2,
        height: height + PAD * 2,
        pointerEvents: 'none',
        zIndex: 25,
      }}
    />
  );
};
