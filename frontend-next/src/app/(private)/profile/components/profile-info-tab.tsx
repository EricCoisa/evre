'use client';

import { Container } from "@/components/container";
import { useTranslation, type TFunc } from '@/hooks/use-translation';
import z from "zod";
import { useMemo, useState } from "react";
import { updateProfile } from "@/lib/actions/user/api";
import { toast } from "sonner";
import { useMe } from "@/lib/actions/auth/queries";
import { usePresignedUrl } from "@/lib/actions/storage/queries";
import { useVerificationChannelHealth } from "@/lib/actions/verification/queries";
import { CAPABILITIES, CAPABILITY_FIX_PATH } from "@/types/capabilities";
import { useCapability, useSyncOnCapabilitiesChange } from "@/lib/actions/capability/queries";
import { WarningPopover } from "@/components/warning-popover";
import { useQueryClient } from "@tanstack/react-query";
import { FormBuilder, SubmitCancelledError, type FormBuilderField } from "@/components/form/form-builder";
import { isValidPhone } from "@/components/ui/phone-input";
import { VerificationCodeModal } from "@/components/verification/verification-code-modal";
import { useVerifiedAction } from "@/hooks/use-verified-action";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload } from "@/components/upload";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { Check, MessageSquare, Settings, User as UserIcon } from "lucide-react";

function ProfileAvatarSection({
  user,
  imageUrl,
  onAvatarChange,
}: {
  user: { name?: string | null; email: string };
  imageUrl?: string;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="w-full lg:w-72 shrink-0">
      <Container variant="form" padding>
        <div className="flex flex-col items-center text-center gap-3">
          <Upload accept="image/*" onChange={onAvatarChange}>
            <Avatar className="size-24">
              {imageUrl && <AvatarImage src={imageUrl} alt={user.name ?? ''} />}
              <AvatarFallback>
                <UserIcon className="size-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </Upload>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </Container>
    </div>
  );
}

function PhoneStatusCard({
  phone,
  whatsappUnavailable,
  whatsappReason,
  whatsappFixPath,
  onEditClick,
}: {
  phone?: string | null;
  whatsappUnavailable: boolean;
  whatsappReason?: string;
  whatsappFixPath?: string;
  onEditClick: () => void;
}) {
  const { t } = useTranslation('profile');

  return (
    <Card
      className={cn(
        'relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 rounded-xl p-4 sm:p-5 border-2',
        phone
          ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-xs'
          : 'border-border/60 bg-card hover:border-border',
        whatsappUnavailable && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={cn(
            'size-11 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
            phone
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-border/60 bg-muted/50 text-muted-foreground',
          )}
        >
          <MessageSquare className="size-5" />
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-sm sm:text-base text-foreground">
              {phone ? phone : t('phone_no_number')}
            </h4>
            {phone ? (
              <Badge
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] font-medium py-0"
              >
                <Check className="size-3" />
                {t('phone_configured')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px] py-0">
                {t('phone_not_configured')}
              </Badge>
            )}
            {whatsappUnavailable && (
              <div className="inline-flex items-center gap-1.5">
                <Badge variant="destructive" className="text-[11px] py-0">
                  {t('phone_unavailable')}
                </Badge>
                <WarningPopover reason={whatsappReason} fixPath={whatsappFixPath} />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('phoneDescription')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          variant={phone ? 'outline' : 'default'}
          disabled={whatsappUnavailable}
          onClick={onEditClick}
          className="gap-1.5"
        >
          <Settings className="size-3.5" />
          {phone ? t('updatePhoneButton') : t('addPhoneButton')}
        </Button>
      </div>
    </Card>
  );
}

function PhoneDialog({
  phone,
  phoneFormKey,
  isOpen,
  onOpenChange,
  whatsappUnavailable,
  whatsappReason,
  onSubmit,
}: {
  phone?: string | null;
  phoneFormKey: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappUnavailable: boolean;
  whatsappReason?: string;
  onSubmit: (data: { phone?: string }) => Promise<unknown>;
}) {
  const { t } = useTranslation('profile');

  const phoneSchema = useMemo(() => z.object({
    phone: z.string().optional().refine((v) => !v || isValidPhone(v), { message: t('phoneInvalid') }),
  }), [t]);

  const phoneFields = useMemo<FormBuilderField[]>(() => [
    {
      name: 'phone',
      label: t('phone'),
      type: 'phone',
      placeholder: t('phonePlaceholder'),
      description: whatsappUnavailable ? (whatsappReason || t('phone_verification_unavailable')) : t('phoneDescription'),
      disabled: whatsappUnavailable,
    },
  ], [t, whatsappUnavailable, whatsappReason]);

  const submitLabel = phone ? t('updatePhoneButton') : t('addPhoneButton');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phone ? t('phone_dialog_title_edit') : t('phone_dialog_title_add')}
          </DialogTitle>
          <DialogDescription>
            {t('phone_dialog_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <FormBuilder
            key={phoneFormKey}
            schema={phoneSchema}
            fields={phoneFields}
            mode="edit"
            values={{ phone: phone ?? '' }}
            onSubmit={onSubmit}
            submitLabel={submitLabel}
            cancelLabel={t('common:cancel')}
            actions={{ mode: 'submit+cancel' }}
            onCancel={() => onOpenChange(false)}
            showToast={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhoneSection({
  phone,
  phoneFormKey,
  isDialogOpen,
  onDialogOpenChange,
  whatsappUnavailable,
  whatsappReason,
  whatsappFixPath,
  onSubmit,
}: {
  phone?: string | null;
  phoneFormKey: number;
  isDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  whatsappUnavailable: boolean;
  whatsappReason?: string;
  whatsappFixPath?: string;
  onSubmit: (data: { phone?: string }) => Promise<unknown>;
}) {
  const { t } = useTranslation('profile');

  return (
    <div className="mt-8 pt-6 border-t">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{t('phoneSectionTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('phoneDescription')}</p>
      </div>

      <PhoneStatusCard
        phone={phone}
        whatsappUnavailable={whatsappUnavailable}
        whatsappReason={whatsappReason}
        whatsappFixPath={whatsappFixPath}
        onEditClick={() => onDialogOpenChange(true)}
      />

      <PhoneDialog
        phone={phone}
        phoneFormKey={phoneFormKey}
        isOpen={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        whatsappUnavailable={whatsappUnavailable}
        whatsappReason={whatsappReason}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function usePhoneUpdate(
  user: { id: string; phone?: string | null } | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
  t: TFunc,
) {
  // Telefone é isolado do resto do perfil (ver docs/frontend/service-health-gate.md): um problema
  // de canal WhatsApp (provider fora do ar, template não aprovado) nunca deve travar salvar nome/foto.
  useSyncOnCapabilitiesChange(['verification', 'health', 'WHATSAPP']);
  const messagingCap = useCapability(CAPABILITIES.messaging);
  const { data: whatsappHealth } = useVerificationChannelHealth('WHATSAPP');
  const whatsappUnavailable = messagingCap.disabled || whatsappHealth?.operational === false;
  const whatsappReason = messagingCap.reason || whatsappHealth?.reason;
  // Rota é decisão do front — cobre tanto a capability quanto o health check de verificação
  // (template não aprovado), que não tem mais fixPath nenhum vindo do backend.
  const whatsappFixPath = CAPABILITY_FIX_PATH[CAPABILITIES.messaging];

  const {
    run: runUpdateProfile,
    challenge: retryChallenge,
    onConfirmed: onRetryConfirmed,
    onCancelled: onRetryCancelled,
  } = useVerifiedAction(updateProfile);
  // Bump remonta o form de telefone, voltando o campo pro número atual — cancelar o código não
  // deve deixar o número não confirmado digitado ali (diferente do "tipo em uso" do FormBuilder,
  // aqui cancelar É desistir da troca).
  const [phoneFormKey, setPhoneFormKey] = useState(0);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);

  const handlePhoneSubmit = async (data: { phone?: string }) => {
    if ((data.phone ?? '') === (user?.phone ?? '')) {
      toast.info(t('noChanges'));
      setIsPhoneDialogOpen(false);
      return;
    }
    // runUpdateProfile: se o telefone exige confirmação, o guard bloqueia com 428 e o modal
    // genérico abre sozinho — repete esta mesma chamada depois de confirmado.
    const result = await runUpdateProfile(user!.id, { phone: data.phone });
    if (!result.success) {
      // Cancelou o modal de verificação: sentinel do useVerifiedAction, não um erro de fato.
      if (result.message === 'cancelled') {
        setPhoneFormKey((k) => k + 1);
        throw new SubmitCancelledError();
      }
      throw new Error(result.message);
    }
    setIsPhoneDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['me'] });
    toast.success(t('common:updatedSuccessfully'));
    return result;
  };

  const handleRetryConfirmed = () => {
    onRetryConfirmed();
    setIsPhoneDialogOpen(false);
  };

  return {
    whatsappUnavailable,
    whatsappReason,
    whatsappFixPath,
    phoneFormKey,
    isPhoneDialogOpen,
    setIsPhoneDialogOpen,
    handlePhoneSubmit,
    retryChallenge,
    handleRetryConfirmed,
    onRetryCancelled,
  };
}

interface ProfileInfoTabProps {
  messagingEnabled?: boolean;
}

export function ProfileInfoTab({ messagingEnabled = true }: ProfileInfoTabProps) {
  const { t } = useTranslation('profile');
  const { data: user } = useMe();
  const { data: imageUrl } = usePresignedUrl(user?.image);
  const queryClient = useQueryClient();

  const {
    whatsappUnavailable,
    whatsappReason,
    whatsappFixPath,
    phoneFormKey,
    isPhoneDialogOpen,
    setIsPhoneDialogOpen,
    handlePhoneSubmit,
    retryChallenge,
    handleRetryConfirmed,
    onRetryCancelled,
  } = usePhoneUpdate(user, queryClient, t);

  // Avatar salva sozinho ao escolher o arquivo — não depende do botão "Salvar Alterações" do nome.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const result = await updateProfile(user.id, { image: file });
    if (!result.success) { toast.error(result.message); return; }
    queryClient.invalidateQueries({ queryKey: ['me'] });
    toast.success(t('common:updatedSuccessfully'));
  };

  const profileSchema = useMemo(() => z.object({
    name: z.string().optional(),
  }), []);

  const profileFields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('name'), type: 'text', placeholder: t('namePlaceholder') },
    { name: 'emailDisplay', label: t('email'), type: 'display', placeholder: user?.email ?? '' },
  ], [t, user?.email]);

  const handleProfileSubmit = async (data: z.infer<typeof profileSchema>) => {
    if (data.name === user?.name) { toast.info(t('noChanges')); return; }
    // Nunca inclui `phone`: este PATCH não pode ser bloqueado pelo VerificationGuard.
    const result = await updateProfile(user!.id, data);
    // Lança em vez de retornar: o FormBuilder só sabe que a submissão falhou se `onSubmit`
    // lançar — caso contrário ele mostra o toast de sucesso por cima do erro já exibido.
    if (!result.success) throw new Error(result.message);
    queryClient.invalidateQueries({ queryKey: ['me'] });
    toast.success(t('common:updatedSuccessfully'));
    return result;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <ProfileAvatarSection
        user={user}
        imageUrl={imageUrl?.url}
        onAvatarChange={handleAvatarChange}
      />

      <div className="w-full flex-1 min-w-0">
        <Container variant="form" padding>
          <h2 className="text-base font-semibold mb-4">{t('personalInfoTitle')}</h2>

          <FormBuilder
            schema={profileSchema}
            fields={profileFields}
            mode="edit"
            values={{ name: user.name ?? '' }}
            onSubmit={handleProfileSubmit}
            submitLabel={t('updateProfileButton')}
            cancelLabel={t('cancel')}
            actions={{ mode: 'submit+cancel' }}
            onCancel={() => {}}
            gridClassName="grid gap-4 sm:grid-cols-2"
            showToast={false}
          />

          {messagingEnabled && (
            <PhoneSection
              phone={user.phone}
              phoneFormKey={phoneFormKey}
              isDialogOpen={isPhoneDialogOpen}
              onDialogOpenChange={setIsPhoneDialogOpen}
              whatsappUnavailable={whatsappUnavailable}
              whatsappReason={whatsappReason}
              whatsappFixPath={whatsappFixPath}
              onSubmit={handlePhoneSubmit}
            />
          )}
        </Container>
      </div>

      <VerificationCodeModal
        challenge={retryChallenge}
        onConfirmed={handleRetryConfirmed}
        onCancelled={onRetryCancelled}
      />
    </div>
  );
}
