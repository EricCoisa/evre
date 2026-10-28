'use client';
import type React from 'react';
import { useFeatureFlag } from '@/lib/actions/feature-flag/queries';

/** Renderiza os filhos condicionalmente a uma feature flag, dentro de um Client Component. */
interface FeatureProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Feature({ flag, children, fallback = null }: FeatureProps) {
  const enabled = useFeatureFlag(flag);
  return <>{enabled ? children : fallback}</>;
}
