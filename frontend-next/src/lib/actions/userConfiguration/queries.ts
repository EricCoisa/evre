import { useMutation, useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import {
  getUserConfigurations,
  setUserConfiguration,
  resetUserConfiguration,
  getUserConfigurationByLabelKey as getUserConfigurationByKey,
} from './api';
import { UserConfiguration } from './types';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';

// Hook para obter todas as configurações do usuário
export function useUserConfigurations() {
  return useSuspenseQuery({
    queryKey: ['user-configurations'],
    queryFn: Collector(getUserConfigurations),
  });
}

// Hook para obter configuração específica por labelKey
export function useUserConfiguration<T>(labelKey: string) {
  return useSuspenseQuery({
    queryKey: ['user-configuration', labelKey],
    queryFn: Collector(() => getUserConfigurationByKey<T>(labelKey)),
  });
}

/** Busca várias chaves de configuração do usuário de uma vez, para hidratar um formulário. */
export function useUserConfigurationValues(labelKeys: string[]) {
  // Collector() fora do map: ele chama useApp() por dentro, e uma chamada por chave
  // faria a contagem de hooks variar junto com a lista de chaves do provider.
  const collect = Collector((key: string) => getUserConfigurationByKey<unknown>(key));
  const results = useSuspenseQueries({
    queries: labelKeys.map((labelKey) => ({
      queryKey: ['user-configuration', labelKey],
      queryFn: () => collect(labelKey),
    })),
  });

  return {
    values: Object.fromEntries(
      labelKeys.map((labelKey, index) => [labelKey, results[index]?.data?.value]),
    ) as Record<string, unknown>,
  };
}

// Hook para definir/atualizar configuração
export function useSetUserConfiguration<T>() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: async ({ userConfiguration }: { userConfiguration: UserConfiguration<T>; }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => setUserConfiguration<T>(userConfiguration.id, userConfiguration.value))();
    },
    onSuccess: (_, { userConfiguration }) => {
      // Invalida apenas a configuração alterada e a lista geral
      queryClient.invalidateQueries({ queryKey: ['user-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['user-configuration', userConfiguration.labelKey] });
    },
  });
}


// Hook para resetar configuração específica
export function useResetUserConfiguration() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (definitionId: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => resetUserConfiguration(definitionId))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['user-configuration'] });
    },
  });
}
