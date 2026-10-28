"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { cn } from '@/lib/cn';

export interface WarningPopoverProps {
  reason?: ReactNode;
  fixPath?: string;
  className?: string;
}

/** Exibe aviso triangular com Popover explicativo da causa técnica; nada para quem não pode configurar. */
export function WarningPopover({ reason, fixPath, className }: WarningPopoverProps) {
  const { t } = useTranslation();
  const { data: user } = useMe();

  // Usuários sem acesso a configurar não devem ver o warn
  if (user?.role != null && user.role !== 'ADMIN') {
    return null;
  }

  if (!reason) {
    return <AlertTriangle className={cn("h-3.5 w-3.5 text-amber-500 shrink-0", className)} aria-hidden />;
  }

  const labelText = typeof reason === 'string' ? reason : t('capability.unavailable');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-sm text-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer transition-colors p-0.5 -m-0.5",
            className
          )}
          aria-label={labelText}
          title={labelText}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        forceMount
        side="top"
        align="center"
        className="w-72 p-3 text-xs space-y-2 shadow-lg z-50"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-muted-foreground leading-relaxed">
            {reason}
          </div>
        </div>
        {fixPath && (
          <div className="pt-2 border-t border-border/50 flex justify-end">
            <Link
              href={fixPath}
              className="text-primary hover:underline font-medium inline-flex items-center gap-1 text-xs"
            >
              <span>{t('configure')}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

