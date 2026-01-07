"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  value: React.ReactNode;
  className?: string;
}

export function Container({ value, className }: ContainerProps) {
  return (
    <div className={cn(
      'bg-card/50 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-6 lg:p-8 my-3 md:my-6 border border-border shadow-sm',
      className
    )}>
      {value}
    </div>
  );
}
