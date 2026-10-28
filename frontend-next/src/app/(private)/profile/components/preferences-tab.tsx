'use client';

import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import { UserConfiguration } from '@/components/user-configuration';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { ConfigRow, ConfigList } from '@/components/config-row';

export function PreferencesTab() {
  const { t } = useTranslation('profile');

  return (
    <Container variant="form" padding>
      <div className="space-y-4">
        <div className="border-b pb-3">
          <h3 className="text-base font-semibold">{t('preferencesTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('preferencesDesc')}</p>
        </div>
        <ConfigList>
          <ConfigRow title={t('userconfig_theme')} description={t('userconfig_desc_theme')}>
            <UserConfiguration disableLabel={true} labelKey={USER_CONFIG_KEYS.theme} />
          </ConfigRow>
          <ConfigRow title={t('userconfig_language')} description={t('userconfig_desc_language')}>
            <UserConfiguration disableLabel={true} labelKey={USER_CONFIG_KEYS.language} />
          </ConfigRow>
        </ConfigList>
      </div>
    </Container>
  );
}
