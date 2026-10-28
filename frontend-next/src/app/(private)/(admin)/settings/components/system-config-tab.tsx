'use client';

import { useState, useMemo, useCallback } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Activity } from "lucide-react";
import { Container } from "@/components/container";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SystemConfiguration } from "@/components/system-configuration";
import { ConfigRow, ConfigList } from "@/components/config-row";
import { ProviderEnabledSwitch } from "@/components/provider-enabled-switch";
import { ProviderCardGrid, type ProviderCardItem } from "@/components/provider-card-grid";
import { FormBuilder } from "@/components/form/form-builder";
import {
  useConfiguration,
  useConfigurationValues,
} from "@/lib/actions/systemConfiguration/queries";
import { isConfigValuePresent } from "@/lib/actions/systemConfiguration/helpers";
import {
  getSystemConfiguration,
  updateSystemConfiguration,
} from "@/lib/actions/systemConfiguration/api";
import { saveSentryConfig } from "@/lib/actions/sentry/api";
import { useTranslation, type TFunc } from "@/hooks/use-translation";
import { SYSTEM_CONFIG_KEYS } from "@/types/system-config-keys";

/** DSN vazio é aceito e significa "nenhum destino"; o backend sonda o DSN antes de gravar. */
const sentrySchema = z.object({ dsn: z.string() });

const supportSchema = z.object({
  supportUrl: z.string().optional(),
  systemId: z.string().optional(),
  systemToken: z.string().optional(),
});

async function saveSingleConfig(labelKey: string, nextValue: string): Promise<void> {
  const res = await getSystemConfiguration<string>(labelKey);
  if (res.data?.id && !res.data.blocked) {
    await updateSystemConfiguration(res.data.id, nextValue);
  }
}

async function saveSupportCredentials(data: Record<string, unknown>): Promise<void> {
  const nextUrl = ((data.supportUrl as string) ?? '').trim();
  const nextSystemId = ((data.systemId as string) ?? '').trim();
  const nextToken = ((data.systemToken as string) ?? '').trim();

  await Promise.all([
    saveSingleConfig('SYSTEMCONFIG_SUPORTURL', nextUrl),
    saveSingleConfig('SYSTEMID', nextSystemId),
    nextToken ? saveSingleConfig('SYSTEMTOKEN', nextToken) : Promise.resolve(),
  ]);
}

interface SupportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supportUrl: string;
  systemId: string;
  systemToken: string;
  isIdBlocked?: boolean;
  isTokenBlocked?: boolean;
  onSuccess: () => void;
}

function SupportConfigDialog({
  open,
  onOpenChange,
  supportUrl,
  systemId,
  systemToken,
  isIdBlocked,
  isTokenBlocked,
  onSuccess,
}: SupportConfigDialogProps) {
  const { t } = useTranslation('settings');

  const fields = useMemo(() => [
    {
      name: 'supportUrl',
      label: t('systemconfig_suporturl'),
      description: t('systemconfig_suporturl_desc'),
      placeholder: 'http://localhost:3002',
    },
    {
      name: 'systemId',
      label: t('systemconfig_sistemId'),
      description: t('systemconfig_sistemId_desc'),
      disabled: isIdBlocked,
    },
    {
      name: 'systemToken',
      label: t('systemconfig_tokenSystem'),
      description: t('systemconfig_tokenSystem_desc'),
      disabled: isTokenBlocked,
    },
  ], [t, isIdBlocked, isTokenBlocked]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('system_support_modal_title')}</DialogTitle>
          <DialogDescription>{t('system_support_modal_desc')}</DialogDescription>
        </DialogHeader>
        <FormBuilder
          mode="edit"
          schema={supportSchema}
          fields={fields}
          values={{ supportUrl, systemId, systemToken }}
          onSubmit={async (formData) => {
            await saveSupportCredentials(formData);
            onSuccess();
          }}
          submitLabel={t('save_configuration')}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SentryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dsn: string;
  onSuccess: () => void;
}

function SentryConfigDialog({ open, onOpenChange, dsn, onSuccess }: SentryConfigDialogProps) {
  const { t } = useTranslation('settings');

  const fields = useMemo(() => [
    {
      name: 'dsn',
      label: t('systemconfig_sentry_dsn'),
      description: t('systemconfig_sentry_dsn_desc'),
      placeholder: 'https://chave@o0.ingest.sentry.io/1234567',
    },
  ], [t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sentry</DialogTitle>
          <DialogDescription>{t('systemconfig_sentry_intro')}</DialogDescription>
        </DialogHeader>
        <FormBuilder
          mode="edit"
          schema={sentrySchema}
          fields={fields}
          values={{ dsn }}
          onSubmit={async (formData) => {
            const result = await saveSentryConfig({ dsn: ((formData.dsn as string) ?? '').trim() });
            if (!result.success) throw new Error(result.message);
            onSuccess();
            return result;
          }}
          submitLabel={t('save_configuration')}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function buildMonitoringCards({
  t,
  isSupportConfigured,
  sendLogEnabled,
  isSentryConfigured,
  sentryEnabled,
}: {
  t: TFunc;
  isSupportConfigured: boolean;
  sendLogEnabled: boolean;
  isSentryConfigured: boolean;
  sentryEnabled: boolean;
}): ProviderCardItem[] {
  return [
    {
      id: 'support',
      name: t('system_support_provider'),
      description: t('system_support_provider_desc'),
      icon: <Headphones className="size-5" />,
      isActive: Boolean(isSupportConfigured && sendLogEnabled),
      isConfigured: isSupportConfigured,
      rightSlot: isSupportConfigured ? (
        <ProviderEnabledSwitch
          labelKey="SYSTEMCONFIG_SENDLOG"
          label={t('systemconfig_sendlog')}
          invalidateKeys={[['system-configuration']]}
        />
      ) : undefined,
    },
    {
      id: 'sentry',
      name: 'Sentry',
      description: t('system_sentry_provider_desc'),
      icon: <Activity className="size-5" />,
      isActive: Boolean(isSentryConfigured && sentryEnabled),
      isConfigured: isSentryConfigured,
      rightSlot: isSentryConfigured ? (
        <ProviderEnabledSwitch
          labelKey="SYSTEM_SENTRY_ENABLED"
          label={t('systemconfig_sentry_enabled')}
          invalidateKeys={[['system-configuration']]}
        />
      ) : undefined,
    },
  ];
}

export function SystemConfig() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const [editingSentry, setEditingSentry] = useState(false);
  const [editingSupport, setEditingSupport] = useState(false);

  const { values } = useConfigurationValues([
    'SYSTEM_SENTRY_DSN',
    'SYSTEM_SENTRY_ENABLED',
    'SYSTEMCONFIG_SUPORTURL',
    'SYSTEMCONFIG_SENDLOG',
    'SYSTEMID',
    'SYSTEMTOKEN',
  ]);

  const { data: systemIdConfig } = useConfiguration<string>('SYSTEMID');
  const { data: systemTokenConfig } = useConfiguration<string>('SYSTEMTOKEN');

  const dsn = (values.SYSTEM_SENTRY_DSN as string) ?? '';
  const sentryEnabled = String(values.SYSTEM_SENTRY_ENABLED) === 'true';

  const supportUrl = (values.SYSTEMCONFIG_SUPORTURL as string) ?? '';
  const sendLogEnabled = String(values.SYSTEMCONFIG_SENDLOG) === 'true';
  const systemId = (values.SYSTEMID as string) ?? '';
  const systemToken = (values.SYSTEMTOKEN as string) ?? '';

  const isSupportConfigured = isConfigValuePresent(supportUrl);
  const isSentryConfigured = isConfigValuePresent(dsn);

  const refreshConfigs = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
  }, [queryClient]);

  const monitoringCards = useMemo(
    () => buildMonitoringCards({ t, isSupportConfigured, sendLogEnabled, isSentryConfigured, sentryEnabled }),
    [t, isSupportConfigured, sendLogEnabled, isSentryConfigured, sentryEnabled],
  );

  const handleConfigureProvider = useCallback((id: string) => {
    if (id === 'support') setEditingSupport(true);
    if (id === 'sentry') setEditingSentry(true);
  }, []);

  return (
    <Container variant="form" padding>
      <ConfigList>
        <ConfigRow id={SYSTEM_CONFIG_KEYS.logMinLevel} title={t('system_log_min_level')} description={t('system_log_min_level_desc')}>
          <SystemConfiguration disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.logMinLevel} />
        </ConfigRow>
        <ConfigRow id={SYSTEM_CONFIG_KEYS.logLimite} title={t('systemconfig_log_limite')} description={t('systemconfig_log_limite_desc')}>
          <SystemConfiguration disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.logLimite} />
        </ConfigRow>
        <ConfigRow id={SYSTEM_CONFIG_KEYS.logDeleteDay} title={t('systemconfig_log_delete_day')} description={t('systemconfig_log_delete_day_desc')}>
          <SystemConfiguration disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.logDeleteDay} />
        </ConfigRow>
      </ConfigList>

      <div className="mt-8">
        <div className="mb-4">
          <p className="font-medium mb-1">{t('monitoring_providers_title')}</p>
          <p className="text-sm text-muted-foreground">{t('monitoring_providers_intro')}</p>
        </div>

        <ProviderCardGrid
          providers={monitoringCards}
          onConfigure={handleConfigureProvider}
          configureLabel={t('provider_configure')}
          activeLabel={t('provider_active')}
          configuredLabel={t('provider_configured')}
          notConfiguredLabel={t('provider_not_configured')}
          columns={2}
        />
      </div>

      <SupportConfigDialog
        open={editingSupport}
        onOpenChange={setEditingSupport}
        supportUrl={supportUrl}
        systemId={systemId}
        systemToken={systemToken}
        isIdBlocked={systemIdConfig?.blocked}
        isTokenBlocked={systemTokenConfig?.blocked}
        onSuccess={() => {
          void refreshConfigs();
          setEditingSupport(false);
        }}
      />

      <SentryConfigDialog
        open={editingSentry}
        onOpenChange={setEditingSentry}
        dsn={dsn}
        onSuccess={() => {
          void refreshConfigs();
          setEditingSentry(false);
        }}
      />
    </Container>
  );
}
