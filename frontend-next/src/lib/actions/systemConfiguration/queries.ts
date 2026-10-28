import { useMutation, useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';


import { getSystemConfiguration, updateSystemConfiguration } from './api';
import { SystemConfiguration } from './types';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';

export function useConfiguration<T>(labelKey: string) {
  const collect = Collector((key: string) => getSystemConfiguration<T>(key));
  return useSuspenseQuery({
    queryKey: ['system-configuration', labelKey],
    queryFn: () => collect(labelKey),
  });
}

/** Busca várias chaves de configuração de uma vez, para hidratar um formulário de provider. */
export function useConfigurationValues(labelKeys: string[]) {
  // Collector() fora do map de propósito: ele chama useApp() por dentro, e uma chamada
  // por chave faria a contagem de hooks variar junto com a lista de chaves do provider.
  const collect = Collector((key: string) => getSystemConfiguration<unknown>(key));
  const results = useSuspenseQueries({
    queries: labelKeys.map((labelKey) => ({
      queryKey: ['system-configuration', labelKey],
      queryFn: () => collect(labelKey),
    })),
  });

  return {
    values: Object.fromEntries(
      labelKeys.map((labelKey, index) => [labelKey, results[index]?.data?.value]),
    ) as Record<string, unknown>,
  };
}

export function useUpdateConfiguration<T>() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ systemConfiguration }: { systemConfiguration: SystemConfiguration<T>; }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => updateSystemConfiguration<T>(systemConfiguration.id, systemConfiguration.value))();
    },
    onSuccess: (_, { systemConfiguration }) => {
      queryClient.invalidateQueries({ queryKey: ['system-configuration', systemConfiguration.labelKey] });
    },
  });
}