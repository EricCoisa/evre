'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useConfiguration, useUpdateConfiguration } from '@/lib/actions/systemConfiguration/queries';

/** Ativa um provider gravando o seu id em `labelKey` e invalida `system-configuration` e `capabilities`. */
export function useActivateProvider(labelKey: string, invalidateKeys: QueryKey[] = []) {
  const queryClient = useQueryClient();
  const { data } = useConfiguration<string>(labelKey);
  const update = useUpdateConfiguration<string>();

  const activate = async (providerId: string) => {
    if (!data || data.blocked) return;
    await update.mutateAsync({ systemConfiguration: { ...data, value: providerId } });
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });
    for (const queryKey of invalidateKeys) {
      await queryClient.invalidateQueries({ queryKey });
    }
  };

  return { activate, isPending: update.isPending, isBlocked: Boolean(data?.blocked) };
}

