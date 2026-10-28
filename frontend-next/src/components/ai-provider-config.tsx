'use client';

import { useEffect, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { z } from "zod";
import { Bot, Cpu, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormBuilder, type FormBuilderField } from "@/components/form/form-builder";
import { ProviderCardGrid } from "@/components/provider-card-grid";
import { useTranslation } from "@/hooks/use-translation";
import { HelpButton, useTour, ignoreTourInteraction, type TourStep } from "@/components/tour";

const aiIcons: Record<string, ReactNode> = {
  ANTHROPIC: <Sparkles className="size-5" />,
  OPENAI: <Bot className="size-5" />,
  OPENAI_COMPATIBLE: <Cpu className="size-5" />,
};

function getAiProviderDescription(t: (key: string) => string, provider: string): string {
  const key = `system_ai_provider_${provider.toLowerCase()}_desc`;
  const translated = t(key);
  return translated === key ? '' : translated;
}

/** Bloco de configuração de provider de IA: ProviderCardGrid + formulário de credenciais em modal. */
interface AiProviderConfigProps<TSchema extends z.ZodType<FieldValues>> {
  title: string;
  description: string;
  options: string[];
  /** Provider em uso: fica com badge Ativo e destaque visual. */
  active: string;
  isConfiguredFor?: (provider: string) => boolean;
  isOperational?: boolean;
  /** Provider com o formulário aberto (`null` = modal fechado). */
  editing: string | null;
  onEdit: (provider: string | null) => void;
  /** Ativa o provider diretamente. */
  onActivate: (provider: string) => void;
  disabled?: boolean;
  /** i18n: recebe o id do provider (ANTHROPIC, OPENAI, …). */
  labelFor: (provider: string) => string;
  /** Schema/campos/valores do provider em `editing`. */
  schema: TSchema;
  fields: FormBuilderField[];
  values: Partial<z.infer<TSchema>>;
  onSubmit: (data: z.infer<TSchema>) => Promise<unknown>;
  submitLabel: string;
}

export function AiProviderConfig<TSchema extends z.ZodType<FieldValues>>({
  title,
  description,
  options,
  active,
  isConfiguredFor,
  isOperational,
  editing,
  onEdit,
  onActivate,
  disabled,
  labelFor,
  schema,
  fields,
  values,
  onSubmit,
  submitLabel,
}: AiProviderConfigProps<TSchema>) {
  const { t } = useTranslation('settings');
  const { registerTour } = useTour();

  useEffect(() => {
    if (!editing) return;
    const tourSteps: TourStep[] = [
      {
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t('system_ai_tour_apiKey_title')}</p>
            <p className="text-sm text-muted-foreground">{t('system_ai_tour_apiKey')}</p>
          </div>
        ),
        selectorId: 'ai-field-apiKey',
        position: 'right',
      },
      {
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t('system_ai_tour_model_title')}</p>
            <p className="text-sm text-muted-foreground">{t('system_ai_tour_model')}</p>
          </div>
        ),
        selectorId: 'ai-field-model',
        position: 'right',
      },
    ];

    if (editing === 'OPENAI_COMPATIBLE') {
      tourSteps.unshift({
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t('system_ai_tour_baseUrl_title')}</p>
            <p className="text-sm text-muted-foreground">{t('system_ai_tour_baseUrl')}</p>
          </div>
        ),
        selectorId: 'ai-field-baseUrl',
        position: 'right',
      });
    }

    registerTour('settings-ai', tourSteps);
  }, [editing, registerTour, t]);

  const providerCards = options.map((option) => {
    const isConfigured = isConfiguredFor ? isConfiguredFor(option) : true;
    const isSelected = option === active;
    const isActive = isSelected && isConfigured && (isOperational ?? true);

    return {
      id: option,
      name: labelFor(option),
      description: getAiProviderDescription(t, option) || description,
      icon: aiIcons[option] ?? <Bot className="size-5" />,
      isActive,
      isConfigured,
      canActivate: isConfigured,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <p className="font-medium mb-1">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <ProviderCardGrid
        providers={providerCards}
        onActivate={onActivate}
        onConfigure={onEdit}
        configureLabel={t('provider_configure')}
        activeLabel={t('provider_active')}
        activateLabel={t('provider_activate')}
        configuredLabel={t('provider_configured')}
        notConfiguredLabel={t('provider_not_configured')}
        disabled={disabled}
        columns={3}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && onEdit(null)}>
        <DialogContent onInteractOutside={ignoreTourInteraction}>
          <DialogHeader>
            <DialogTitle>{editing && labelFor(editing)}</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="mb-2 flex items-center justify-end gap-1 text-sm text-muted-foreground">
                {t('system_ai_tour_hint')}
                <HelpButton tourId="settings-ai" startDirect />
              </div>
              <FormBuilder
                key={editing}
                mode="edit"
                schema={schema}
                fields={fields}
                values={values}
                onSubmit={onSubmit}
                submitLabel={submitLabel}
                onCancel={() => onEdit(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
