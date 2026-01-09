"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ClauseProps {
  value: {
    number?: string | number;
    title: string;
    content: string;
    subclauses?: string[] | { title?: string; content: string }[];
  };
  className?: string;
}

export function Clause({ value, className }: ClauseProps) {
  return (
    <div className={cn('mb-6 p-4 rounded-lg border bg-muted/20', className)}>
      <div className="flex items-start gap-3 mb-3">
        {value.number && (
          <span className="font-bold text-lg text-primary shrink-0">
            {value.number}.
          </span>
        )}
        <h3 className="font-semibold text-lg">{value.title}</h3>
      </div>
      <p className="text-muted-foreground leading-7 ml-8">{value.content}</p>
      
      {value.subclauses && value.subclauses.length > 0 && (
        <div className="mt-4 ml-8 space-y-3">
          {value.subclauses.map((sub, idx) => (
            <div key={idx} className="pl-4 border-l-2 border-muted">
              {typeof sub === 'string' ? (
                <p className="text-sm text-muted-foreground leading-6">{sub}</p>
              ) : (
                <>
                  {sub.title && (
                    <h4 className="font-medium text-sm mb-1">{sub.title}</h4>
                  )}
                  <p className="text-sm text-muted-foreground leading-6">
                    {sub.content}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
