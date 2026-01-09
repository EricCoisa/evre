"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

interface DateProps {
  value: string;
  label?: string;
  className?: string;
}

export function DateComponent({ value, label, className }: DateProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      {label && <span className="text-muted-foreground">{label}:</span>}
      <span className="font-medium">{value}</span>
    </div>
  );
}
