'use client';

import { useEffect, useRef } from 'react';

interface AsciiBackgroundProps {
  className?: string;
  charDensity?: number;
}

export function AsciiBackground({
  className = '',
  charDensity = 30,
}: AsciiBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const chars = ['<', '/', '>', '{', '}', ';', '0', '1', '+', '~', ':', '_', '.'];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = canvas.width = parent.clientWidth;
      height = canvas.height = parent.clientHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    let step = 0;

    const render = () => {
      step += 0.015;
      ctx.clearRect(0, 0, width, height);

      const cellWidth = charDensity;
      const cellHeight = charDensity;
      const cols = Math.ceil(width / cellWidth);
      const rows = Math.ceil(height / cellHeight);

      // Detecta se está no modo escuro dinamicamente
      const isDark = document.documentElement.classList.contains('dark');

      ctx.font = '12px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cellWidth + cellWidth / 2;
          const y = r * cellHeight + cellHeight / 2;

          const wave =
            Math.sin(c * 0.15 + step) * Math.cos(r * 0.15 + step * 0.8);

          const dx = (x - width / 2) / (width / 2);
          const dy = (y - height * 0.35) / (height * 0.5);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radialFade = Math.max(0, 1 - dist * 0.85);

          const baseOpacity = isDark ? 0.28 : 0.22;
          const opacity = Math.max(0, (wave * 0.5 + 0.5) * baseOpacity * radialFade);

          if (opacity > 0.02) {
            const charIndex = Math.floor(
              Math.abs(Math.sin(c * 17 + r * 31 + Math.floor(step * 2))) *
                chars.length
            ) % chars.length;

            const char = chars[charIndex];

            if (char === '<' || char === '>' || char === '/') {
              ctx.fillStyle = isDark
                ? `rgba(250, 249, 249, ${opacity * 1.6})`
                : `rgba(20, 20, 20, ${opacity * 1.6})`;
            } else {
              ctx.fillStyle = isDark
                ? `rgba(185, 185, 185, ${opacity})`
                : `rgba(100, 100, 100, ${opacity})`;
            }

            ctx.fillText(char, x, y);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [charDensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60 dark:opacity-70 ${className}`}
    />
  );
}
