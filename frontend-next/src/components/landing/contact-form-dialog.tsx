'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { RichTextInput } from '@/components/rich-text-input';
import { isValidPhone } from '@/components/ui/phone-input';
import { useCaptcha } from '@/hooks/use-captcha';
import { useTranslation } from '@/hooks/use-translation';
import { createLead } from '@/lib/actions/lead/api';
import type { CaptchaConfigDto } from '@/lib/generated/schemas';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  successMessage?: string;
  captcha?: CaptchaConfigDto | null;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  title = 'Entre em contato',
  description = 'Responderemos em breve.',
  submitLabel,
  successMessage,
  captcha,
}: ContactFormDialogProps) {
  const { t } = useTranslation('lead');
  const { containerRef, getToken, enabled: captchaEnabled } = useCaptcha(captcha);

  const schema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('form.errorName')),
      phone: z.string().optional(),
      email: z.string().optional(),
      message: z.string().min(1, t('form.errorMessage')),
    })
    .refine(d => d.phone?.trim() || d.email?.trim(), {
      message: t('form.errorContact'),
      path: ['phone'],
    })
    .refine(d => !d.phone?.trim() || isValidPhone(d.phone), {
      message: t('form.errorPhone'),
      path: ['phone'],
    }),
  [t]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('form.labelName'), placeholder: t('form.placeholderName') },
    { name: 'phone', label: t('form.labelPhone'), type: 'phone' },
    { name: 'email', label: t('form.labelEmail'), type: 'email', placeholder: t('form.placeholderEmail') },
    {
      name: 'message',
      label: t('form.labelMessage'),
      type: 'custom',
      render: (field) => (
        <RichTextInput
          value={field.value as string ?? ''}
          onChange={field.onChange}
          placeholder={t('form.placeholderMessage')}
          ariaLabel={t('form.labelMessage')}
        />
      ),
    },
    // ponytail: captcha container must live inside the form for widget rendering
    {
      name: '_captcha',
      label: '',
      type: 'custom',
      render: () => <div ref={containerRef} />,
    },
  ], [t, containerRef]);

  return (
    <FormBuilderModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      schema={schema}
      fields={fields}
      submitLabel={submitLabel}
      showToast={false}
      onSubmit={async (data) => {
        let captchaToken: string | null = null;
        if (captchaEnabled) {
          captchaToken = await getToken();
          if (!captchaToken) throw new Error(t('form.errorCaptcha'));
        }
        const res = await createLead(
          {
            name: data.name.trim(),
            phone: data.phone?.trim() || undefined,
            email: data.email?.trim() || undefined,
            message: data.message.trim(),
          },
          captchaToken,
        );
        if (!res.success) throw new Error(res.message ?? t('form.errorSubmit'));
      }}
      onSuccess={() => {
        toast.success(successMessage);
        onOpenChange(false);
      }}
    />
  );
}
