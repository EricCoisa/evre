"use client";

import React, { JSX } from 'react';
import { cn } from '@/lib/utils';

interface TitleProps {
  value: string;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}

export function Title({ value, level = 1, className }: TitleProps) {
  const baseStyles = 'font-bold tracking-tight';
  
  const Component = `h${level}` as keyof JSX.IntrinsicElements;
  
  const levelStyles = {
    1: 'text-4xl mb-6',
    2: 'text-3xl mb-5',
    3: 'text-2xl mb-4',
    4: 'text-xl mb-3',
  };

  return (
    <Component className={cn(baseStyles, levelStyles[level], className)}>
      {value}
    </Component>
  );
}
