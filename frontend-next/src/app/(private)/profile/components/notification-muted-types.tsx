'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { useUserConfiguration, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { NOTIFICATION_TYPES } from '@/types/notification-types';
import { useTranslation } from '@/hooks/use-translation';

/** O valor persistido lista os tipos desabilitados; a seleção da UI representa os habilitados. */
export function NotificationMutedTypes() {
  const { t } = useTranslation('notification');
  const { data } = useUserConfiguration<string[]>(USER_CONFIG_KEYS.notificationMutedTypes);
  const updateValue = useSetUserConfiguration<string>();

  const muted = data?.value ?? [];

  const toggle = (type: string, checked: boolean) => {
    if (!data) return;
    const next = checked ? muted.filter((m) => m !== type) : [...muted, type];
    updateValue.mutate({
      userConfiguration: { ...data, value: JSON.stringify(next) },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {NOTIFICATION_TYPES.map((type) => (
        <label key={type} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!muted.includes(type)}
            onCheckedChange={(checked) => toggle(type, checked === true)}
          />
          {t(`types.${type}`)}
        </label>
      ))}
    </div>
  );
}
