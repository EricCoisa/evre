'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { QUERY_CONFIG } from '@/lib/config/performance.config';
import { useTranslation } from '@/hooks/use-translation';

interface PrefetchOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Hook para prefetch otimizado de dados essenciais
 * Carrega dados antecipadamente para melhorar performance de navegação
 */
export function usePrefetchEssentialData(options: PrefetchOptions = {}) {
  const { enabled = true, staleTime } = options;
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const prefetchQueries = async () => {
      setIsLoading(true);
      try {
        // Prefetch dados mais comuns com staleTime configurável
        const commonQueries = [
          {
            queryKey: ['userRouteAccess', { page: 1, limit: 10, pagination: true }],
            staleTime: staleTime || QUERY_CONFIG.CACHE_TIMES.USER_ROUTE_ACCESS,
          },
        ];

        // Executa prefetch apenas se dados não existem no cache
        await Promise.allSettled(
          commonQueries.map((query) => {
            const existingData = queryClient.getQueryData(query.queryKey);
            if (!existingData) {
              return queryClient.prefetchQuery({
                queryKey: query.queryKey,
                staleTime: query.staleTime,
              });
            }
            return Promise.resolve();
          })
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Executa imediatamente
    prefetchQueries();
  }, [queryClient, enabled, staleTime]);

  return { isLoading };
}

/**
 * Hook específico para prefetch de dados de usuário/perfil
 */
export function usePrefetchUserData(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const prefetchUserData = async () => {
      setIsLoading(true);
      try {
        // Prefetch profile do usuário
        const existingProfile = queryClient.getQueryData(['users', 'profile']);
        if (!existingProfile) {
          await queryClient.prefetchQuery({
            queryKey: ['users', 'profile'],
            staleTime: QUERY_CONFIG.CACHE_TIMES.USER_PROFILE,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Executa imediatamente
    prefetchUserData();
  }, [queryClient, enabled]);

  return { isLoading };
}

/**
 * Hook para carregar o idioma
 */
export function usePrefetchLanguage(enabled: boolean = true) {
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const prefetchLanguage = async () => {
      setIsLoading(true);
      try {
        t('loading'); // Força carregamento do namespace
      } finally {
        setIsLoading(false);
      }
    };

    // Executa imediatamente
    prefetchLanguage();
  }, [enabled]);

  return { isLoading };
}