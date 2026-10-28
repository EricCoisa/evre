'use client';

import { Tabs } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/use-tab-param';
import { cn } from '@/lib/cn';

/** Casca cliente do Tabs; quais abas existem é decidido pelo Server Component pai. */
export function TabsShell({
  defaultTab,
  children,
  className,
}: {
  defaultTab: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [tab, setTab] = useTabParam(defaultTab);
  return (
    <Tabs value={tab} onValueChange={setTab} className={cn('w-full', className)}>
      {children}
    </Tabs>
  );
}

