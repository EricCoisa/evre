'use client';

import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/container";
import { SystemConfiguration } from "@/components/system-configuration";
import { ConfigRow, ConfigList } from "@/components/config-row";
import { AiProviderConfig } from "@/components/ai-provider-config";
import { type FormBuilderField } from "@/components/form/form-builder";
import { useConfiguration, useConfigurationValues, useUpdateConfiguration } from "@/lib/actions/systemConfiguration/queries";
import { isConfigValuePresent } from "@/lib/actions/systemConfiguration/helpers";
import { useCandidateAiModels } from "@/lib/actions/ai/queries";
import { useAiHealth } from "@/lib/actions/ai/use-ai-health";
import { saveAiConfiguration } from "@/lib/actions/ai/api";
import { useTranslation } from "@/hooks/use-translation";
import { SYSTEM_CONFIG_KEYS } from "@/types/system-config-keys";

/** Um botão por provider de IA, com checkbox de ativação e modal de credenciais. */

const AI_PROVIDER = {
  ANTHROPIC: 'ANTHROPIC',
  OPENAI: 'OPENAI',
  OPENAI_COMPATIBLE: 'OPENAI_COMPATIBLE',
} as const;

// ['ai'] e não ['ai','health']: trocar provider/BYOK muda também a lista de modelos
// que o /agent mostra, e o mapa de queryKey casa por prefixo.
const aiInvalidate = [['ai']];

// baseUrl é opcional no schema base e obrigatório apenas no OPENAI_COMPATIBLE
const baseSchema = z.object({
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

const schemaFor = (provider: string) =>
  provider === AI_PROVIDER.OPENAI_COMPATIBLE
    ? baseSchema.extend({ baseUrl: z.string().url() })
    : baseSchema;

/** Modelo/baseUrl por provider — a chave nunca hidrata (vem mascarada). */
const MODEL_KEY: Record<string, string> = {
  [AI_PROVIDER.ANTHROPIC]: 'SYSTEM_AI_ANTHROPIC_MODEL',
  [AI_PROVIDER.OPENAI]: 'SYSTEM_AI_OPENAI_MODEL',
  [AI_PROVIDER.OPENAI_COMPATIBLE]: 'SYSTEM_AI_OPENAI_COMPATIBLE_MODEL',
};

const AI_REQUIRED_KEYS: Record<string, string[]> = {
  [AI_PROVIDER.ANTHROPIC]: ['SYSTEM_AI_ANTHROPIC_MODEL', 'SYSTEM_AI_ANTHROPIC_API_KEY'],
  [AI_PROVIDER.OPENAI]: ['SYSTEM_AI_OPENAI_MODEL', 'SYSTEM_AI_OPENAI_API_KEY'],
  [AI_PROVIDER.OPENAI_COMPATIBLE]: ['SYSTEM_AI_OPENAI_COMPATIBLE_MODEL', 'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL', 'SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY'],
};

const HYDRATE_KEYS = [
  ...Object.values(MODEL_KEY),
  'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL',
  'SYSTEM_AI_ANTHROPIC_API_KEY',
  'SYSTEM_AI_OPENAI_API_KEY',
  'SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY',
];

const API_KEY_LABEL: Record<string, string> = {
  [AI_PROVIDER.ANTHROPIC]: 'system_ai_anthropic_api_key',
  [AI_PROVIDER.OPENAI]: 'system_ai_openai_api_key',
  [AI_PROVIDER.OPENAI_COMPATIBLE]: 'system_ai_openai_compatible_api_key',
};

const MODEL_LABEL: Record<string, string> = {
  [AI_PROVIDER.ANTHROPIC]: 'system_ai_anthropic_model',
  [AI_PROVIDER.OPENAI]: 'system_ai_openai_model',
  [AI_PROVIDER.OPENAI_COMPATIBLE]: 'system_ai_openai_compatible_model',
};

function getAiConfigFields(
  editing: string | null,
  modelOptions: string[],
  t: (k: string) => string,
): FormBuilderField[] {
  if (!editing) return [];
  const fields: FormBuilderField[] = [];
  if (editing === AI_PROVIDER.OPENAI_COMPATIBLE) {
    fields.push({
      name: 'baseUrl',
      label: t('system_ai_openai_compatible_base_url'),
      description: t('system_ai_openai_compatible_base_url_desc'),
    });
  }
  const modelField: FormBuilderField = {
    name: 'model',
    label: t(MODEL_LABEL[editing]),
    description: t(`${MODEL_LABEL[editing]}_desc`),
  };
  if (modelOptions.length > 0) {
    modelField.type = 'select';
    modelField.options = modelOptions.map((m) => ({ value: m, label: m }));
  }
  fields.push(modelField);
  fields.push({
    name: 'apiKey',
    label: t(API_KEY_LABEL[editing]),
    description: t('secret_keep_blank'),
    type: 'password',
    placeholder: '••••••••',
  });
  return fields;
}

function AiSystemPromptSection({ byok, t }: { byok: boolean; t: (k: string) => string }) {
  return (
    <div>
      <ConfigList>
        <ConfigRow id={SYSTEM_CONFIG_KEYS.aiSystemPrompt} wide title={t('system_ai_system_prompt')} description={t('system_ai_system_prompt_desc')}>
          <SystemConfiguration forceType="textarea" manualSave disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.aiSystemPrompt} invalidateKeys={aiInvalidate} />
        </ConfigRow>

        <ConfigRow id={SYSTEM_CONFIG_KEYS.agentOwnKey} title={t('system_agent_own_key')} description={t('system_agent_own_key_desc')}>
          <SystemConfiguration disableLabel={true} labelKey={SYSTEM_CONFIG_KEYS.agentOwnKey} invalidateKeys={aiInvalidate} />
        </ConfigRow>
      </ConfigList>

      {byok && (
        <p className="text-sm text-muted-foreground pt-4">{t('byok_active_note')}</p>
      )}
    </div>
  );
}

function getAiFormValues(values: Record<string, unknown>, selectedKey: string) {
  const modelVal = values[MODEL_KEY[selectedKey]];
  const baseUrlVal = values.SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL;
  return {
    model: typeof modelVal === 'string' ? modelVal : '',
    baseUrl: typeof baseUrlVal === 'string' ? baseUrlVal : '',
  };
}

function AiProviderSection({
  data,
  values,
  updatePending,
  onActivate,
  onSave,
  isOperational,
  t,
}: {
  data: ReturnType<typeof useConfiguration<string>>['data'];
  values: Record<string, unknown>;
  updatePending: boolean;
  onActivate: (option: string) => Promise<void>;
  onSave: (editing: string, formData: Record<string, unknown>) => Promise<unknown>;
  isOperational: boolean;
  t: (key: string) => string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const active = typeof data?.value === 'string' ? data.value : AI_PROVIDER.ANTHROPIC;
  const { data: candidateModels } = useCandidateAiModels(editing);
  const modelOptions = candidateModels?.models ?? [];
  const fields = getAiConfigFields(editing, modelOptions, t);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!editing) return;
    await onSave(editing, formData);
    setEditing(null);
  };

  const selectedKey = editing ?? active;
  const formValues = getAiFormValues(values, selectedKey);
  const isBlocked = Boolean(data?.blocked);

  return (
    <AiProviderConfig
      title={t('system_ai_provider')}
      description={t('system_ai_provider_desc')}
      options={data?.options ?? []}
      active={active}
      isConfiguredFor={(option) => {
        const req = AI_REQUIRED_KEYS[option] ?? [];
        return req.length > 0 && req.every((k) => isConfigValuePresent(values[k]));
      }}
      isOperational={isOperational}
      editing={editing}
      onEdit={setEditing}
      onActivate={onActivate}
      disabled={updatePending || isBlocked}
      labelFor={t}
      schema={schemaFor(selectedKey)}
      fields={fields}
      values={formValues}
      onSubmit={handleSubmit}
      submitLabel={t('save_configuration')}
    />
  );
}

export function AiConfig() {
  const { t } = useTranslation('settings');
  const { data } = useConfiguration<string>('SYSTEM_AI_PROVIDER');
  const { values } = useConfigurationValues(HYDRATE_KEYS);
  const queryClient = useQueryClient();
  const updateProvider = useUpdateConfiguration<string>();

  const { operational: isAiOperational } = useAiHealth();
  const { data: byokData } = useConfiguration('SYSTEM_AGENT_OWN_KEY');
  const byok = String(byokData?.value) === 'true';

  const selectProvider = async (option: string) => {
    if (!data) return;
    const req = AI_REQUIRED_KEYS[option] ?? [];
    const isConfigured = req.length > 0 && req.every((k) => isConfigValuePresent(values[k]));
    if (!isConfigured) return;
    await updateProvider.mutateAsync({ systemConfiguration: { ...data, value: option } });
    await queryClient.invalidateQueries({ queryKey: ['ai'], refetchType: 'all' });
  };

  const handleSave = async (editing: string, formData: Record<string, unknown>) => {
    const result = await saveAiConfiguration({ provider: editing, ...formData } as never);
    if (!result.success) throw new Error(result.message);
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['ai'], refetchType: 'all' });
    return result;
  };

  return (
    <Container variant="form" padding>
      {!byok && (
        <AiProviderSection
          data={data}
          values={values}
          updatePending={updateProvider.isPending}
          onActivate={selectProvider}
          onSave={handleSave}
          isOperational={isAiOperational}
          t={t}
        />
      )}

      <AiSystemPromptSection byok={byok} t={t} />
    </Container>
  );
}
