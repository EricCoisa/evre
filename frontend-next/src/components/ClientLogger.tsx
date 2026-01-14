'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { logger } from '@/lib/logger';

/**
 * Componente para logar navegação no lado do cliente
 * Logs aparecerão no DevTools do navegador em produção
 */
export function ClientLogger() {
  const pathname = usePathname();

  useEffect(() => {
    logger.info('client-navigation', `Navegou para: ${pathname}`);
  }, [pathname]);

  return null;
}
