'use client';

import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import { UserConfigurationRow } from '@/components/user-configuration-row';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { ConfigRow, ConfigList } from '@/components/config-row';
import { NotificationMutedTypes } from './notification-muted-types';

export function NotificationPreferencesTab() {
  const { t } = useTranslation('notification');

  return (
    <Container variant="form" padding>
      <ConfigList>
        <UserConfigurationRow
          title={t('preferences_channel_email')}
          description={t('preferences_channel_email_desc')}
          disableLabel={true}
          labelKey={USER_CONFIG_KEYS.notificationChannelEmail}
        />
        <UserConfigurationRow
          title={t('preferences_channel_whatsapp')}
          description={t('preferences_channel_whatsapp_desc')}
          disableLabel={true}
          labelKey={USER_CONFIG_KEYS.notificationChannelWhatsapp}
        />
        <ConfigRow
          title={t('preferences_types_title')}
          description={t('preferences_types_desc')}
          wide
        >
          <NotificationMutedTypes />
        </ConfigRow>
      </ConfigList>
    </Container>
  );
}
