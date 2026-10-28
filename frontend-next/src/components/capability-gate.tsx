"use client";

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { useCapability } from '@/lib/actions/capability/queries';
import type { CapabilityKey } from '@/types/capabilities';

interface CapabilityGateProps {
  name: CapabilityKey;
  children: ReactNode;
}

/** Esconde (`hidden`) ou troca por um hint + botão "Configurar" (`disabled`) conforme a capability. */
export function CapabilityGate({ name, children }: CapabilityGateProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: currentUser } = useMe();
  const { hidden, disabled, reason, fixPath } = useCapability(name);

  if (hidden) return null;
  if (!disabled) return <>{children}</>;

  const hint = reason ?? t('capability.unavailable');
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-muted-foreground">{hint}</p>
      {isAdmin && fixPath && (
        <Button size="sm" variant="outline" onClick={() => router.push(fixPath)}>
          {t('capability.configure_button')}
        </Button>
      )}
    </div>
  );
}
