import Image from 'next/image';
import { cn } from '@/lib/cn';

export type LogoVariant = 'auto' | 'white' | 'black';

interface LogoProps {
  /** `auto` alterna com o tema; `white`/`black` fixam a cor (use sobre fundos que não mudam com o tema). */
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
  alt?: string;
}

const LOGO_BLACK = '/brand/evre/logo-black.svg';
const LOGO_WHITE = '/brand/evre/logo-white.svg';
const IMG_CLASS = 'object-contain object-left';

export function Logo({ variant = 'auto', className, priority = false, alt = 'EVRE' }: LogoProps) {
  return (
    <span className={cn('relative block h-8 w-28 shrink-0', className)}>
      {variant !== 'white' && (
        <Image
          src={LOGO_BLACK}
          alt={alt}
          fill
          priority={priority}
          className={cn(IMG_CLASS, 'evre-logo-on-light', variant === 'auto' && 'dark:hidden')}
        />
      )}
      {variant !== 'black' && (
        <Image
          src={LOGO_WHITE}
          alt={variant === 'auto' ? '' : alt}
          aria-hidden={variant === 'auto' || undefined}
          fill
          priority={priority}
          className={cn(IMG_CLASS, 'evre-logo-on-dark', variant === 'auto' && 'hidden dark:block')}
        />
      )}
    </span>
  );
}
