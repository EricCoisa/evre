'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useUserConfiguration, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { BaseConfiguration, OtherConfigurationProps } from './base-configuration';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import { useScreenItem } from '@/components/agent/screen-registry';


export function UserConfiguration(props: OtherConfigurationProps) {
  const { t } = useTranslation();
  useScreenItem('config', 'user-configuration', props.labelKey);
  const { data } = useUserConfiguration(props.labelKey);
  const updateValue = useSetUserConfiguration();
  const queryClient = useQueryClient();

  const handleUpdate = async (newValue: unknown) => {
    if (!data || props.disabled) return;

    const result = await updateValue.mutateAsync({
      userConfiguration: {
        ...data,
        value: newValue
      }
    });

    if(result && props.showMessage) {
      toast.success(t('updatedSuccessfully'));
    }

    // Qualquer chave pode ser o que falta (ou não) para uma capability — invalida sempre,
    // não só quando o chamador lista invalidateKeys.
    void queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });

    if (props.invalidateKeys) {
      for (const key of props.invalidateKeys) {
        // Mesmo motivo do system-configuration.tsx: `refetchOnMount: false` global faz
        // 'active' (padrão) virar no-op para a tela que ainda não está montada.
        void queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' });
      }
    }
  };

  const isDisabled = !!props.disabled;

  return (
    <BaseConfiguration
      labelKey={props.labelKey}
      description={props.description}
      data={data ? { ...data, secret: data.isSecret } : data}
      isPending={updateValue.isPending}
      disabled={isDisabled}
      warning={props.warning ?? false}
      warningReason={props.warningReason}
      fixPath={props.fixPath}
      onUpdate={handleUpdate}
      forceType={props.forceType}
      manualSave={props.manualSave}
      showMessage={props.showMessage ?? true}
      disableLabel={props.disableLabel}
      className={props.className}
    />
  );
}
