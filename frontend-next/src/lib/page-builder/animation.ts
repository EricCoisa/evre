import type { TargetAndTransition, Transition } from 'motion/react';

/** `hidden`/`visible` como par de alvos simples — `TargetAndTransition`, nunca a forma função de
 * `Variants` (que o `motion.div` também aceita, mas não cabe num preset declarado estaticamente). */
interface EntranceVariant {
  hidden: TargetAndTransition;
  visible: TargetAndTransition;
}

/** Vocabulário fechado de animação de bloco — nunca config livre, igual a `class-names.ts`/`SPAN_CLASS`. */
export const ENTRANCE_PRESETS = [
  'none',
  'fade',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
] as const;
export type EntrancePreset = (typeof ENTRANCE_PRESETS)[number];

export const HOVER_PRESETS = ['none', 'lift', 'scale', 'glow'] as const;
export type HoverPreset = (typeof HOVER_PRESETS)[number];

/** `load` roda uma vez ao montar; `scroll` anima ao entrar E ao sair do viewport. */
export const ANIMATION_TRIGGERS = ['load', 'scroll'] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];

export const DEFAULT_DURATION = 0.4;
export const DEFAULT_DELAY = 0;
export const MIN_DURATION = 0.1;
export const MAX_DURATION = 1.5;
export const MIN_DELAY = 0;
export const MAX_DELAY = 1;

/** Config de animação de UM bloco, ou o padrão de página — mesma shape nos dois (ver `schema.ts`). */
export interface BlockAnimation {
  entrance?: EntrancePreset;
  trigger?: AnimationTrigger;
  hover?: HoverPreset;
  duration?: number;
  delay?: number;
}

/** Config já resolvida (bloco → página → default), sempre com todos os campos presentes. */
export interface ResolvedAnimation {
  entrance: EntrancePreset;
  trigger: AnimationTrigger;
  hover: HoverPreset;
  duration: number;
  delay: number;
}

/** Chave de i18n por preset — única fonte, usada pelo painel e pela toolbar flutuante do canvas
 * (`editor/panel.tsx`, `editor/block-chrome.tsx`) para não duplicar o rótulo em dois lugares. */
export const ANIMATION_PRESET_LABEL_KEY: Record<EntrancePreset, string> = {
  none: 'animationPresetNone',
  fade: 'animationPresetFade',
  'slide-up': 'animationPresetSlideUp',
  'slide-down': 'animationPresetSlideDown',
  'slide-left': 'animationPresetSlideLeft',
  'slide-right': 'animationPresetSlideRight',
  'zoom-in': 'animationPresetZoomIn',
};

export const HOVER_PRESET_LABEL_KEY: Record<HoverPreset, string> = {
  none: 'animationHoverNone',
  lift: 'animationHoverLift',
  scale: 'animationHoverScale',
  glow: 'animationHoverGlow',
};

export const ANIMATION_TRIGGER_LABEL_KEY: Record<AnimationTrigger, string> = {
  load: 'animationTriggerLoad',
  scroll: 'animationTriggerScroll',
};

const SLIDE_DISTANCE = 24;

/** `hidden`/`visible` por preset de entrada — consumido via `initial`/`animate`/`whileInView`. */
export const ANIMATION_VARIANTS: Record<EntrancePreset, EntranceVariant> = {
  none: { hidden: {}, visible: {} },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  'slide-up': { hidden: { opacity: 0, y: SLIDE_DISTANCE }, visible: { opacity: 1, y: 0 } },
  'slide-down': { hidden: { opacity: 0, y: -SLIDE_DISTANCE }, visible: { opacity: 1, y: 0 } },
  'slide-left': { hidden: { opacity: 0, x: SLIDE_DISTANCE }, visible: { opacity: 1, x: 0 } },
  'slide-right': { hidden: { opacity: 0, x: -SLIDE_DISTANCE }, visible: { opacity: 1, x: 0 } },
  'zoom-in': { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1 } },
};

/** Valor de `whileHover` por preset. */
export const HOVER_VARIANTS: Record<HoverPreset, TargetAndTransition> = {
  none: {},
  lift: { y: -4 },
  scale: { scale: 1.02 },
  glow: { boxShadow: '0 0 0 2px var(--primary)' },
};

const DEFAULT_ANIMATION: ResolvedAnimation = {
  entrance: 'none',
  trigger: 'load',
  hover: 'none',
  duration: DEFAULT_DURATION,
  delay: DEFAULT_DELAY,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Um campo: bloco vence, senão o padrão da página, senão o fallback. Isolado num helper para
 * `resolveAnimation` não acumular um `??`/`?.` por campo na própria complexidade. */
function pick<K extends keyof BlockAnimation>(
  block: BlockAnimation | undefined,
  layoutDefault: BlockAnimation | undefined,
  key: K,
  fallback: NonNullable<BlockAnimation[K]>,
): NonNullable<BlockAnimation[K]> {
  return block?.[key] ?? layoutDefault?.[key] ?? fallback;
}

/** Merge campo a campo: bloco vence, senão cai no padrão da página, senão o default. Quem decide
 * se a animação roda (fora do canvas de edição) é o chamador — ver `renderer.tsx#Block`. */
export function resolveAnimation(
  block: BlockAnimation | undefined,
  layoutDefault: BlockAnimation | undefined,
): ResolvedAnimation {
  return {
    entrance: pick(block, layoutDefault, 'entrance', DEFAULT_ANIMATION.entrance),
    trigger: pick(block, layoutDefault, 'trigger', DEFAULT_ANIMATION.trigger),
    hover: pick(block, layoutDefault, 'hover', DEFAULT_ANIMATION.hover),
    duration: clamp(
      pick(block, layoutDefault, 'duration', DEFAULT_ANIMATION.duration),
      MIN_DURATION,
      MAX_DURATION,
    ),
    delay: clamp(
      pick(block, layoutDefault, 'delay', DEFAULT_ANIMATION.delay),
      MIN_DELAY,
      MAX_DELAY,
    ),
  };
}

export interface BlockMotionProps {
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  whileInView?: TargetAndTransition;
  viewport?: { once: boolean; amount?: number };
  whileHover?: TargetAndTransition;
  transition?: Transition;
}

/** Traduz a config resolvida em props do `motion.div`; com `prefersReducedMotion`, remove transform/scroll e mantém só o conteúdo visível. */
export function buildMotionProps(
  resolved: ResolvedAnimation,
  prefersReducedMotion?: boolean,
): BlockMotionProps {
  const transition: Transition = { duration: resolved.duration, delay: resolved.delay };

  if (prefersReducedMotion) {
    return resolved.hover === 'none'
      ? {}
      : { whileHover: { opacity: 0.92 }, transition: { duration: 0.1 } };
  }

  const variants = ANIMATION_VARIANTS[resolved.entrance];
  const whileHover = resolved.hover === 'none' ? undefined : HOVER_VARIANTS[resolved.hover];

  if (resolved.entrance === 'none') {
    return whileHover ? { whileHover, transition } : {};
  }

  if (resolved.trigger === 'scroll') {
    return {
      initial: variants.hidden,
      whileInView: variants.visible,
      viewport: { once: false, amount: 0.3 },
      whileHover,
      transition,
    };
  }

  return {
    initial: variants.hidden,
    animate: variants.visible,
    whileHover,
    transition,
  };
}
