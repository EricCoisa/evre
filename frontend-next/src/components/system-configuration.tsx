'use client';

import { useConfiguration, useUpdateConfiguration } from '@/lib/actions/systemConfiguration/queries';
import { BaseConfiguration, OtherConfigurationProps } from './base-configuration';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from 'sonner';


export function SystemConfiguration(props: OtherConfigurationProps) {
  const { t } = useTranslation();
  const { data, error, isLoading} = useConfiguration(props.labelKey);
  const updateValue = useUpdateConfiguration();

  const handleUpdate = async (newValue: unknown) => {
    if (!data) return;
    
    const result = await updateValue.mutateAsync({ 
      systemConfiguration: {
        ...data,
        value: newValue
      }
    });

    if(result && props.showMessage) {
      toast.success(t('updatedSuccessfully'));
    }
  };

  return (
    <BaseConfiguration
      labelKey={props.labelKey}
      description={props.description}
      data={data}
      error={error}
      isLoading={isLoading}
      isPending={updateValue.isPending}
      onUpdate={handleUpdate}
      forceType={props.forceType}
      showMessage={props.showMessage ?? true}
      disableLabel={props.disableLabel}
      secret={props.secret}
    />
  );
}
