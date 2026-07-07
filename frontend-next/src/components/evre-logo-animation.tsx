'use client';

import Lottie from 'lottie-react';
import animationData from '../../public/logo/Evre.json';

interface EvreLogoAnimationProps {
  className?: string;
}

export function EvreLogoAnimation({ className }: EvreLogoAnimationProps) {
  return (
    <Lottie
      animationData={animationData}
      loop={true}
      className={className ?? 'h-8 w-auto'}
      aria-label="EVRE"
    />
  );
}
