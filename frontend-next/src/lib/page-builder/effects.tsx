'use client';

import React from 'react';
import { LiquidDistortion } from '@/components/landing/liquid-distortion';
import { EFFECT_META, isKnownEffect, type EffectType } from './effects.meta';
import type { PageBlock } from './schema';

export interface EffectProps {
  children: React.ReactNode;
  params: Record<string, unknown>;
  /** `false` mantém o componente montado mas visualmente inerte — nunca desmonte um efeito só
   * pra "desligá-lo"; troque este prop. É o que deixa o wrapper (`renderer.tsx#EffectRuntime`)
   * com identidade estável entre entrar/sair de edição, sem perder o DOM/estado de `children`. */
  active: boolean;
}

export function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

// Exportados pro gizmo (`editor/effect-gizmos.tsx`) usar o MESMO default do efeito real — nunca
// dois números mágicos que podem divergir.
export const DEFAULT_ROTATE_X = 6;
export const DEFAULT_ROTATE_Y = 3;
export const DEFAULT_PERSPECTIVE = 1200;

/** Mesma técnica estática já usada em `sistemas-section.tsx`/`sites-section.tsx` — sem
 * mouse-tracking, custo zero de JS por frame. Inativo = sem transform (equivalente a não ter
 * nenhum wrapper, só que sem desmontar `children`). */
function Tilt3DEffect({ children, params, active }: EffectProps) {
  const rotateX = num(params.rotateX) ?? DEFAULT_ROTATE_X;
  const rotateY = num(params.rotateY) ?? DEFAULT_ROTATE_Y;
  const perspective = num(params.perspective) ?? DEFAULT_PERSPECTIVE;
  const style = active
    ? { transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` }
    : undefined;

  return <div style={style}>{children}</div>;
}

/** Adapter fino sobre `components/landing/liquid-distortion.tsx` — reusa o filtro SVG/mouse-trail
 * pronto, só traduz `params` (vindos do layout, `unknown`) pros props tipados do componente.
 * `disabled` (prop que o componente original já tem) é o próprio `!active`: inativo para de
 * ouvir o mouse e de desenhar o filtro, sem desmontar. */
function LiquidDistortionEffect({ children, params, active }: EffectProps) {
  return (
    <LiquidDistortion
      disabled={!active}
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

/** Embrulha `children` com o efeito indicado, sempre ativo — usado fora do canvas de edição
 * (página pública, modal de Preview), onde não existe conceito de "editando"/"inerte". `type`
 * desconhecido devolve `children` como estão, igual ao bloco de `type` desconhecido: nunca
 * quebra a tela. */
export function wrapWithEffectActive(
  children: React.ReactNode,
  type: string,
  params: Record<string, unknown>,
  active: boolean,
): React.ReactNode {
  if (!isKnownEffect(type)) return children;
  const Effect = EFFECT_REGISTRY[type];
  return (
    <Effect params={params} active={active}>
      {children}
    </Effect>
  );
}

/** Embrulha `children` com o efeito do bloco, sempre ativo; sem `effect` ou `type` desconhecido,
 * devolve `children` como estão. */
export function wrapWithEffect(children: React.ReactNode, effect: PageBlock['effect']): React.ReactNode {
  if (!effect) return children;
  return wrapWithEffectActive(children, effect.type, effect.params ?? {}, true);
}

export { EFFECT_META };
