'use client';

import { Container } from "@/components/container";
import { SystemConfiguration } from "@/components/system-configuration";
import { SystemConfigurationRow } from "@/components/system-configuration-row";
import { UserSystemDefinitions } from "@/components/user-system-definitions";
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { SYSTEM_CONFIG_KEYS } from '@/types/system-config-keys';
import { ConfigRow, ConfigList } from "@/components/config-row";
import { useTranslation } from "@/hooks/use-translation";

export function UserDefaultConfig() {
  const { t } = useTranslation('settings');
  return (
    <Container variant="form" padding>
      <ConfigList>
        <ConfigRow id={SYSTEM_CONFIG_KEYS.theme} title={t('system_definition_theme')} description={t('system_definitions_theme_desc')}>
          <SystemConfiguration disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.theme} />
        </ConfigRow>
        <ConfigRow id={USER_CONFIG_KEYS.language} title={t('user_system_definition_language')} description={t('user_system_definitions_language_desc')}>
          <UserSystemDefinitions disableLabel={true} labelKey={USER_CONFIG_KEYS.language} />
        </ConfigRow>
        <SystemConfigurationRow
          title={t('system_user_create')}
          description={t('system_user_create_desc')}
          disableLabel={true}
          labelKey={SYSTEM_CONFIG_KEYS.userCreate}
        />
      </ConfigList>
    </Container>
  );
}
