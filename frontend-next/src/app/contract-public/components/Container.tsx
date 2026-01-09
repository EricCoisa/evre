"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  value: React.ReactNode;
  className?: string;
}

export function Container({ value, className }: ContainerProps) {
  return (
    <div className={cn('p-6 rounded-lg border bg-card', className)}>
      {value}
    </div>
  );
}
