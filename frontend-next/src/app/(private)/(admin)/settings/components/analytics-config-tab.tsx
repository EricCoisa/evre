'use client';

import { Container } from '@/components/container';
import { ConfigList } from '@/components/config-row';
import { SystemConfigurationRow } from '@/components/system-configuration-row';
import { useTranslation } from '@/hooks/use-translation';
import { SYSTEM_CONFIG_KEYS } from '@/types/system-config-keys';

export function AnalyticsConfig() {
  const { t } = useTranslation('settings');

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="font-medium mb-1">{t('analytics_config_title')}</p>
        <p className="text-sm text-muted-foreground">{t('analytics_config_desc')}</p>
      </div>

      <ConfigList>
        <SystemConfigurationRow
          title={t('analytics_ga4_id')}
          description={t('analytics_ga4_id_desc')}
          disableLabel
          labelKey={SYSTEM_CONFIG_KEYS.analyticsGa4Id}
        />
        <SystemConfigurationRow
          title={t('analytics_clarity_id')}
          description={t('analytics_clarity_id_desc')}
          disableLabel
          labelKey={SYSTEM_CONFIG_KEYS.analyticsClarityId}
        />
      </ConfigList>
    </Container>
  );
}
