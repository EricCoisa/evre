'use client';

import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { Description, Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

export interface SwitchFieldProps {
  /** Amarra o label ao switch — clicar no texto alterna. */
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  /** Só no layout empilhado; no `inline` quem descreve é a linha ao redor. */
  description?: ReactNode;
  /** Switch e label na mesma linha — para caber ao lado de outro conteúdo. */
  inline?: boolean;
  className?: string;
}

/** Switch com label e, no layout empilhado, descrição. */
export function SwitchField({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  inline,
  className,
}: SwitchFieldProps) {
  const control = (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  );

  if (inline) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {control}
        {label && (
          <Label htmlFor={id} className="font-normal">
            {label}
          </Label>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {description && <Description>{description}</Description>}
      {control}
    </div>
  );
}
