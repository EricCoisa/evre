'use client';

import { useUserConfiguration, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { BaseConfiguration, OtherConfigurationProps } from './base-configuration';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';


export function UserConfiguration(props: OtherConfigurationProps) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useUserConfiguration(props.labelKey);
  const updateValue = useSetUserConfiguration();

  const handleUpdate = async (newValue: unknown) => {
    if (!data) return;

    const result = await updateValue.mutateAsync({
      userConfiguration: {
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
      className={props.className}
    />
  );
}
