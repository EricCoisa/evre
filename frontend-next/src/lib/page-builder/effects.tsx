'use client';

import React from 'react';
import { LiquidDistortion } from '@/components/landing/liquid-distortion';
import { EFFECT_META, isKnownEffect, type EffectType } from './effects.meta';
import type { PageBlock } from './schema';

export interface EffectProps {
  children: React.ReactNode;
  params: Record<string, unknown>;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

const DEFAULT_ROTATE_X = 6;
const DEFAULT_ROTATE_Y = 3;
const DEFAULT_PERSPECTIVE = 1200;

/** Mesma técnica estática já usada em `sistemas-section.tsx`/`sites-section.tsx` — sem
 * mouse-tracking, custo zero de JS por frame. */
function Tilt3DEffect({ children, params }: EffectProps) {
  const rotateX = num(params.rotateX) ?? DEFAULT_ROTATE_X;
  const rotateY = num(params.rotateY) ?? DEFAULT_ROTATE_Y;
  const perspective = num(params.perspective) ?? DEFAULT_PERSPECTIVE;

  return (
    <div style={{ transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` }}>
      {children}
    </div>
  );
}

/** Adapter fino sobre `components/landing/liquid-distortion.tsx` — reusa o filtro SVG/mouse-trail
 * pronto, só traduz `params` (vindos do layout, `unknown`) pros props tipados do componente. */
function LiquidDistortionEffect({ children, params }: EffectProps) {
  return (
    <LiquidDistortion
      strength={num(params.strength)}
      radius={num(params.radius)}
      torsion={num(params.torsion)}
      chromatic={num(params.chromatic)}
    >
      {children}
    </LiquidDistortion>
  );
}

/** Mapa de componentes dos efeitos, amarrado por `type` ao `EFFECT_META` — efeito descrito sem
 * componente (ou vice-versa) não compila, mesmo princípio de `BLOCK_REGISTRY`. */
export const EFFECT_REGISTRY: Record<EffectType, (p: EffectProps) => React.ReactNode> = {
  tilt3d: Tilt3DEffect,
  'liquid-distortion': LiquidDistortionEffect,
};

/** Embrulha `children` com o efeito do bloco; sem `effect` ou `type` desconhecido, devolve
 * `children` como estão — igual ao bloco de `type` desconhecido, nunca quebra a tela. */
export function wrapWithEffect(children: React.ReactNode, effect: PageBlock['effect']): React.ReactNode {
  if (!effect || !isKnownEffect(effect.type)) return children;
  const Effect = EFFECT_REGISTRY[effect.type];
  return <Effect params={effect.params ?? {}}>{children}</Effect>;
}

export { EFFECT_META };
