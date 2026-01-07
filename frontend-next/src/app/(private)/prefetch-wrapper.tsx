'use client';

import { StateMaster } from '@/components/state-master';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/contexts/auth-context';

interface PrefetchWrapperProps {
  children: React.ReactNode;
}

export function PrefetchWrapper({ children }: PrefetchWrapperProps) {
  const { t } = useTranslation();
  const { isLoading: isLoadingAuth } = useAuth()
  // const { isLoading: isLoadingEssential } = usePrefetchEssentialData({
  //   enabled: true,
  //   staleTime: QUERY_CONFIG.CACHE_TIMES.USERS, // Usa configuração padrão
  // });

  // Ativa prefetch de dados do usuário
  // const { isLoading: isLoadingUser } = usePrefetchUserData(true);
  //const { isLoading: isLoadingLanguage } = usePrefetchLanguage(true);
  // Combina os estados de loading
 // const isLoading = isLoadingLanguage;
  const loadingMessage = t('loading') == 'loading' ? undefined : t('loading');
  return (
    <StateMaster
      queryKey={['app-init']}
      isLoading={isLoadingAuth}
      loadingMessage={loadingMessage}
      useTableSkeleton={false}
    >
      {children}
    </StateMaster>
  );
}