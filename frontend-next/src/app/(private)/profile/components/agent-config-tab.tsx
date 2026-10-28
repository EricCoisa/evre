'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import { useUserConfiguration, useUserConfigurationValues, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { UserConfiguration } from '@/components/user-configuration';
import { ConfigRow, ConfigList } from '@/components/config-row';
import { AiProviderConfig } from '@/components/ai-provider-config';
import { type FormBuilderField } from '@/components/form/form-builder';
import { saveUserAiConfiguration } from '@/lib/actions/ai/api';

/** Configuração BYOK de IA por usuário: um botão por provider, com checkbox de ativação. */

const AI_PROVIDER = {
  ANTHROPIC: 'ANTHROPIC',
  OPENAI: 'OPENAI',
  OPENAI_COMPATIBLE: 'OPENAI_COMPATIBLE',
} as const;

const aiInvalidate = [['ai']];

// baseUrl no schema base (opcional) e obrigatória só no OPENAI_COMPATIBLE — mantém
// o campo no tipo inferido dos dois lados, que é o que o FormBuilder hidrata.
const baseSchema = z.object({
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

const schemaFor = (provider: string) =>
  provider === AI_PROVIDER.OPENAI_COMPATIBLE
    ? baseSchema.extend({ baseUrl: z.string().url() })
    : baseSchema;

/** Espelha USER_AI_CONFIG_KEYS do backend — a chave nunca hidrata (vem mascarada). */
const MODEL_KEY: Record<string, string> = {
  [AI_PROVIDER.ANTHROPIC]: 'USERCONFIG_AGENT_ANTHROPIC_MODEL',
  [AI_PROVIDER.OPENAI]: 'USERCONFIG_AGENT_OPENAI_MODEL',
  [AI_PROVIDER.OPENAI_COMPATIBLE]: 'USERCONFIG_AGENT_OPENAI_COMPATIBLE_MODEL',
};

const BASE_URL_KEY = 'USERCONFIG_AGENT_OPENAI_COMPATIBLE_BASE_URL';

// Todas as chaves de uma vez: a lista precisa ser estável entre renders para o useSuspenseQueries.
const HYDRATE_KEYS = [...Object.values(MODEL_KEY), BASE_URL_KEY];

export function AgentConfigTab() {
  const { t } = useTranslation('profile');
  const { data: providerData } = useUserConfiguration<string>('USERCONFIG_AGENT_PROVIDER');
  const { values } = useUserConfigurationValues(HYDRATE_KEYS);
  const queryClient = useQueryClient();
  const setProvider = useSetUserConfiguration<string>();
  const [editing, setEditing] = useState<string | null>(null);

  const active = (providerData?.value as string) ?? AI_PROVIDER.ANTHROPIC;
  // Provider com o formulário aberto — não necessariamente o ativo.
  const provider = editing ?? active;
  const isCompatible = provider === AI_PROVIDER.OPENAI_COMPATIBLE;

  // Checkbox é radio: `USERCONFIG_AGENT_PROVIDER` guarda um provider só, então
  // desmarcar não tem destino — só marcar troca o ativo.
  const activateProvider = async (option: string) => {
    if (!providerData) return;
    await setProvider.mutateAsync({ userConfiguration: { ...providerData, value: option } });
    await queryClient.invalidateQueries({ queryKey: ['ai'], refetchType: 'all' });
  };

  const fields: FormBuilderField[] = [
    ...(isCompatible
      ? ([{
          name: 'baseUrl',
          label: t('userconfig_agent_base_url'),
          description: t('userconfig_agent_base_url_desc'),
        }] as FormBuilderField[])
      : []),
    { name: 'model', label: t('userconfig_agent_model'), description: t('userconfig_agent_model_desc') },
    {
      name: 'apiKey',
      label: t('userconfig_agent_api_key'),
      description: t('secret_keep_blank'),
      type: 'password',
      placeholder: '••••••••',
    },
  ];

  const handleSubmit = async (formData: Record<string, unknown>) => {
    const result = await saveUserAiConfiguration({ provider, ...formData } as never);
    if (!result.success) throw new Error(result.message);
    await queryClient.invalidateQueries({ queryKey: ['user-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['user-configurations'] });
    // Mesmo motivo do tab da plataforma: o chat costuma estar fechado aqui.
    await queryClient.invalidateQueries({ queryKey: ['ai'], refetchType: 'all' });
    setEditing(null);
    return result;
  };

  return (
    <Container variant="form" padding>
      <AiProviderConfig
        title={t('userconfig_agent_provider')}
        description={t('userconfig_agent_provider_desc')}
        options={providerData?.options ?? []}
        active={active}
        editing={editing}
        onEdit={setEditing}
        onActivate={activateProvider}
        disabled={setProvider.isPending}
        labelFor={t}
        schema={schemaFor(provider)}
        fields={fields}
        values={{
          model: (values[MODEL_KEY[provider]] as string) ?? '',
          baseUrl: (values[BASE_URL_KEY] as string) ?? '',
        }}
        onSubmit={handleSubmit}
        submitLabel={t('save_configuration')}
      />

      <div>
        <ConfigList>
          <ConfigRow wide title={t('userconfig_agent_prompt')} description={t('userconfig_agent_prompt_desc')}>
            <UserConfiguration forceType="textarea" manualSave disableLabel={true} labelKey="USERCONFIG_AGENT_PROMPT" invalidateKeys={aiInvalidate} />
          </ConfigRow>
        </ConfigList>
      </div>
    </Container>
  );
}
