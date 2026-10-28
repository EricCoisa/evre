'use client';

import { useEffect, useRef, useState } from "react";
import { useTour, ignoreTourInteraction } from "@/components/tour";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Container } from "@/components/container";
import { SystemConfigurationRow } from "@/components/system-configuration-row";
import { ConfigList } from "@/components/config-row";
import { FormBuilder } from "@/components/form/form-builder";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type ProviderCardItem, ProviderCardGrid } from "@/components/provider-card-grid";
import { useConfiguration, useConfigurationValues } from "@/lib/actions/systemConfiguration/queries";
import { isConfigValuePresent } from "@/lib/actions/systemConfiguration/helpers";
import { getCaptchaProviders, saveCaptchaConfig } from "@/lib/actions/captcha/api";
import { useCapability } from "@/lib/actions/capability/queries";
import { CAPABILITIES } from "@/types/capabilities";
import { SYSTEM_CONFIG_KEYS } from "@/types/system-config-keys";
import { requestCaptchaToken } from "@/hooks/use-captcha";
import type { CaptchaProviderDto, SaveCaptchaConfigDto } from "@/lib/generated/schemas";
import { useTranslation } from "@/hooks/use-translation";

/** Formulário de credenciais de captcha, validado resolvendo o widget do provider no submit. */

function getCaptchaProviderDescription(t: ReturnType<typeof useTranslation>['t'], providerId: string): string {
  const key = `system_captcha_provider_${providerId.toLowerCase()}_desc`;
  const translated = t(key);
  return translated === key ? t('system_captcha_provider_desc') : translated;
}

const captchaCredentialsSchema = z.object({
  siteKey: z.string().min(1),
  secretKey: z.string().optional(),
});

function getCaptchaCardItems(
  providers: CaptchaProviderDto[],
  activeProvider: string,
  siteKey: string | undefined,
  isOperational: boolean,
  t: ReturnType<typeof useTranslation>['t']
): ProviderCardItem[] {
  return providers.map((p) => {
    const isSelected = p.id === activeProvider;
    const isConfigured = isSelected ? isConfigValuePresent(siteKey) : undefined;
    const isActive = isSelected && Boolean(isConfigured) && isOperational;

    return {
      id: p.id,
      name: p.label,
      description: getCaptchaProviderDescription(t, p.id),
      icon: <ShieldCheck className="size-5" />,
      isActive,
      isConfigured,
    };
  });
}

export function CaptchaConfig() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [providers, setProviders] = useState<CaptchaProviderDto[]>([]);
  const [editing, setEditing] = useState<CaptchaProviderDto | null>(null);
  const { data: providerConfig } = useConfiguration<string>('SYSTEM_CAPTCHA_PROVIDER');
  const captchaCap = useCapability(CAPABILITIES.captcha);
  const isOperational = captchaCap.operational;

  // Secret nunca hidrata: o GET devolve `****`, nunca o valor real.
  const { values } = useConfigurationValues([
    'SYSTEM_CAPTCHA_PROVIDER',
    'SYSTEM_CAPTCHA_SITE_KEY',
  ]);

  const activeProvider = (providerConfig?.value ?? values.SYSTEM_CAPTCHA_PROVIDER ?? '') as string;

  useEffect(() => {
    void getCaptchaProviders().then((res) => setProviders(res.data ?? []));
  }, []);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!editing) return;
    const provider = editing.id;
    const siteKey = formData.siteKey as string;
    const scriptUrl = editing.scriptUrl;

    if (!scriptUrl || !widgetRef.current) {
      throw new Error(t('system_captcha_provider_unavailable'));
    }

    let token: string;
    try {
      token = await requestCaptchaToken({ provider, siteKey, scriptUrl }, widgetRef.current);
    } catch {
      // O provider recusou a site key (ou o desafio não foi resolvido). Não adianta
      // chamar o backend: ele só conseguiria julgar a secret.
      throw new Error(t('system_captcha_sitekey_invalid'));
    }

    const result = await saveCaptchaConfig({
      // O id vem do catálogo do backend, que é a fonte do enum — mas ele trafega
      // como string. O backend revalida contra CaptchaProviderIds de qualquer jeito.
      provider: provider as SaveCaptchaConfigDto['provider'],
      siteKey,
      secretKey: (formData.secretKey as string) || undefined,
      token,
    });
    // Mensagem do provider, repassada pelo ProviderResult — ex.: secret inválida,
    // ou chaves de sites diferentes.
    if (!result.success) throw new Error(result.message);

    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    // siteKey/secretKey preenchidos é o que CAPTCHA_CAPABILITY.allFilled() checa.
    await queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });
    setEditing(null);
    return result;
  };

  const providerCards = getCaptchaCardItems(
    providers,
    activeProvider,
    values.SYSTEM_CAPTCHA_SITE_KEY as string | undefined,
    isOperational,
    t
  );

  const { registerTour } = useTour();

  useEffect(() => {
    registerTour('settings-captcha', [
      {
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t('system_captcha_tour_siteKey_title')}</p>
            <p className="text-sm text-muted-foreground">{t('system_captcha_tour_siteKey')}</p>
          </div>
        ),
        selectorId: 'captcha-field-siteKey',
        position: 'right',
      },
      {
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t('system_captcha_tour_secretKey_title')}</p>
            <p className="text-sm text-muted-foreground">{t('system_captcha_tour_secretKey')}</p>
          </div>
        ),
        selectorId: 'captcha-field-secretKey',
        position: 'right',
      },
    ]);
  }, [registerTour, t]);

  return (
    <Container variant="form" padding>
      <ConfigList>
        <SystemConfigurationRow
          title={t('system_captcha_enabled')}
          description={t('system_captcha_enabled_desc')}
          disableLabel={true}
          labelKey={SYSTEM_CONFIG_KEYS.captchaEnabled}
        />
      </ConfigList>

      <div className="mt-6">
        <p className="font-medium mb-1">{t('system_captcha_provider')}</p>
        <p className="text-sm text-muted-foreground mb-3">{t('system_captcha_provider_desc')}</p>

        <ProviderCardGrid
          providers={providerCards}
          onConfigure={(id) => setEditing(providers.find((p) => p.id === id) ?? null)}
          configureLabel={t('provider_configure')}
          activeLabel={t('provider_active')}
          configuredLabel={t('provider_configured')}
          notConfiguredLabel={t('provider_not_configured')}
          columns={3}
        />

        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreTourInteraction}>
            <DialogHeader>
              <DialogTitle>{editing?.label}</DialogTitle>
              <DialogDescription>
                {editing && getCaptchaProviderDescription(t, editing.id)}
              </DialogDescription>
            </DialogHeader>

            {editing && (
              <FormBuilder
                key={editing.id}
                mode="edit"
                schema={captchaCredentialsSchema}
                fields={[
                  {
                    name: 'siteKey',
                    label: t('system_captcha_site_key'),
                    description: t('system_captcha_site_key_desc'),
                  },
                  {
                    name: 'secretKey',
                    label: t('system_captcha_secret_key'),
                    description: t('secret_keep_blank'),
                    type: 'password',
                    placeholder: '••••••••',
                  },
                ]}
                values={{
                  siteKey: editing.id === activeProvider ? ((values.SYSTEM_CAPTCHA_SITE_KEY as string) ?? '') : '',
                }}
                onSubmit={handleSubmit}
                submitLabel={t('system_captcha_validate_and_save')}
                onCancel={() => setEditing(null)}
              />
            )}

            {/* Alvo do widget da sonda. Fica visível porque Turnstile e hCaptcha podem
                pedir interação; com reCAPTCHA v3 continua vazio. */}
            <div ref={widgetRef} className="mt-4 empty:hidden" />
          </DialogContent>
        </Dialog>
      </div>
    </Container>
  );
}
