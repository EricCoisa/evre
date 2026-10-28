'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Globe, History, MessageSquare, Plus, QrCode, RotateCcw, Settings, Star, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Container } from '@/components/container';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/cn';
import { ProviderCardGrid, type ProviderCardItem } from '@/components/provider-card-grid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
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
} from '@/components/ui/stepper';
import {
  useConfiguration,
  useUpdateConfiguration,
} from '@/lib/actions/systemConfiguration/queries';
import {
  archiveMessagingConnection,
  createMessagingConnection,
  restoreMessagingConnection,
  setDefaultMessagingConnection,
  updateMessagingConnection,
} from '@/lib/actions/messaging/api';
import { Badge } from '@/components/ui/badge';
import {
  useMessagingConnections,
  useMessagingArchivedConnections,
} from '@/lib/actions/messaging/queries';
import type { MessagingConnection } from '@/lib/actions/messaging/types';
import { MessagingConnectionDtoProvider } from '@/lib/generated/schemas';
import { HelpButton, ignoreTourInteraction, useTour, type TourStep } from '@/components/tour';
import { useTranslation, type TFunc } from '@/hooks/use-translation';
import { MessagingSessionCard } from './messaging-session';
import { MessagingIgnoreList } from './messaging-ignore-list';

/** Um card por provider de WhatsApp, com stepper para configurar e parear. */

/** Vem do enum do backend: provider novo aparece aqui sem editar o front. */
const PROVIDERS = Object.values(MessagingConnectionDtoProvider);
type Provider = (typeof PROVIDERS)[number];

const evolutionApiSchemas = {
  server: z.object({ baseUrl: z.string().url() }),
  credentials: z.object({
    token: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
};

const evolutionGoSchemas = {
  server: z.object({ baseUrl: z.string().url() }),
  credentials: z.object({ token: z.string().optional() }),
};

type TFn = ReturnType<typeof useTranslation>['t'];

/** Mensagens em linguagem de gente: o padrão do Zod ("deve corresponder ao padrão /^\d+$/") não ajuda. */
const metaSchemas = (t: TFn) => ({
  server: z.object({
    phoneNumberId: z
      .string()
      .min(1, t('system_messaging_phone_number_id_required'))
      .regex(/^\d+$/, t('system_messaging_phone_number_id_invalid')),
    graphVersion: z
      .string()
      .regex(/^v\d+\.\d+$/, t('system_messaging_graph_version_invalid')),
    appId: z
      .string()
      .regex(/^\d*$/, t('system_messaging_app_id_invalid'))
      .optional(),
    // Exigido para submeter/editar templates na WABA e para registrar o webhook automaticamente.
    wabaId: z
      .string()
      .min(1, t('system_messaging_waba_id_required'))
      .regex(/^\d+$/, t('system_messaging_waba_id_invalid')),
  }),
  credentials: z.object({
    accessToken: z.string().optional(),
    appSecret: z.string().optional(),
    verifyToken: z.string().optional(),
  }),
});

/** Campos da Meta que o tour aponta, por passo do stepper. Id = âncora no wrapper do campo. */
const META_TOUR_FIELDS = {
  server: ['phoneNumberId', 'graphVersion', 'appId', 'wabaId'],
  credentials: ['accessToken', 'appSecret', 'verifyToken'],
} as const;
const metaFieldId = (name: string) => `meta-field-${name}`;
const metaTourId = (step: 'server' | 'credentials') => `meta-${step}`;

const SECRET = { type: 'password' as const, placeholder: '••••••••' };

/** Só a Meta dispensa pareamento: lá o número já é verificado na conta Business. */
const pairs = (provider: Provider) =>
  provider !== MessagingConnectionDtoProvider.META;

/** Valor do formulário a partir da conexão (config sem segredos); segredos ficam sempre em branco. */
function initialValues(
  connection: MessagingConnection | undefined,
): Record<string, unknown> {
  const config = (connection?.config ?? {}) as Record<string, string | undefined>;
  return {
    baseUrl: config.baseUrl ?? '',
    instance: config.instance ?? '',
    phoneNumberId: config.phoneNumberId ?? '',
    graphVersion: config.graphVersion ?? 'v21.0',
    appId: config.appId ?? '',
    wabaId: config.wabaId ?? '',
  };
}

function fieldsOf(
  provider: Provider,
  step: 'server' | 'credentials',
  t: TFn,
): FormBuilderField[] {
  const secret = (name: string, label: string): FormBuilderField => ({
    name,
    label,
    description: t('secret_keep_blank'),
    ...SECRET,
  });

  if (provider === MessagingConnectionDtoProvider.EVOLUTION_API) {
    return step === 'server'
      ? [{ name: 'baseUrl', label: t('system_messaging_base_url') }]
      : [
          secret('token', t('system_messaging_token')),
          secret('webhookSecret', t('system_messaging_webhook_secret')),
        ];
  }

  if (provider === MessagingConnectionDtoProvider.EVOLUTION_GO) {
    return step === 'server'
      ? [{ name: 'baseUrl', label: t('system_messaging_base_url') }]
      : [secret('token', t('system_messaging_token'))];
  }

  return step === 'server'
    ? [
        { name: 'phoneNumberId', label: t('system_messaging_phone_number_id'), id: metaFieldId('phoneNumberId') },
        { name: 'graphVersion', label: t('system_messaging_graph_version'), id: metaFieldId('graphVersion') },
        { name: 'appId', label: t('system_messaging_app_id'), id: metaFieldId('appId') },
        { name: 'wabaId', label: t('system_messaging_waba_id'), id: metaFieldId('wabaId') },
      ]
    : [
        { ...secret('accessToken', t('system_messaging_access_token')), id: metaFieldId('accessToken') },
        { ...secret('appSecret', t('system_messaging_app_secret')), id: metaFieldId('appSecret') },
        { ...secret('verifyToken', t('system_messaging_verify_token')), id: metaFieldId('verifyToken') },
      ];
}

function schemasOf(provider: Provider, t: TFn) {
  if (provider === MessagingConnectionDtoProvider.EVOLUTION_API) {
    return evolutionApiSchemas;
  }
  if (provider === MessagingConnectionDtoProvider.EVOLUTION_GO) {
    return evolutionGoSchemas;
  }
  return metaSchemas(t);
}

async function persistMessagingConnection({
  isRestore,
  connection,
  saved,
  provider,
  payload,
}: {
  isRestore?: boolean;
  connection?: MessagingConnection;
  saved?: MessagingConnection;
  provider: Provider;
  payload: Record<string, unknown>;
}) {
  if (isRestore && connection) {
    return restoreMessagingConnection(connection.id, payload as never);
  }
  const targetId = saved?.id ?? connection?.id;
  if (targetId) {
    return updateMessagingConnection(targetId, payload as never);
  }
  return createMessagingConnection({ provider, ...payload } as never);
}

function MessagingPairStep({
  saved,
  onCancel,
  t,
}: {
  saved: MessagingConnection;
  onCancel: () => void;
  t: TFn;
}) {
  return (
    <>
      <MessagingSessionCard
        connectionId={saved.id}
        phone={saved.phone}
        onConnected={() => {
          setTimeout(onCancel, 1200);
        }}
      />
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={onCancel}>
          {t('finish', { defaultValue: 'Concluir' })}
        </Button>
      </div>
    </>
  );
}

interface StepItem {
  id: 'server' | 'credentials' | 'pair';
  title: string;
  description: string;
}

function MessagingStepperHeader({
  steps,
  index,
}: {
  steps: StepItem[];
  index: number;
}) {
  return (
    <Stepper index={index}>
      <StepperList>
        {steps.map((item, i) => (
          <Fragment key={item.id}>
            <StepperItem step={i}>
              <StepperTrigger step={i}>
                <StepperIndicator step={i} />
                <div>
                  <StepperTitle>{item.title}</StepperTitle>
                  <StepperDescription>{item.description}</StepperDescription>
                </div>
              </StepperTrigger>
            </StepperItem>
            {i < steps.length - 1 && <StepperSeparator step={i} />}
          </Fragment>
        ))}
      </StepperList>

      {steps.map((item, i) => (
        <StepperContent key={item.id} step={i} />
      ))}
    </Stepper>
  );
}

function MessagingTourHint({
  step,
  t,
}: {
  step: 'server' | 'credentials';
  t: TFunc;
}) {
  return (
    <div className="mb-2 flex items-center justify-end gap-1 text-sm text-muted-foreground">
      {t('system_messaging_tour_hint')}
      <HelpButton tourId={metaTourId(step)} startDirect />
    </div>
  );
}

function buildMessagingSteps(provider: Provider, t: TFunc): StepItem[] {
  return [
    {
      id: 'server',
      title: t('system_messaging_step_server'),
      description: t('system_messaging_step_server_desc'),
    },
    {
      id: 'credentials',
      title: t('system_messaging_step_credentials'),
      description: t('system_messaging_step_credentials_desc'),
    },
    ...(pairs(provider)
      ? [
          {
            id: 'pair' as const,
            title: t('system_messaging_step_pair'),
            description: t('system_messaging_step_pair_desc'),
          },
        ]
      : []),
  ];
}

function useMetaTour(isMeta: boolean, registerTour: (id: string, steps: TourStep[]) => void, t: TFunc) {
  useEffect(() => {
    if (!isMeta) return;
    for (const stepId of ['server', 'credentials'] as const) {
      const tourSteps: TourStep[] = META_TOUR_FIELDS[stepId].map((name) => ({
        content: (
          <div className="grid gap-1 pr-10">
            <p className="text-sm font-medium">{t(`system_messaging_tour_${name}_title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`system_messaging_tour_${name}`)}</p>
          </div>
        ),
        selectorId: metaFieldId(name),
        position: 'right',
      }));
      registerTour(metaTourId(stepId), tourSteps);
    }
  }, [isMeta, registerTour, t]);
}

async function executeMessagingSubmit({
  isRestore,
  connection,
  saved,
  provider,
  payload,
  t,
  onSaved,
  onCancel,
  nextStep,
}: {
  isRestore?: boolean;
  connection: MessagingConnection | undefined;
  saved: MessagingConnection | undefined;
  provider: Provider;
  payload: Record<string, unknown>;
  t: TFunc;
  onSaved: () => Promise<void>;
  onCancel: () => void;
  nextStep: () => void;
}) {
  const result = await persistMessagingConnection({
    isRestore,
    connection,
    saved,
    provider,
    payload,
  });
  if (!result.success) throw new Error(result.message);

  if (isRestore) {
    toast.success(t('messaging_connection_restore_success'));
  }

  await onSaved();
  if (pairs(provider)) {
    nextStep();
  } else {
    onCancel();
  }
  return result;
}

function MessagingFormBuilderStep({
  step,
  provider,
  saved,
  connection,
  pending,
  handleSubmit,
  isFirst,
  onPrev,
  onCancel,
  t,
}: {
  step: 'server' | 'credentials';
  provider: Provider;
  saved: MessagingConnection | undefined;
  connection: MessagingConnection | undefined;
  pending: Record<string, unknown>;
  handleSubmit: (formData: Record<string, unknown>) => Promise<unknown>;
  isFirst: boolean;
  onPrev: () => void;
  onCancel: () => void;
  t: TFunc;
}) {
  return (
    <FormBuilder
      key={step}
      mode="edit"
      schema={schemasOf(provider, t)[step]}
      fields={fieldsOf(provider, step, t)}
      values={{
        ...initialValues(saved ?? connection),
        ...pending,
      }}
      onSubmit={handleSubmit}
      showToast={step !== 'server'}
      submitLabel={
        step === 'server' ? t('stepper_next') : t('save_configuration')
      }
      cancelLabel={!isFirst ? t('stepper_back') : undefined}
      onCancel={!isFirst ? onPrev : onCancel}
    />
  );
}

/** Configuração em passos: servidor → credenciais → pareamento (só depois de gravar, com o id da conexão). */
function MessagingEditForm({
  provider,
  connection,
  isRestore,
  t,
  onSaved,
  onCancel,
}: {
  provider: Provider;
  connection: MessagingConnection | undefined;
  isRestore?: boolean;
  t: TFn;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState<MessagingConnection | undefined>(connection);

  const steps = useMemo(() => buildMessagingSteps(provider, t), [provider, t]);
  const stepper = useStepper(steps);
  const step = stepper.current.id;
  const { registerTour } = useTour();
  const isMeta = provider === MessagingConnectionDtoProvider.META;

  useMetaTour(isMeta, registerTour, t);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (step === 'server') {
      setPending((prev) => ({ ...prev, ...formData }));
      stepper.next();
      return;
    }

    const payload = { ...pending, ...formData };
    const result = await executeMessagingSubmit({
      isRestore,
      connection,
      saved,
      provider,
      payload,
      t,
      onSaved,
      onCancel,
      nextStep: () => stepper.next(),
    });

    setSaved(result.data?.connection);
    return result;
  };

  return (
    <>
      <MessagingStepperHeader steps={steps} index={stepper.index} />

      {isMeta && (step === 'server' || step === 'credentials') && (
        <MessagingTourHint step={step} t={t} />
      )}

      {step === 'pair' && saved ? (
        <MessagingPairStep saved={saved} onCancel={onCancel} t={t} />
      ) : (
        <MessagingFormBuilderStep
          step={step === 'server' ? 'server' : 'credentials'}
          provider={provider}
          saved={saved}
          connection={connection}
          pending={pending}
          handleSubmit={handleSubmit}
          isFirst={stepper.isFirst}
          onPrev={() => stepper.prev()}
          onCancel={onCancel}
          t={t}
        />
      )}
    </>
  );
}

function ArchivedConnectionsDialog({
  open,
  onOpenChange,
  provider,
  archivedConnections,
  onRestoreDirect,
  onRestoreWithEdit,
  onCreateNew,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  archivedConnections: MessagingConnection[];
  onRestoreDirect: (conn: MessagingConnection) => Promise<void>;
  onRestoreWithEdit: (conn: MessagingConnection) => void;
  onCreateNew: () => void;
  t: TFn;
}) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messaging_connection_choose_action_title')}</DialogTitle>
          <DialogDescription>
            {t('messaging_connection_choose_action_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('messaging_connection_archived_list_title')}
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {archivedConnections.map((conn) => {
              const dateFormatted = conn.updatedAt
                ? new Date(conn.updatedAt).toLocaleDateString()
                : '';
              const isBusy = restoringId === conn.id;

              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-mono text-sm font-semibold truncate">
                      {conn.phone || t('messaging_connection_no_number')}
                    </p>
                    {dateFormatted && (
                      <p className="text-xs text-muted-foreground">
                        {t('messaging_connection_archived_at', { date: dateFormatted })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRestoreWithEdit(conn)}
                      title={t('messaging_connection_edit')}
                    >
                      {t('messaging_connection_edit')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      disabled={isBusy}
                      onClick={async () => {
                        setRestoringId(conn.id);
                        try {
                          await onRestoreDirect(conn);
                        } finally {
                          setRestoringId(null);
                        }
                      }}
                    >
                      <RotateCcw className="mr-1.5 size-3.5" />
                      {t('messaging_connection_restore_button')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCreateNew}
          >
            <Plus className="mr-1.5 size-4" />
            {t('messaging_connection_action_create_new')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {t('close', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getMessagingProviderIcon(provider: Provider) {
  if (provider === MessagingConnectionDtoProvider.EVOLUTION_GO) {
    return <Zap className="size-5" />;
  }
  if (provider === MessagingConnectionDtoProvider.META) {
    return <Globe className="size-5" />;
  }
  return <MessageSquare className="size-5" />;
}

function resolveProviderDescription({
  connection,
  archivedCount,
  t,
}: {
  connection?: MessagingConnection;
  archivedCount: number;
  t: TFn;
}) {
  if (connection) {
    return connection.phone
      ? `${t('messaging_connection_number')}: ${connection.phone}`
      : t('messaging_connection_no_number');
  }
  if (archivedCount > 0) {
    return `${archivedCount} ${t('messaging_connection_has_archived').toLowerCase()}`;
  }
  return t('messaging_connection_none');
}

function ProviderCardRightSlot({
  connection,
  archivedCount,
  onArchive,
  onOpenArchived,
  t,
}: {
  connection?: MessagingConnection;
  archivedCount: number;
  onArchive: () => void;
  onOpenArchived: () => void;
  t: TFn;
}) {
  if (connection) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        title={t('messaging_connection_archive_hint')}
        aria-label={t('messaging_connection_archive')}
      >
        <Archive className="size-3.5" />
      </Button>
    );
  }

  if (archivedCount > 0) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer gap-1 font-normal text-muted-foreground hover:bg-muted"
        onClick={(e) => {
          e.stopPropagation();
          onOpenArchived();
        }}
        title={t('messaging_connection_archived_list_title')}
      >
        <History className="size-3" />
        {archivedCount}
      </Badge>
    );
  }

  return null;
}

function MessagingCardActions({
  connection,
  canPair,
  onOpenPairing,
  onToggleDefault,
  onConfigure,
  t,
}: {
  connection?: MessagingConnection;
  canPair: boolean;
  onOpenPairing: () => void;
  onToggleDefault: () => void;
  onConfigure: () => void;
  t: TFn;
}) {
  const isDefault = Boolean(connection?.isDefault);
  const canSetDefault = Boolean(connection && !isDefault);
  const hasExtraButtons = Boolean(canPair && connection) || canSetDefault;

  return (
    <div className="flex items-center gap-2 w-full">
      {canPair && connection && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenPairing}
          className="h-8 text-xs gap-1.5 flex-1"
          title={t('messaging_session_qrcode_title')}
        >
          <QrCode className="size-3.5" />
          {t('messaging_session_qrcode_button')}
        </Button>
      )}

      {canSetDefault && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onToggleDefault}
          className="h-8 text-xs gap-1.5 flex-1"
          title={t('messaging_connection_make_default')}
        >
          <Star className="size-3.5" />
          {t('messaging_connection_make_default')}
        </Button>
      )}

      <Button
        type="button"
        size="sm"
        variant={isDefault ? 'default' : 'secondary'}
        onClick={onConfigure}
        className={cn(
          'h-8 text-xs gap-1.5',
          !hasExtraButtons ? 'w-full' : 'flex-1'
        )}
      >
        <Settings className="size-3.5" />
        {t('provider_configure')}
      </Button>
    </div>
  );
}

function MessagingPairingDialog({
  open,
  onOpenChange,
  connection,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: MessagingConnection | null;
  t: TFn;
}) {
  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            {t(connection.provider)}
          </DialogTitle>
          <DialogDescription>
            {t('messaging_session_qrcode_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <MessagingSessionCard
            connectionId={connection.id}
            phone={connection.phone}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Override de dev para o túnel alcançar o provider; global, por isso fora do formulário de cada conexão. */
const SHOW_WEBHOOK_OVERRIDE = process.env.NODE_ENV !== 'production';

function WebhookOverride({
  t,
}: {
  t: TFn;
}) {
  const { data } = useConfiguration<string>(
    'SYSTEM_MESSAGING_WEBHOOK_PUBLIC_URL',
  );
  const update = useUpdateConfiguration<string>();

  return (
    <div className="mt-4 rounded-lg border border-dashed p-4">
      <FormBuilder
        mode="edit"
        schema={z.object({
          webhookPublicUrl: z.string().url().or(z.literal('')).optional(),
        })}
        fields={[
          {
            name: 'webhookPublicUrl',
            label: t('system_messaging_webhook_public_url'),
            description: t('system_messaging_webhook_public_url_desc'),
          },
        ]}
        values={{ webhookPublicUrl: data?.value ?? '' }}
        onSubmit={async (formData) => {
          if (!data) return;
          await update.mutateAsync({
            systemConfiguration: {
              ...data,
              value: (formData.webhookPublicUrl as string) ?? '',
            },
          });
        }}
        submitLabel={t('save_configuration')}
      />
    </div>
  );
}

export function MessagingConfig() {
  const { t } = useTranslation('settings');
  const { data: connections = [] } = useMessagingConnections();
  const { data: archivedConnections = [] } = useMessagingArchivedConnections();
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<{
    provider: Provider;
    connection?: MessagingConnection;
    isRestore?: boolean;
  } | null>(null);
  const [archivedDialogProvider, setArchivedDialogProvider] = useState<Provider | null>(null);
  const [archiving, setArchiving] = useState<Provider | null>(null);
  const [pairingConn, setPairingConn] = useState<MessagingConnection | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['system-configuration'] });
    await queryClient.invalidateQueries({ queryKey: ['messaging'] });
    // Criar/editar/arquivar conexão muda o que MESSAGING resolve (checkAnyOperational).
    await queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });
  };

  const handleSaved = async () => {
    await invalidate();
  };

  const connectionOf = (provider: Provider) =>
    connections.find((item) => item.provider === provider);

  const archivedOf = (provider: Provider) =>
    archivedConnections.filter((item) => item.provider === provider);

  const act = (
    provider: Provider,
    run: (id: string) => Promise<unknown>,
  ) => {
    const found = connectionOf(provider);
    if (!found) return;
    void run(found.id).then(invalidate);
  };

  const handleDirectRestore = async (conn: MessagingConnection) => {
    const res = await restoreMessagingConnection(conn.id);
    if (!res.success) {
      toast.error(res.message);
      // Caso seja inválido, o fluxo do editar entra para o operador atualizar os dados
      setArchivedDialogProvider(null);
      setEditingConfig({
        provider: conn.provider,
        connection: conn,
        isRestore: true,
      });
      return;
    }
    toast.success(t('messaging_connection_restore_success'));
    await invalidate();
    setArchivedDialogProvider(null);
  };

  const handleConfigure = (provider: Provider) => {
    const activeConn = connectionOf(provider);
    const archivedForProvider = archivedOf(provider);

    if (activeConn) {
      setEditingConfig({
        provider,
        connection: activeConn,
        isRestore: false,
      });
      return;
    }

    if (archivedForProvider.length > 0) {
      setArchivedDialogProvider(provider);
      return;
    }

    setEditingConfig({
      provider,
      isRestore: false,
    });
  };

  const providerCards: ProviderCardItem[] = PROVIDERS.map((provider) => {
    const activeConn = connectionOf(provider);
    const archivedForProvider = archivedOf(provider);

    return {
      id: provider,
      name: t(provider),
      description: resolveProviderDescription({
        connection: activeConn,
        archivedCount: archivedForProvider.length,
        t,
      }),
      icon: getMessagingProviderIcon(provider),
      isActive: Boolean(activeConn?.isDefault),
      isConfigured: Boolean(activeConn),
      badge: activeConn?.isDefault ? t('messaging_connection_default') : undefined,
      rightSlot: (
        <ProviderCardRightSlot
          connection={activeConn}
          archivedCount={archivedForProvider.length}
          onArchive={() => setArchiving(provider)}
          onOpenArchived={() => setArchivedDialogProvider(provider)}
          t={t}
        />
      ),
      actionsSlot: (
        <MessagingCardActions
          connection={activeConn}
          canPair={pairs(provider)}
          onOpenPairing={() => activeConn && setPairingConn(activeConn)}
          onToggleDefault={() => act(provider, setDefaultMessagingConnection)}
          onConfigure={() => handleConfigure(provider)}
          t={t}
        />
      ),
    };
  });

  return (
    <Container variant="form" padding>
      <div className="mb-4">
        <p className="mb-1 font-medium">{t('messaging_connections')}</p>
        <p className="text-sm text-muted-foreground">
          {t('messaging_connections_desc')}
        </p>
      </div>

      <ProviderCardGrid
        providers={providerCards}
        onConfigure={(id) => handleConfigure(id as Provider)}
        configureLabel={t('provider_configure')}
        activeLabel={t('messaging_connection_default')}
        configuredLabel={t('provider_configured')}
        notConfiguredLabel={t('provider_not_configured')}
        columns={2}
      />

      <MessagingPairingDialog
        open={!!pairingConn}
        onOpenChange={(open) => !open && setPairingConn(null)}
        connection={pairingConn}
        t={t}
      />

      {SHOW_WEBHOOK_OVERRIDE && (
        <WebhookOverride t={t} />
      )}

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        onConfirm={() => {
          if (archiving) act(archiving, archiveMessagingConnection);
          setArchiving(null);
        }}
        title={t('messaging_connection_archive_confirm_title')}
        description={t('messaging_connection_archive_confirm_description')}
        confirmLabel={t('messaging_connection_archive')}
      />

      {archivedDialogProvider && (
        <ArchivedConnectionsDialog
          open={!!archivedDialogProvider}
          onOpenChange={(open) => !open && setArchivedDialogProvider(null)}
          provider={archivedDialogProvider}
          archivedConnections={archivedOf(archivedDialogProvider)}
          onRestoreDirect={handleDirectRestore}
          onRestoreWithEdit={(conn) => {
            setArchivedDialogProvider(null);
            setEditingConfig({
              provider: archivedDialogProvider,
              connection: conn,
              isRestore: true,
            });
          }}
          onCreateNew={() => {
            const prov = archivedDialogProvider;
            setArchivedDialogProvider(null);
            setEditingConfig({
              provider: prov,
              isRestore: false,
            });
          }}
          t={t}
        />
      )}

      <Dialog
        open={!!editingConfig}
        onOpenChange={(open) => !open && setEditingConfig(null)}
      >
        <DialogContent onInteractOutside={ignoreTourInteraction}>
          <DialogHeader>
            <DialogTitle>
              {editingConfig && t(editingConfig.provider)}
            </DialogTitle>
          </DialogHeader>

          {editingConfig && (
            <MessagingEditForm
              key={`${editingConfig.provider}-${editingConfig.connection?.id ?? 'new'}-${editingConfig.isRestore ? 'restore' : 'edit'}`}
              provider={editingConfig.provider}
              connection={editingConfig.connection}
              isRestore={editingConfig.isRestore}
              t={t}
              onSaved={handleSaved}
              onCancel={() => setEditingConfig(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <MessagingIgnoreList />
    </Container>
  );
}
