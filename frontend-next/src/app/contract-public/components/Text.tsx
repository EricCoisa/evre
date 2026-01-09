"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface TextProps {
  value: React.ReactNode;
  className?: string;
}

export function Text({ value, className }: TextProps) {
  return (
    <p className={cn('text-base leading-7 text-muted-foreground mb-4', className)}>
      {value}
    </p>
  );
}
