'use client';

import React from 'react';
import { DEFAULT_ROTATE_X, DEFAULT_ROTATE_Y, num } from '../effects';
import type { EffectType } from '../effects.meta';

export interface EffectGizmoProps {
  params: Record<string, unknown>;
  /** Chamado a cada frame de arrasto — o chamador decide onde isso vai (rascunho local durante
   * edição, nunca o layout direto). */
  onChange: (patch: Record<string, unknown>) => void;
}

const DEG_PER_PIXEL = 0.4;
const KEY_STEP = 2;
const MAX_TILT = 60;

function clampTilt(value: number): number {
  return Math.min(MAX_TILT, Math.max(-MAX_TILT, value));
}

interface DragStart {
  pointerX: number;
  pointerY: number;
  rotateX: number;
  rotateY: number;
}

/** Esfera estilo Blender: clicar e arrastar altera `rotateX`/`rotateY` ao vivo. A própria esfera
 * usa a mesma técnica CSS do efeito real (`Tilt3DEffect`, `effects.tsx`) — o gizmo literalmente
 * parece o efeito que está controlando. "Trackball" linear simples (não arcball físico): cobre o
 * pedido ("clica e arrasta"), não uma simulação de rotação 3D composta. Setas do teclado também
 * funcionam — a esfera é um atalho visual, os campos numéricos ao lado continuam sendo o caminho
 * totalmente acessível por teclado/leitor de tela. */
export function Tilt3DGizmo({ params, onChange }: EffectGizmoProps) {
  const rotateX = num(params.rotateX) ?? DEFAULT_ROTATE_X;
  const rotateY = num(params.rotateY) ?? DEFAULT_ROTATE_Y;
  const dragRef = React.useRef<DragStart | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerX: e.clientX, pointerY: e.clientY, rotateX, rotateY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;
    onChange({
      rotateY: clampTilt(start.rotateY + dx * DEG_PER_PIXEL),
      rotateX: clampTilt(start.rotateX - dy * DEG_PER_PIXEL),
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    if (e.key === 'ArrowLeft') onChange({ rotateY: clampTilt(rotateY - step) });
    else if (e.key === 'ArrowRight') onChange({ rotateY: clampTilt(rotateY + step) });
    else if (e.key === 'ArrowUp') onChange({ rotateX: clampTilt(rotateX - step) });
    else if (e.key === 'ArrowDown') onChange({ rotateX: clampTilt(rotateX + step) });
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col items-center gap-2 py-2" style={{ perspective: 400 }}>
      <div
        tabIndex={0}
        aria-label={`Inclinação 3D — eixo X ${rotateX.toFixed(0)} graus, eixo Y ${rotateY.toFixed(0)} graus. Arraste ou use as setas do teclado.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        className="relative size-20 cursor-grab touch-none select-none rounded-full shadow-lg outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          background:
            'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.5), transparent 50%),' +
            'radial-gradient(circle at 70% 80%, rgba(0,0,0,0.35), transparent 60%),' +
            'var(--primary)',
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/30" />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/30" />
      </div>
      <p className="text-muted-foreground text-[10px] tabular-nums">
        X {rotateX.toFixed(0)}° · Y {rotateY.toFixed(0)}°
      </p>
    </div>
  );
}

/** Parcial de propósito — nem todo efeito precisa de gizmo espacial custom. Sem entrada aqui, a
 * edição cai no fallback genérico: os campos numéricos de `EFFECT_META[type].params` (já
 * desenhados por `PropField`), só que conectados ao rascunho ao vivo em vez de `editor.patch`
 * direto — um efeito novo já nasce editável, o gizmo é só para quando valer o esforço visual. */
export const EFFECT_GIZMOS: Partial<Record<EffectType, (p: EffectGizmoProps) => React.ReactNode>> = {
  tilt3d: Tilt3DGizmo,
};
