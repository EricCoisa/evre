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
      'text-base md:text-lg leading-relaxed text-muted-foreground mb-4',
      className
    )}>
      {value}
    </p>
  );
}
