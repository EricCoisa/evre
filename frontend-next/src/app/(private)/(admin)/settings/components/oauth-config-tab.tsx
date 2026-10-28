'use client';

import { useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Container } from "@/components/container";
import { ProviderCardGrid } from "@/components/provider-card-grid";
import { ProviderEnabledSwitch } from "@/components/provider-enabled-switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormBuilder } from "@/components/form/form-builder";
import { useConfigurationValues } from "@/lib/actions/systemConfiguration/queries";
import { useOAuthProviders } from "@/lib/actions/auth/queries";
import { saveOAuthConfig } from "@/lib/actions/auth/api";
import { useTranslation, type TFunc } from "@/hooks/use-translation";

/** Um botão por provider OAuth configurado no backend, com formulário validado no submit. */

/** `window.location.origin` não muda dentro da página — não há a que se inscrever. */
const subscribeToNothing = () => () => {};

/** Dica do issuer por provider (`system_oauth_issuer_desc_<id>`), com fallback no texto genérico. */
function issuerHint(t: TFunc, providerId: string): string {
  const key = `system_oauth_issuer_desc_${providerId.toLowerCase()}`;
  const text = t(key);
  return text === key ? t('system_oauth_issuer_desc') : text;
}

const oauthSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
});

export function OAuthConfig() {
  const { t } = useTranslation('settings');
  const { data: providers } = useOAuthProviders();
  // O redirect_uri é do front: no servidor vem de NEXTAUTH_URL, no browser do próprio origin.
  const redirectUri = useSyncExternalStore(
    subscribeToNothing,
    () => `${window.location.origin}/api/auth/oauth/callback`,
    () => '', // SSR: sem window; o valor real entra na hidratação, sem mismatch
  );
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);

  // Só as chaves do provider aberto — o secret nunca hidrata (vem mascarado).
  const { values } = useConfigurationValues(
    editing
      ? [`SYSTEM_OAUTH_${editing.id}_ISSUER`, `SYSTEM_OAUTH_${editing.id}_CLIENT_ID`]
      : [],
  );

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!editing) return;
    const result = await saveOAuthConfig(editing.id, formData as never);
    if (!result.success) throw new Error(result.message);
    await queryClient.invalidateQueries({ queryKey: ['oauth-providers'] });
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    setEditing(null);
    return result;
  };

  const oauthCards = (providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.label,
    description: issuerHint(t, provider.id),
    icon: <KeyRound className="size-5" />,
    isActive: Boolean(provider.configured && provider.enabled),
    isConfigured: Boolean(provider.configured),
    rightSlot: provider.configured ? (
      <ProviderEnabledSwitch
        labelKey={`SYSTEM_OAUTH_${provider.id}_ENABLED`}
        label={t('system_oauth_configured')}
        invalidateKeys={[['oauth-providers']]}
      />
    ) : undefined,
  }));

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="font-medium mb-1">{t('oauthConfiguration')}</p>
        <p className="text-sm text-muted-foreground">
          {t('system_oauth_redirect_uri', { url: redirectUri })}
        </p>
      </div>

      <ProviderCardGrid
        providers={oauthCards}
        onConfigure={(id) => {
          const p = providers?.find((x) => x.id === id);
          if (p) setEditing({ id: p.id, label: p.label });
        }}
        configureLabel={t('provider_configure')}
        activeLabel={t('system_oauth_configured')}
        configuredLabel={t('provider_configured')}
        notConfiguredLabel={t('system_oauth_not_configured')}
        columns={2}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          {editing && (
            <FormBuilder
              key={editing.id}
              mode="edit"
              schema={oauthSchema}
              fields={[
                { name: 'issuer', label: t('system_oauth_issuer'), description: issuerHint(t, editing.id) },
                { name: 'clientId', label: t('system_oauth_client_id'), description: t('system_oauth_client_id_desc') },
                {
                  name: 'clientSecret',
                  label: t('system_oauth_client_secret'),
                  description: t('secret_keep_blank'),
                  type: 'password',
                  placeholder: '••••••••',
                },
              ]}
              values={{
                issuer: (values[`SYSTEM_OAUTH_${editing.id}_ISSUER`] as string) ?? '',
                clientId: (values[`SYSTEM_OAUTH_${editing.id}_CLIENT_ID`] as string) ?? '',
              }}
              onSubmit={handleSubmit}
              submitLabel={t('save_configuration')}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
