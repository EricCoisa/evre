"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TermProps {
  value: string | string[];
  className?: string;
}

export function Term({ value, className }: TermProps) {
  const terms = Array.isArray(value) ? value : [value];

  return (
    <div className={cn('space-y-2', className)}>
      {terms.map((term, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <Check className="h-4 w-4 text-primary mt-1 shrink-0" />
          <span className="text-sm text-muted-foreground leading-6">{term}</span>
        </div>
      ))}
    </div>
  );
}
