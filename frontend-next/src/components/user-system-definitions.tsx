'use client';

import { BaseConfiguration, OtherConfigurationProps } from './base-configuration';
import { useTranslation } from '@/hooks/use-translation';
import { useSetUserConfigurationDefinitions, useUserConfigurationsDefinitions } from '@/lib/actions/userConfigurationDefinition/queries';

import { toast } from 'sonner';

export function UserSystemDefinitions(props: OtherConfigurationProps) {
  const { t } = useTranslation();
  const { data, error, isLoading} = useUserConfigurationsDefinitions(props.labelKey);
  const updateValue = useSetUserConfigurationDefinitions();

  const handleUpdate = async (newValue: unknown) => {
    if (!data) return;
    
    const result = await updateValue.mutateAsync({ 
      userConfigurationDefinitions: {
        ...data,
        defaultValue: newValue
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
      data={
        data
          ? {
              id: data.id,
              labelKey: data.labelKey,
              valueType: data.valueType,
              value: data.defaultValue
            }
          : undefined
      }
      error={error}
      isLoading={isLoading}
      isPending={updateValue.isPending}
      onUpdate={handleUpdate}
      forceType={props.forceType}
      showMessage={props.showMessage ?? true}
      disableLabel={props.disableLabel}
    />
  );
}
