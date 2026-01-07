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
      'bg-card/50 backdrop-blur-sm rounded-xl p-6 md:p-8 my-6 border border-border shadow-sm',
      className
    )}>
      {value}
    </div>
  );
}
