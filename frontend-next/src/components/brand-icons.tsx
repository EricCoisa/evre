import React from 'react';
import { cn } from '@/lib/cn';

export const BrandIconPlay = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 196.15 196.15" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" {...props}>
    <rect width="196.15" height="196.15" rx="3" fill="currentColor" fillOpacity={0.06} />
    <path d="M44.26,139.89l83.64-41.94L44.26,56.02v-26.79l107.64,54.98v27.49l-107.64,55.22v-27.02Z" fill="currentColor" fillOpacity={0.22} />
  </svg>
);

export const BrandIconSlash = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 196.15 196.15" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" {...props}>
    <rect width="196.15" height="196.15" rx="3" fill="currentColor" fillOpacity={0.06} />
    <path d="M108.16,27.13h23.95l-44.11,141.88h-23.95L108.16,27.13Z" fill="currentColor" fillOpacity={0.22} />
  </svg>
);

export const BrandIconPlayInverse = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 196.15 196.15" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" {...props}>
    <rect width="196.15" height="196.15" rx="3" fill="currentColor" fillOpacity={0.06} />
    <path d="M44.26,111.7v-27.49l107.64-54.98v26.79l-83.64,41.94,83.64,41.94v27.02l-107.64-55.22Z" fill="currentColor" fillOpacity={0.22} />
  </svg>
);

export interface BrandIconsBlinkProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tamanho dos ícones: 'xs' (16px), 'sm' (24px), 'md' (40px), 'lg' (64px), 'xl' (96px) ou número em pixels / string CSS */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  /** Duração de um ciclo completo de animação em segundos (padrão: 1.5) */
  duration?: number;
  /** Opacidade mínima quando apagado (0 a 1, padrão: 0.2) */
  minOpacity?: number;
  /** Opacidade máxima quando aceso (0 a 1, padrão: 1) */
  maxOpacity?: number;
  /** Se deve aplicar uma leve escala ao ícone que estiver aceso (padrão: true) */
  scale?: boolean;
  /** Classe CSS customizada para o contêiner de cada ícone individual */
  iconClassName?: string;
}

const SIZE_PRESETS: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
};

const ICONS = [
  { Component: BrandIconPlay, name: 'play' },
  { Component: BrandIconSlash, name: 'slash' },
  { Component: BrandIconPlayInverse, name: 'play-inverse' },
];

/**
 * Componente que renderiza os 3 ícones da marca EVRE (Play, Slash, PlayInverse)
 * piscando sequencialmente em ordem, com suporte a cores herdadas (`currentColor`),
 * acessibilidade e preferências de movimento reduzido.
 */
export function BrandIconsBlink({
  size = 'md',
  duration = 1.5,
  minOpacity = 0.2,
  maxOpacity = 1,
  scale = true,
  className,
  iconClassName,
  style,
  ...props
}: BrandIconsBlinkProps) {
  const dimension =
    typeof size === 'number'
      ? `${size}px`
      : typeof size === 'string' && size in SIZE_PRESETS
        ? `${SIZE_PRESETS[size as keyof typeof SIZE_PRESETS]}px`
        : size;

  return (
    <div
      role="status"
      aria-label="Carregando..."
      className={cn('inline-flex items-center gap-3', className)}
      style={
        {
          '--brand-blink-min-op': minOpacity,
          '--brand-blink-max-op': maxOpacity,
          '--brand-blink-min-sc': scale ? 0.96 : 1,
          '--brand-blink-max-sc': scale ? 1.06 : 1,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <style>{`
        @keyframes brand-icon-blink-sequence {
          0%, 100% {
            opacity: var(--brand-blink-min-op, 0.2);
            transform: scale(var(--brand-blink-min-sc, 0.96));
          }
          20%, 40% {
            opacity: var(--brand-blink-max-op, 1);
            transform: scale(var(--brand-blink-max-sc, 1.06));
          }
          60% {
            opacity: var(--brand-blink-min-op, 0.2);
            transform: scale(var(--brand-blink-min-sc, 0.96));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-icon-seq-item {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {ICONS.map(({ Component, name }, index) => {
        const delay = (duration / ICONS.length) * index;
        return (
          <div
            key={name}
            data-testid={`brand-icon-${name}`}
            className={cn('brand-icon-seq-item shrink-0 will-change-transform', iconClassName)}
            style={{
              width: dimension,
              height: dimension,
              animation: `brand-icon-blink-sequence ${duration}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }}
          >
            <Component className="w-full h-full" />
          </div>
        );
      })}
    </div>
  );
}
