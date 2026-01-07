"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface TitleProps {
  value: string;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}

export function Title({ value, level = 1, className }: TitleProps) {
  const baseStyles = 'font-bold tracking-tight text-foreground';
  
  const levelStyles = {
    1: 'text-2xl md:text-4xl lg:text-5xl mb-3 md:mb-6',
    2: 'text-xl md:text-3xl lg:text-4xl mb-3 md:mb-5',
    3: 'text-lg md:text-2xl lg:text-3xl mb-2 md:mb-4',
    4: 'text-base md:text-xl lg:text-2xl mb-2 md:mb-3',
  };

  const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';

  return (
    <Component className={cn(baseStyles, levelStyles[level], className)}>
      {value}
    </Component>
  );
}
