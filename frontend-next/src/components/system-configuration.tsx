'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useConfiguration, useUpdateConfiguration } from '@/lib/actions/systemConfiguration/queries';
import { BaseConfiguration, OtherConfigurationProps } from './base-configuration';
import { useTranslation } from '@/hooks/use-translation';
import { useScreenItem } from '@/components/agent/screen-registry';
import { toast } from 'sonner';


export function SystemConfiguration(props: OtherConfigurationProps) {
  const { t } = useTranslation();
  useScreenItem('config', 'system-configuration', props.labelKey);
  const { data } = useConfiguration(props.labelKey);
  const updateValue = useUpdateConfiguration();
  const queryClient = useQueryClient();

  const handleUpdate = async (newValue: unknown) => {
    if (!data || data.blocked || props.disabled) return;

    const result = await updateValue.mutateAsync({
      systemConfiguration: {
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
        // Invalida com refetchType: 'all' pois a tela afetada costuma estar desmontada
        void queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' });
      }
    }
  };

  const isBlockedOrDisabled = !!data?.blocked || !!props.disabled;

  return (
    <BaseConfiguration
      labelKey={props.labelKey}
      description={props.description}
      data={data}
      isPending={updateValue.isPending}
      disabled={isBlockedOrDisabled}
      warning={props.warning ?? isBlockedOrDisabled}
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
