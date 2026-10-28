'use client';

import { Fragment, useState, useEffect, type ReactNode } from "react";
import { HelpButton, useTour, ignoreTourInteraction, type TourStep } from "@/components/tour";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, HardDrive } from "lucide-react";
import { Container } from "@/components/container";
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
import { StorageProvider } from "@/lib/actions/systemConfiguration/types";
import { type ProviderCardItem, ProviderCardGrid } from "@/components/provider-card-grid";
import { saveStorageConfiguration } from "@/lib/actions/storage/api";
import { useStorageHealth } from "@/lib/actions/user/queries";
import { useTranslation } from "@/hooks/use-translation";
import { useActivateProvider } from "@/hooks/use-activate-provider";


const S3_TOUR_FIELDS = {
  connection: ['endpoint', 'region', 'bucket', 'publicUrl'],
  credentials: ['accessKey', 'secretKey'],
} as const;

const s3FieldId = (name: string) => `storage-s3-field-${name}`;
const s3TourId = (step: 'connection' | 'credentials') => `storage-s3-${step}`;

function useS3StorageTour(isS3: boolean, registerTour: (id: string, steps: TourStep[]) => void, t: ReturnType<typeof useTranslation>['t']) {
  useEffect(() => {
    if (!isS3) return;
    for (const stepId of ['connection', 'credentials'] as const) {
      const tourSteps: TourStep[] = S3_TOUR_FIELDS[stepId].map((name) => ({
        content: (
          <div className="grid gap-1 pr-6">
            <p className="text-sm font-medium">{t(`system_storage_tour_${name}_title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`system_storage_tour_${name}`)}</p>
          </div>
        ),
        selectorId: s3FieldId(name),
        position: 'right',
      }));
      registerTour(s3TourId(stepId), tourSteps);
    }
  }, [isS3, registerTour, t]);
}

/** Um botão por provider de storage, com formulário (ou stepper para S3) para editar credenciais. */

const localSchema = z.object({ dir: z.string().min(1), baseUrl: z.string().url() });

const s3ConnectionSchema = z.object({
  endpoint: z.string().url(),
  region: z.string().min(1),
  bucket: z.string().min(1),
  publicUrl: z.string().url(),
});

const s3CredentialsSchema = z.object({
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
});

/** Chaves lidas para hidratar — segredos ficam de fora de propósito. */
const HYDRATE_KEYS = [
  'SYSTEM_STORAGE_S3_ENDPOINT',
  'SYSTEM_STORAGE_S3_REGION',
  'SYSTEM_STORAGE_S3_BUCKET',
  'SYSTEM_STORAGE_S3_PUBLIC_URL',
  'SYSTEM_STORAGE_S3_ACCESS_KEY',
  'SYSTEM_STORAGE_S3_SECRET_KEY',
  'SYSTEM_STORAGE_LOCAL_DIR',
  'SYSTEM_STORAGE_PUBLIC_BASE_URL',
];

function getStorageFields(isLocal: boolean, onConnectionStep: boolean, t: ReturnType<typeof useTranslation>['t']): FormBuilderField[] {
  if (isLocal) {
    return [
      { name: 'dir', label: t('system_storage_local_dir'), description: t('system_storage_local_dir_desc') },
      { name: 'baseUrl', label: t('system_storage_public_base_url'), description: t('system_storage_public_base_url_desc') },
    ];
  }
  if (onConnectionStep) {
    return [
      { name: 'endpoint', label: t('system_storage_s3_endpoint'), description: t('system_storage_s3_endpoint_desc') },
      { name: 'region', label: t('system_storage_s3_region'), description: t('system_storage_s3_region_desc') },
      { name: 'bucket', label: t('system_storage_s3_bucket'), description: t('system_storage_s3_bucket_desc') },
      { name: 'publicUrl', label: t('system_storage_s3_public_url'), description: t('system_storage_s3_public_url_desc') },
    ];
  }
  return [
    { name: 'accessKey', label: t('system_storage_s3_access_key'), description: t('secret_keep_blank'), type: 'password', placeholder: '••••••••' },
    { name: 'secretKey', label: t('system_storage_s3_secret_key'), description: t('secret_keep_blank'), type: 'password', placeholder: '••••••••' },
  ];
}

function getStorageSchema(isLocal: boolean, onConnectionStep: boolean) {
  if (isLocal) return localSchema;
  return onConnectionStep ? s3ConnectionSchema : s3CredentialsSchema;
}

function S3StepperHeader({
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

function getInitialStorageValues(values: Record<string, unknown>, pending: Record<string, unknown>) {
  return {
    endpoint: (values.SYSTEM_STORAGE_S3_ENDPOINT as string) ?? '',
    region: (values.SYSTEM_STORAGE_S3_REGION as string) ?? '',
    bucket: (values.SYSTEM_STORAGE_S3_BUCKET as string) ?? '',
    publicUrl: (values.SYSTEM_STORAGE_S3_PUBLIC_URL as string) ?? '',
    dir: (values.SYSTEM_STORAGE_LOCAL_DIR as string) ?? '',
    baseUrl: (values.SYSTEM_STORAGE_PUBLIC_BASE_URL as string) ?? '',
    ...pending,
  };
}

function getStorageFormActions({
  isS3,
  isFirstStep,
  onConnectionStep,
  t,
  onCancel,
  onPrev,
}: {
  isS3: boolean;
  isFirstStep: boolean;
  onConnectionStep: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  onCancel: () => void;
  onPrev: () => void;
}) {
  const canGoBack = isS3 && !isFirstStep;
  return {
    submitLabel: onConnectionStep ? t('stepper_next') : t('save_configuration'),
    cancelLabel: canGoBack ? t('stepper_back') : undefined,
    handleCancel: canGoBack ? onPrev : onCancel,
  };
}

function StorageEditForm({
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

  const s3Steps = [
    { id: 'connection', title: t('system_storage_step_connection'), description: t('system_storage_step_connection_desc') },
    { id: 'credentials', title: t('system_storage_step_credentials'), description: t('system_storage_step_credentials_desc') },
  ];
  const stepper = useStepper(s3Steps);

  const { registerTour } = useTour();
  const isLocal = editing === StorageProvider.LOCAL;
  const isS3 = editing === StorageProvider.S3;
  useS3StorageTour(isS3, registerTour, t);
  const onConnectionStep = isS3 && stepper.current.id === 'connection';

  const fields = getStorageFields(isLocal, onConnectionStep, t);
  const schema = getStorageSchema(isLocal, onConnectionStep);
  const formActions = getStorageFormActions({
    isS3,
    isFirstStep: stepper.isFirst,
    onConnectionStep,
    t,
    onCancel,
    onPrev: () => stepper.prev(),
  });

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (onConnectionStep) {
      setPending((prev) => ({ ...prev, ...formData }));
      stepper.next();
      return;
    }

    const payload = isS3 ? { ...pending, ...formData } : formData;
    const result = await saveStorageConfiguration({ provider: editing, ...payload } as never);
    if (!result.success) throw new Error(result.message);
    await onSaved();
    return result;
  };

  return (
    <>
      {isS3 && <S3StepperHeader stepper={stepper} steps={s3Steps} />}
      {isS3 && (
        <div className="mb-2 flex items-center justify-end gap-1 text-sm text-muted-foreground">
          {t('system_storage_tour_hint')}
          <HelpButton tourId={s3TourId(stepper.current.id as 'connection' | 'credentials')} startDirect />
        </div>
      )}

      <FormBuilder
        key={isS3 ? stepper.current.id : undefined}
        mode="edit"
        schema={schema}
        fields={fields}
        values={getInitialStorageValues(values, pending)}
        onSubmit={handleSubmit}
        showToast={!onConnectionStep}
        submitLabel={formActions.submitLabel}
        cancelLabel={formActions.cancelLabel}
        onCancel={formActions.handleCancel}
      />
    </>
  );
}

interface StorageProviderDescriptor {
  icon: ReactNode;
  descriptionKey: string;
  /** Chaves que precisam estar preenchidas para o provider contar como configurado. */
  requiredKeys: string[];
}

/** Provider fora do mapa cai no descritor padrão — nada além deste mapa precisa mudar. */
const DEFAULT_STORAGE_DESCRIPTOR: StorageProviderDescriptor = {
  icon: <HardDrive className="size-5" />,
  descriptionKey: 'system_storage_provider_desc',
  requiredKeys: [],
};

const STORAGE_PROVIDER_DESCRIPTORS: Record<string, StorageProviderDescriptor> = {
  [StorageProvider.S3]: {
    icon: <Cloud className="size-5" />,
    descriptionKey: 'system_storage_s3_desc',
    requiredKeys: [
      'SYSTEM_STORAGE_S3_BUCKET',
      'SYSTEM_STORAGE_S3_ENDPOINT',
      'SYSTEM_STORAGE_S3_ACCESS_KEY',
      'SYSTEM_STORAGE_S3_SECRET_KEY',
    ],
  },
  [StorageProvider.LOCAL]: {
    icon: <HardDrive className="size-5" />,
    descriptionKey: 'system_storage_local_desc',
    requiredKeys: ['SYSTEM_STORAGE_LOCAL_DIR', 'SYSTEM_STORAGE_PUBLIC_BASE_URL'],
  },
};

function getStorageProviders(
  options: string[],
  active: string,
  values: Record<string, unknown>,
  isStorageOperational: boolean,
  t: ReturnType<typeof useTranslation>['t']
): ProviderCardItem[] {
  return options.map((option) => {
    const descriptor = STORAGE_PROVIDER_DESCRIPTORS[option] ?? DEFAULT_STORAGE_DESCRIPTOR;
    const isConfigured = descriptor.requiredKeys.length > 0 && descriptor.requiredKeys.every((key) => isConfigValuePresent(values[key]));
    const isSelected = option === active;
    const isActive = isSelected && isConfigured && isStorageOperational;

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

export function StorageConfig() {
  const { t } = useTranslation('settings');
  const { data } = useConfiguration<string>('SYSTEM_STORAGE_PROVIDER');
  const { values } = useConfigurationValues(HYDRATE_KEYS);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  // A própria aba usa a saúde do provider direto, não a capability STORAGE (que existe só
  // pra outros módulos, como CMS, resolverem contra ela).
  const { data: storageHealth } = useStorageHealth();
  const isStorageOperational = storageHealth?.operational === true;
  const { activate, isPending: isActivating, isBlocked } = useActivateProvider(
    'SYSTEM_STORAGE_PROVIDER',
    [['storage', 'health']],
  );

  const active = (data?.value as string) ?? StorageProvider.S3;

  const handleActivate = async (providerId: string) => {
    const target = providers.find((p) => p.id === providerId);
    if (!target?.canActivate || !target?.isConfigured) return;
    await activate(providerId);
  };

  const handleSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['storage', 'health'] });
    setEditing(null);
  };

  const providers = getStorageProviders(data?.options ?? [], active, values, isStorageOperational, t);

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="font-medium mb-1">{t('system_storage_provider')}</p>
        <p className="text-sm text-muted-foreground">{t('system_storage_provider_desc')}</p>
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
        <DialogContent onInteractOutside={ignoreTourInteraction}>
          <DialogHeader>
            <DialogTitle>{editing && t(editing)}</DialogTitle>
          </DialogHeader>

          {editing && (
            <StorageEditForm
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
    </Container>
  );
}
