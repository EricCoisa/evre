import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


import { getSystemConfiguration, updateSystemConfiguration } from './api';
import { SystemConfiguration } from './types';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';

export function useConfiguration<T>(labelKey: string) {
  return useQuery({
    queryKey: ['system-configuration', labelKey],
    queryFn: Collector(() => getSystemConfiguration<T>(labelKey)),
  });
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