'use client';

import React, { useEffect, useId, useRef } from 'react';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LUT: string[] = new Array(4096);
for (let i = 0; i < 64; i++) {
  for (let j = 0; j < 64; j++) {
    BASE64_LUT[(i << 6) | j] = BASE64_CHARS[i] + BASE64_CHARS[j];
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64_LUT[n >> 12] + BASE64_LUT[n & 0xfff];
  }
  if (i < len) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const n = (a << 16) | (b << 8);
    out +=
      BASE64_CHARS[(n >> 18) & 63] +
      BASE64_CHARS[(n >> 12) & 63] +
      (i + 1 < len ? BASE64_CHARS[(n >> 6) & 63] : '=') +
      '=';
  }
  return out;
}

function createBmpBuffer(width: number, height: number): Uint8Array {
  const rowSize = width * 3; // width is always a multiple of 4, so rowSize is a multiple of 4
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BITMAPFILEHEADER (14 bytes)
  buf[0] = 0x42; // 'B'
  buf[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up DIB
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true); // 24-bit BGR
  view.setUint32(34, pixelDataSize, true);

  // Fill neutral displacement (128, 128, 128)
  buf.fill(128, 54);
  return buf;
}

const TRAIL_CAPACITY = 32;
const FILTER_PAD_X = 0.15;
const FILTER_PAD_Y = 0.25;

interface TrailContext {
  activeIndices: number[];
  posX: Float32Array;
  posY: Float32Array;
  posT: Float32Array;
  posS: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  t: number;
  life: number;
  radiusSq: number;
  cutoffDistSq: number;
  torsion: number;
}

function getActiveTrailIndices(
  t: number,
  posT: Float32Array,
  posS: Float32Array,
  life: number
): number[] {
  const activeIndices: number[] = [];
  for (let i = 0; i < TRAIL_CAPACITY; i++) {
    const age = t - posT[i];
    if (posS[i] > 0 && age >= 0 && age <= life) {
      activeIndices.push(i);
    }
  }
  return activeIndices;
}

function computePixelDisplacement(
  px: number,
  py: number,
  ctx: TrailContext
): { r: number; g: number } {
  let dx = 0;
  let dy = 0;

  for (let a = 0; a < ctx.activeIndices.length; a++) {
    const idx = ctx.activeIndices[a];
    const dvx = px - ctx.posX[idx];
    const dvy = py - ctx.posY[idx];
    const distSq = dvx * dvx + dvy * dvy;
    if (distSq > ctx.cutoffDistSq) continue;

    const age = ctx.t - ctx.posT[idx];
    const k = Math.exp(-distSq / ctx.radiusSq);
    let fade = 1 - age / ctx.life;
    fade *= fade;

    const vx = ctx.velX[idx] * ctx.posS[idx];
    const vy = ctx.velY[idx] * ctx.posS[idx];
    const swirl = ctx.torsion * Math.sin(Math.sqrt(distSq) * 0.04 - age * 5.0);

    const weight = k * fade;
    dx += (vx - vy * swirl) * weight;
    dy += (vy + vx * swirl) * weight;
  }

  if (dx === 0 && dy === 0) {
    return { r: 128, g: 128 };
  }

  const m = Math.hypot(dx, dy);
  if (m > 1) {
    dx /= m;
    dy /= m;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(128 - dx * 127))),
    g: Math.max(0, Math.min(255, Math.round(128 - dy * 127))),
  };
}

function renderDisplacementMap(
  bmpBuf: Uint8Array,
  mapW: number,
  mapH: number,
  rowSize: number,
  cssW: number,
  cssH: number,
  ctx: TrailContext
) {
  const spanX = 1 + 2 * FILTER_PAD_X;
  const spanY = 1 + 2 * FILTER_PAD_Y;

  for (let gy = 0; gy < mapH; gy++) {
    const py = (-FILTER_PAD_Y + (gy / (mapH - 1)) * spanY) * cssH;
    const rowOffset = 54 + (mapH - 1 - gy) * rowSize;

    for (let gx = 0; gx < mapW; gx++) {
      const px = (-FILTER_PAD_X + (gx / (mapW - 1)) * spanX) * cssW;
      const { r, g } = computePixelDisplacement(px, py, ctx);

      const pixelOffset = rowOffset + gx * 3;
      bmpBuf[pixelOffset] = 128; // B
      bmpBuf[pixelOffset + 1] = g; // G (Y displacement)
      bmpBuf[pixelOffset + 2] = r; // R (X displacement)
    }
  }
}

export interface LiquidDistortionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Maximum displacement strength in pixels (default: 28) */
  strength?: number;
  /** Brush radius in CSS pixels (default: 95) */
  radius?: number;
  /** Trail lifetime in seconds (default: 0.45) */
  life?: number;
  /** Lateral wave torsion / swirl intensity (default: 0.35) */
  torsion?: number;
  /** RGB chromatic aberration split ratio (default: 0.2) */
  chromatic?: number;
  /** Internal displacement map resolution width (default: 96) */
  gridWidth?: number;
  /** Internal displacement map resolution height (default: 48) */
  gridHeight?: number;
  /** Disable distortion effect */
  disabled?: boolean;
}

/**
 * Agnostic liquid distortion wrapper that applies the same 32-point Gaussian velocity + wave torsion
 * + RGB chromatic aberration physics from WebGL shaders onto any DOM element (text, headings,
 * videos, images, SVGs, cards) via a dynamic SVG displacement filter.
 */
export function LiquidDistortion({
  children,
  className,
  style,
  strength = 28,
  radius = 95,
  life = 0.45,
  torsion = 0.35,
  chromatic = 0.2,
  gridWidth = 96,
  gridHeight = 48,
  disabled = false,
}: LiquidDistortionProps) {
  const rawId = useId();
  const filterId = `liquid-distortion-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);

  // Ensure width is a multiple of 4 for 24-bit BMP row alignment
  const mapW = Math.max(16, Math.round(gridWidth / 4) * 4);
  const mapH = Math.max(16, Math.round(gridHeight));

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const el = containerRef.current;
    const feImage = feImageRef.current;
    if (!el || !feImage) return;

    const bmpBuf = createBmpBuffer(mapW, mapH);
    const rowSize = mapW * 3;

    // Ring buffer of 32 points: [x, y, timestamp, strength] and [vx, vy]
    const posX = new Float32Array(TRAIL_CAPACITY);
    const posY = new Float32Array(TRAIL_CAPACITY);
    const posT = new Float32Array(TRAIL_CAPACITY);
    const posS = new Float32Array(TRAIL_CAPACITY);
    const velX = new Float32Array(TRAIL_CAPACITY);
    const velY = new Float32Array(TRAIL_CAPACITY);
    posT.fill(-999);

    let writeIdx = 0;
    let lastMouse: { x: number; y: number } | null = null;
    let rafId: number | null = null;
    let filterApplied = false;
    let isInView = true;

    const startTime = performance.now();
    const nowSec = () => (performance.now() - startTime) / 1000;

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        entries => {
          if (entries[0]) {
            isInView = entries[0].isIntersecting;
          }
        },
        { rootMargin: '150px' }
      );
      observer.observe(el);
    }

    const renderFrame = () => {
      rafId = null;
      const t = nowSec();

      const activeIndices = getActiveTrailIndices(t, posT, posS, life);

      if (activeIndices.length === 0) {
        if (filterApplied) {
          el.style.filter = '';
          el.style.willChange = '';
          filterApplied = false;
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      const cssW = rect.width || 1;
      const cssH = rect.height || 1;
      const radiusSq = radius * radius;
      const cutoffDistSq = radiusSq * 4.5; // exp(-4.5) ~ 0.011

      const trailCtx: TrailContext = {
        activeIndices,
        posX,
        posY,
        posT,
        posS,
        velX,
        velY,
        t,
        life,
        radiusSq,
        cutoffDistSq,
        torsion,
      };

      renderDisplacementMap(bmpBuf, mapW, mapH, rowSize, cssW, cssH, trailCtx);

      const dataUrl = 'data:image/bmp;base64,' + uint8ToBase64(bmpBuf);
      feImage.setAttribute('href', dataUrl);

      if (!filterApplied) {
        el.style.willChange = 'filter';
        el.style.filter = `url(#${filterId})`;
        filterApplied = true;
      }
    };

    const scheduleRender = () => {
      if (rafId !== null) return;
      const loop = () => {
        rafId = null;
        renderFrame();
        if (filterApplied && rafId === null) {
          rafId = requestAnimationFrame(loop);
        }
      };
      rafId = requestAnimationFrame(loop);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isInView) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Activate when pointer is inside the element or within brush radius of its edges
      const isNear =
        x >= -radius &&
        x <= rect.width + radius &&
        y >= -radius &&
        y <= rect.height + radius;

      if (!isNear) {
        lastMouse = null;
        return;
      }

      const t = nowSec();
      if (lastMouse) {
        const dx = x - lastMouse.x;
        const dy = y - lastMouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) return;

        const moveStrength = Math.min(1, dist / 18);
        posX[writeIdx] = x;
        posY[writeIdx] = y;
        posT[writeIdx] = t;
        posS[writeIdx] = moveStrength;
        velX[writeIdx] = dx / dist;
        velY[writeIdx] = dy / dist;
        writeIdx = (writeIdx + 1) % TRAIL_CAPACITY;

        scheduleRender();
      }

      lastMouse = { x, y };
    };

    const onMouseLeaveWindow = () => {
      lastMouse = null;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onMouseLeaveWindow, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseleave', onMouseLeaveWindow);
      if (observer) observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.style.filter = '';
      el.style.willChange = '';
    };
  }, [disabled, filterId, life, mapH, mapW, radius, torsion]);

  const scaleR = Number((strength * (1 + chromatic)).toFixed(2));
  const scaleG = Number(strength.toFixed(2));
  const scaleB = Number((strength * Math.max(0, 1 - chromatic)).toFixed(2));

  return (
    <div ref={containerRef} className={className} style={style}>
      <svg
        aria-hidden="true"
         focusable="false"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        style={{ position: 'absolute', width: 0, height: 0 }}
      >
        <defs>
          <filter
            id={filterId}
            x={`-${FILTER_PAD_X * 100}%`}
            y={`-${FILTER_PAD_Y * 100}%`}
            width={`${(1 + 2 * FILTER_PAD_X) * 100}%`}
            height={`${(1 + 2 * FILTER_PAD_Y) * 100}%`}
            colorInterpolationFilters="sRGB"
          >
            <feImage
              ref={feImageRef}
              preserveAspectRatio="none"
              result="dispMap"
            />

            {/* Main displaced graphic */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale={scaleG}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispG"
            />

            {chromatic > 0 ? (
              <>
                {/* Leading chromatic wave edge (Red/Coral shift) */}
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="dispMap"
                  scale={scaleR}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="dispR"
                />
                <feComposite in="dispR" in2="dispG" operator="out" result="edgeR" />
                <feColorMatrix
                  in="edgeR"
                  type="matrix"
                  values="
                    0 0 0 0 1.0
                    0 0 0 0 0.28
                    0 0 0 0 0.38
                    0 0 0 0.65 0"
                  result="tintR"
                />

                {/* Trailing chromatic wave edge (Cyan/Mint shift) */}
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="dispMap"
                  scale={scaleB}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="dispB"
                />
                <feComposite in="dispB" in2="dispG" operator="out" result="edgeB" />
                <feColorMatrix
                  in="edgeB"
                  type="matrix"
                  values="
                    0 0 0 0 0.25
                    0 0 0 0 0.95
                    0 0 0 0 0.82
                    0 0 0 0.65 0"
                  result="tintB"
                />

                <feMerge>
                  <feMergeNode in="tintR" />
                  <feMergeNode in="tintB" />
                  <feMergeNode in="dispG" />
                </feMerge>
              </>
            ) : null}
          </filter>
        </defs>
      </svg>
      {children}
    </div>
  );
}
