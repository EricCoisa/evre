"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TopicProps {
  value: {
    title: string;
    description?: string;
    items?: string[];
    icon?: string;
  };
  className?: string;
}

export function Topic({ value, className }: TopicProps) {
  const { title, description, items = [] } = value;

  return (
    <Card className={cn('my-6 border-l-4 border-l-primary', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-base mt-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      {items.length > 0 && (
        <CardContent>
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Circle className="h-2 w-2 mt-2 text-primary fill-primary flex-shrink-0" />
                <span className="text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
