'use client';

import { Container } from '@/components/container';
import { ConfigList } from '@/components/config-row';
import { SystemConfigurationRow } from '@/components/system-configuration-row';
import { useTranslation } from '@/hooks/use-translation';
import { SYSTEM_CONFIG_KEYS } from '@/types/system-config-keys';

export function TimeTrackingConfig() {
  const { t } = useTranslation('settings');

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="font-medium mb-1">{t('time_tracking_config_title')}</p>
        <p className="text-sm text-muted-foreground">{t('time_tracking_config_desc')}</p>
      </div>

      <ConfigList>
        <SystemConfigurationRow
          title={t('time_tracking_forgotten_threshold_hours')}
          description={t('time_tracking_forgotten_threshold_hours_desc')}
          disableLabel
          labelKey={SYSTEM_CONFIG_KEYS.timeTrackingForgottenThresholdHours}
        />
      </ConfigList>
    </Container>
  );
}
