'use client';

import { Container } from '@/components/container';
import { ConfigList } from '@/components/config-row';
import { SystemConfigurationRow } from '@/components/system-configuration-row';
import { useTranslation } from '@/hooks/use-translation';
import { SYSTEM_CONFIG_KEYS } from '@/types/system-config-keys';

/** Controles de canal — cada switch só liga quando o provider correspondente está configurado;
 *  liga/desliga em si é SystemConfiguration (operador), não feature flag (dev). */
export function NotificationConfig() {
  const { t } = useTranslation('notification');

  return (
    <Container variant="form" padding>
      <p className="mb-1 font-medium">{t('channel_controls_title')}</p>
      <p className="mb-4 text-sm text-muted-foreground">{t('channel_controls_desc')}</p>

      <ConfigList>
        <SystemConfigurationRow
          title={t('channel_toggle_email')}
          disableLabel
          labelKey={SYSTEM_CONFIG_KEYS.notificationEmailEnabled}
        />
        <SystemConfigurationRow
          title={t('channel_toggle_whatsapp')}
          disableLabel
          labelKey={SYSTEM_CONFIG_KEYS.notificationWhatsappEnabled}
        />
      </ConfigList>
    </Container>
  );
}
