import React from 'react';
import { cn } from '@/lib/cn';
import { BrandIconPlay, BrandIconSlash, BrandIconPlayInverse } from './brand-icons';

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

function resolveDimension(size: BrandIconsBlinkProps['size']): string | number | undefined {
  if (typeof size === 'number') {
    return `${size}px`;
  }
  if (typeof size === 'string' && size in SIZE_PRESETS) {
    return `${SIZE_PRESETS[size as keyof typeof SIZE_PRESETS]}px`;
  }
  return size;
}

const ICONS = [
  { Component: BrandIconPlay, name: 'play' },
  { Component: BrandIconSlash, name: 'slash' },
  { Component: BrandIconPlayInverse, name: 'play-inverse' },
];

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
  const dimension = resolveDimension(size);

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
