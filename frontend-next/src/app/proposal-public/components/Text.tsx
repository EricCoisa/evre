"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface TextProps {
  value: string | React.ReactNode;
  className?: string;
}

export function Text({ value, className }: TextProps) {
  return (
    <p className={cn(
      'text-sm md:text-base lg:text-lg leading-relaxed text-muted-foreground mb-2 md:mb-4',
      className
    )}>
      {value}
    </p>
  );
}
