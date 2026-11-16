import type { BlockPropMeta } from './blocks.meta';

/** Parâmetro de um efeito — mesma shape de `BlockPropMeta` (`blocks.meta.ts`) de propósito: o
 * painel já sabe desenhar `number`/`boolean`/`string` a partir dela (`PropField` em
 * `editor/panel.tsx`), então um efeito novo ganha UI de edição sem nenhum componente próprio. */
export type EffectParamMeta = BlockPropMeta;

export interface EffectMeta {
  label: string;
  description: string;
  params: EffectParamMeta[];
}

/** Catálogo de efeitos visuais do PageBuilder, sem dependência de React — espelha o papel de
 * `BLOCK_META`. Componentes ficam em `effects.tsx`, amarrados por `type` ao `EFFECT_REGISTRY`. */
export const EFFECT_META = {
  tilt3d: {
    label: 'Inclinação 3D',
    description:
      'Inclina o bloco em perspectiva (estático, sem rastrear o mouse) — mesma técnica usada ' +
      'nos cartões de demonstração da landing.',
    params: [
      { name: 'rotateX', type: 'number', required: false },
      { name: 'rotateY', type: 'number', required: false },
      { name: 'perspective', type: 'number', required: false },
    ],
  },
  'liquid-distortion': {
    label: 'Distorção Líquida',
    description:
      'Rastro de distorção líquida que segue o mouse sobre o bloco, com leve aberração cromática ' +
      '— filtro SVG dinâmico, respeita prefers-reduced-motion.',
    params: [
      { name: 'strength', type: 'number', required: false },
      { name: 'radius', type: 'number', required: false },
      { name: 'torsion', type: 'number', required: false },
      { name: 'chromatic', type: 'number', required: false },
    ],
  },
} as const satisfies Record<string, EffectMeta>;

export type EffectType = keyof typeof EFFECT_META;

export function isKnownEffect(type: string): type is EffectType {
  return type in EFFECT_META;
}

/** Catálogo publicado à ponte (`/api/agent/page-builder/schema`) para o editor e o agente. */
export function describeEffects() {
  return Object.entries(EFFECT_META).map(([type, meta]) => ({
    type,
    label: meta.label,
    description: meta.description,
    params: meta.params.map((p): EffectParamMeta => ({ ...p })),
  }));
}
