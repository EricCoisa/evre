import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


import { getUserConfigurationsDefinitions, updateUserConfigurationsDefinitions } from './api';

import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import { UserConfigurationsDefinitions } from './types';

export function useUserConfigurationsDefinitions<T>(labelKey: string) {
  return useQuery({
    queryKey: ['user-configurations-definitions', labelKey],
    queryFn: Collector(() => getUserConfigurationsDefinitions<T>(labelKey)),
  });
}

export function useSetUserConfigurationDefinitions<T>() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: async ({ userConfigurationDefinitions }: { userConfigurationDefinitions: UserConfigurationsDefinitions<T>; }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => updateUserConfigurationsDefinitions<T>(userConfigurationDefinitions.id, userConfigurationDefinitions.defaultValue))();
    },
    onSuccess: (_, { userConfigurationDefinitions }) => {
      // Invalida apenas a configuração alterada e a lista geral
      queryClient.invalidateQueries({ queryKey: ['user-configurations-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['user-configurations-definitions', userConfigurationDefinitions.labelKey] });
    },
  });
}