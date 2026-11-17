'use client';

import { useEffect, useRef } from 'react';

interface AsciiBackgroundProps {
  className?: string;
  charDensity?: number;
  forceDark?: boolean;
}

export function AsciiBackground({
  className = '',
  charDensity = 55,
  forceDark = false,
}: AsciiBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let W = 0;
    let H = 0;

    // Brand symbols only — matches the EVRE identity
    const chars = ['>', '/', '<'];
    type Cell = { x: number; y: number; s: string; ph: number; sp: number; sz: number };
    let cells: Cell[] = [];

    const rebuild = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const nextW = parent.clientWidth;
      const nextH = parent.clientHeight;
      if (cells.length > 0 && nextW === W && nextH <= H) return;
      const dpr = window.devicePixelRatio || 1;
      W = nextW;
      H = nextH;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      const cols = Math.ceil(W / charDensity) + 1;
      const rows = Math.ceil(H / charDensity) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({
            x: c * charDensity + (Math.random() - 0.5) * 10,
            y: r * charDensity + (Math.random() - 0.5) * 10,
            s: chars[Math.floor(Math.random() * 3)],
            ph: Math.random() * Math.PI * 2,
            sp: 0.25 + Math.random() * 0.35,
            sz: 9 + Math.random() * 4,
          });
        }
      }
    };

    rebuild();
    window.addEventListener('resize', rebuild);

    let t = 0;
    let visible = true;
    const render = () => {
      if (!visible) return;
      t += 0.003;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.4;
      const maxD = Math.sqrt(cx * cx + cy * cy);

      const isDark = forceDark || document.documentElement.classList.contains('dark');
      cells.forEach(cell => {
        const dx = cell.x - cx;
        const dy = cell.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const radial = Math.max(0, 1 - d / maxD);
        const a = 0.025 + radial * 0.07 + Math.sin(t * cell.sp + cell.ph) * 0.015;
        if (a <= 0) return;

        ctx.font = `${cell.sz}px 'Inter', monospace`;
        ctx.fillStyle = isDark
          ? `rgba(240,239,238,${Math.max(0, a)})`
          : `rgba(20,20,20,${Math.min(0.3, Math.max(0, a * 2.5))})`;
        ctx.fillText(cell.s, cell.x, cell.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible) render();
    });
    observer.observe(canvas);

    render();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', rebuild);
      cancelAnimationFrame(animationFrameId);
    };
  }, [charDensity, forceDark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
    />
  );
}
