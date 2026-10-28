'use client';

import { Fragment, useState, type ReactNode } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Server } from "lucide-react";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormBuilder, type FormBuilderField } from "@/components/form/form-builder";
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
  useStepper,
} from "@/components/ui/stepper";
import { useConfiguration, useConfigurationValues } from "@/lib/actions/systemConfiguration/queries";
import { isConfigValuePresent } from "@/lib/actions/systemConfiguration/helpers";
import { EmailProvider } from "@/lib/actions/systemConfiguration/types";
import { type ProviderCardItem, ProviderCardGrid } from "@/components/provider-card-grid";
import { saveEmailConfiguration } from "@/lib/actions/email/api";
import { useCapability } from "@/lib/actions/capability/queries";
import { CAPABILITIES } from "@/types/capabilities";
import { EmailTemplatesDialog } from "./email-templates-dialog";
import { useTranslation } from "@/hooks/use-translation";
import { useActivateProvider } from "@/hooks/use-activate-provider";

/** Um botão por provider de e-mail, com formulário (ou stepper para SMTP) para editar credenciais. */

const baseSchema = z.object({ defaultFrom: z.string().email() });

const resendSchema = baseSchema.extend({ apiKey: z.string().optional() });

const smtpServerSchema = z.object({
  defaultFrom: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean().optional(),
});

const smtpCredentialsSchema = z.object({
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

/** Chaves lidas para hidratar o formulário — segredos ficam de fora de propósito. */
const HYDRATE_KEYS = [
  'SYSTEM_EMAIL_DEFAULT_FROM',
  'SYSTEM_EMAIL_SMTP_HOST',
  'SYSTEM_EMAIL_SMTP_PORT',
  'SYSTEM_EMAIL_SMTP_USER',
  'SYSTEM_EMAIL_SMTP_SECURE',
  'SYSTEM_EMAIL_PROVIDER_API_KEY',
];

function getEmailFields(isSmtp: boolean, onServerStep: boolean, t: ReturnType<typeof useTranslation>['t']): FormBuilderField[] {
  if (!isSmtp) {
    return [
      { name: 'defaultFrom', label: t('system_email_default_from'), description: t('system_email_default_from_desc'), type: 'email' },
      { name: 'apiKey', label: t('system_email_provider_api_key'), description: t('secret_keep_blank'), type: 'password', placeholder: '••••••••' },
    ];
  }
  if (onServerStep) {
    return [
      { name: 'defaultFrom', label: t('system_email_default_from'), description: t('system_email_default_from_desc'), type: 'email' },
      { name: 'smtpHost', label: t('system_email_smtp_host'), description: t('system_email_smtp_host_desc') },
      { name: 'smtpPort', label: t('system_email_smtp_port'), description: t('system_email_smtp_port_desc'), type: 'number' },
      { name: 'smtpSecure', label: t('system_email_smtp_secure'), description: t('system_email_smtp_secure_desc'), type: 'checkbox' },
    ];
  }
  return [
    { name: 'smtpUser', label: t('system_email_smtp_user'), description: t('system_email_smtp_user_desc') },
    { name: 'smtpPass', label: t('system_email_smtp_pass'), description: t('secret_keep_blank'), type: 'password', placeholder: '••••••••' },
  ];
}

function getEmailSchema(isSmtp: boolean, onServerStep: boolean) {
  if (!isSmtp) return resendSchema;
  return onServerStep ? smtpServerSchema : smtpCredentialsSchema;
}

function SmtpStepperHeader({
  stepper,
  steps,
}: {
  stepper: ReturnType<typeof useStepper>;
  steps: Array<{ id: string; title: string; description: string }>;
}) {
  return (
    <Stepper index={stepper.index}>
      <StepperList>
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            <StepperItem step={i}>
              <StepperTrigger step={i}>
                <StepperIndicator step={i} />
                <div>
                  <StepperTitle>{step.title}</StepperTitle>
                  <StepperDescription>{step.description}</StepperDescription>
                </div>
              </StepperTrigger>
            </StepperItem>
            {i < steps.length - 1 && <StepperSeparator step={i} />}
          </Fragment>
        ))}
      </StepperList>
      {steps.map((step, i) => (
        <StepperContent key={step.id} step={i} />
      ))}
    </Stepper>
  );
}

function getInitialEmailValues(values: Record<string, unknown>, pending: Record<string, unknown>) {
  return {
    defaultFrom: (values.SYSTEM_EMAIL_DEFAULT_FROM as string) ?? '',
    smtpHost: (values.SYSTEM_EMAIL_SMTP_HOST as string) ?? '',
    smtpPort: Number(values.SYSTEM_EMAIL_SMTP_PORT ?? 587),
    smtpUser: (values.SYSTEM_EMAIL_SMTP_USER as string) ?? '',
    smtpSecure: String(values.SYSTEM_EMAIL_SMTP_SECURE) === 'true',
    ...pending,
  };
}

function getEmailFormActions({
  isSmtp,
  isFirstStep,
  onServerStep,
  onCancel,
  onPrev,
  t,
}: {
  isSmtp: boolean;
  isFirstStep: boolean;
  onServerStep: boolean;
  onCancel: () => void;
  onPrev: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const canGoBack = isSmtp && !isFirstStep;
  return {
    submitLabel: onServerStep ? t('stepper_next') : t('save_configuration'),
    cancelLabel: canGoBack ? t('stepper_back') : undefined,
    handleCancel: canGoBack ? onPrev : onCancel,
  };
}

function EmailEditForm({
  editing,
  values,
  t,
  onSaved,
  onCancel,
}: {
  editing: string;
  values: Record<string, unknown>;
  t: ReturnType<typeof useTranslation>['t'];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState<Record<string, unknown>>({});

  const smtpSteps = [
    { id: 'server', title: t('system_email_step_server'), description: t('system_email_step_server_desc') },
    { id: 'credentials', title: t('system_email_step_credentials'), description: t('system_email_step_credentials_desc') },
  ];
  const stepper = useStepper(smtpSteps);

  const isSmtp = editing === EmailProvider.SMTP;
  const onServerStep = isSmtp && stepper.current.id === 'server';

  const fields = getEmailFields(isSmtp, onServerStep, t);
  const schema = getEmailSchema(isSmtp, onServerStep);
  const formActions = getEmailFormActions({
    isSmtp,
    isFirstStep: stepper.isFirst,
    onServerStep,
    onCancel,
    onPrev: () => stepper.prev(),
    t,
  });

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (onServerStep) {
      setPending((prev) => ({ ...prev, ...formData }));
      stepper.next();
      return;
    }

    const payload = isSmtp ? { ...pending, ...formData } : formData;
    const result = await saveEmailConfiguration({ provider: editing, ...payload } as never);
    if (!result.success) throw new Error(result.message);
    await onSaved();
    return result;
  };

  return (
    <>
      {isSmtp && <SmtpStepperHeader stepper={stepper} steps={smtpSteps} />}

      <FormBuilder
        key={isSmtp ? stepper.current.id : undefined}
        mode="edit"
        schema={schema}
        fields={fields}
        values={getInitialEmailValues(values, pending)}
        onSubmit={handleSubmit}
        showToast={!onServerStep}
        submitLabel={formActions.submitLabel}
        cancelLabel={formActions.cancelLabel}
        onCancel={formActions.handleCancel}
      />
    </>
  );
}

/** Abre o editor de templates: abas por email, HTML à esquerda e preview à direita. */
function EmailTemplatesButton() {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <p className="font-medium mb-1">{t('system_email_templates')}</p>
      <p className="text-sm text-muted-foreground mb-2">{t('system_email_templates_desc')}</p>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t('system_email_templates_configure')}
      </Button>
      <EmailTemplatesDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface EmailProviderDescriptor {
  icon: ReactNode;
  descriptionKey: string;
  /** Chaves que precisam estar preenchidas para o provider contar como configurado. */
  requiredKeys: string[];
}

/** Provider fora do mapa cai no descritor padrão — nada além deste mapa precisa mudar. */
const DEFAULT_EMAIL_DESCRIPTOR: EmailProviderDescriptor = {
  icon: <Mail className="size-5" />,
  descriptionKey: 'system_email_provider_desc',
  requiredKeys: ['SYSTEM_EMAIL_DEFAULT_FROM'],
};

const EMAIL_PROVIDER_DESCRIPTORS: Record<string, EmailProviderDescriptor> = {
  [EmailProvider.SMTP]: {
    icon: <Server className="size-5" />,
    descriptionKey: 'system_email_smtp_desc',
    requiredKeys: ['SYSTEM_EMAIL_SMTP_HOST', 'SYSTEM_EMAIL_SMTP_PORT', 'SYSTEM_EMAIL_DEFAULT_FROM'],
  },
  [EmailProvider.RESEND]: {
    icon: <Mail className="size-5" />,
    descriptionKey: 'system_email_resend_desc',
    // DEFAULT_FROM é compartilhado entre providers; só a API key distingue o Resend.
    requiredKeys: ['SYSTEM_EMAIL_PROVIDER_API_KEY', 'SYSTEM_EMAIL_DEFAULT_FROM'],
  },
};

function getEmailProviders(
  options: string[],
  active: string,
  values: Record<string, unknown>,
  isEmailOperational: boolean,
  t: ReturnType<typeof useTranslation>['t']
): ProviderCardItem[] {
  return options.map((option) => {
    const descriptor = EMAIL_PROVIDER_DESCRIPTORS[option] ?? DEFAULT_EMAIL_DESCRIPTOR;
    const isConfigured = descriptor.requiredKeys.length > 0 && descriptor.requiredKeys.every((key) => isConfigValuePresent(values[key]));
    const isSelected = option === active;
    const isActive = isSelected && isConfigured && isEmailOperational;

    return {
      id: option,
      name: t(option),
      description: t(descriptor.descriptionKey),
      icon: descriptor.icon,
      isActive,
      isConfigured,
      canActivate: isConfigured && !isActive,
    };
  });
}

export function EmailConfig() {
  const { t } = useTranslation('settings');
  const { data } = useConfiguration<string>('SYSTEM_EMAIL_PROVIDER');
  const { values } = useConfigurationValues(HYDRATE_KEYS);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const emailCap = useCapability(CAPABILITIES.email);
  const isEmailOperational = emailCap.operational;
  const { activate, isPending: isActivating, isBlocked } = useActivateProvider(
    'SYSTEM_EMAIL_PROVIDER',
    [['email', 'health']],
  );

  const active = (data?.value as string) ?? EmailProvider.RESEND;

  const handleActivate = async (providerId: string) => {
    const target = providers.find((p) => p.id === providerId);
    if (!target?.canActivate || !target?.isConfigured) return;
    await activate(providerId);
  };

  const handleSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['email', 'health'] });
    // Credencial de email muda o que EMAIL_CAPABILITY resolve (checkHealth).
    await queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });
    setEditing(null);
  };

  const providers = getEmailProviders(data?.options ?? [], active, values, isEmailOperational, t);

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="font-medium mb-1">{t('system_email_provider')}</p>
        <p className="text-sm text-muted-foreground">{t('system_email_provider_desc')}</p>
      </div>

      <ProviderCardGrid
        providers={providers}
        onActivate={handleActivate}
        onConfigure={(id) => setEditing(id)}
        configureLabel={t('provider_configure')}
        activeLabel={t('provider_active')}
        activateLabel={t('provider_activate')}
        configuredLabel={t('provider_configured')}
        notConfiguredLabel={t('provider_not_configured')}
        disabled={isActivating || isBlocked}
        columns={2}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing && t(editing)}</DialogTitle>
          </DialogHeader>

          {editing && (
            <EmailEditForm
              // Remonta ao trocar de provider ou reabrir o dialog — zera stepper e
              // pending sem precisar de useEffect.
              key={editing}
              editing={editing}
              values={values}
              t={t}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <EmailTemplatesButton />
    </Container>
  );
}
