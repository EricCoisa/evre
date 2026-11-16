'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PhoneInput, isValidPhone } from '@/components/ui/phone-input';
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

interface FormState { name: string; phone: string; email: string; message: string }

function validate(f: FormState): string | null {
  if (!f.name.trim()) return 'form.errorName';
  if (!f.phone.trim() && !f.email.trim()) return 'form.errorContact';
  if (f.phone.trim() && !isValidPhone(f.phone)) return 'form.errorPhone';
  if (!f.message.trim()) return 'form.errorMessage';
  return null;
}

function ContactFormContent({
  submitLabel,
  successMessage,
  captcha,
  onClose,
}: {
  submitLabel?: string;
  successMessage?: string;
  captcha?: CaptchaConfigDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('lead');
  const [form, setForm] = useState<FormState>({ name: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const { containerRef, getToken, enabled: captchaEnabled } = useCaptcha(captcha);

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async () => {
    const errorKey = validate(form);
    if (errorKey) { toast.error(t(errorKey)); return; }

    let captchaToken: string | null = null;
    if (captchaEnabled) {
      captchaToken = await getToken();
      if (!captchaToken) { toast.error(t('form.errorCaptcha')); return; }
    }

    setSubmitting(true);
    try {
      const res = await createLead(
        {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          message: form.message.trim(),
        },
        captchaToken,
      );
      if (res.success) {
        toast.success(successMessage);
        onClose();
      } else {
        toast.error(res.message ?? t('form.errorSubmit'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label>{t('form.labelName')} *</Label>
          <Input placeholder={t('form.placeholderName')} autoComplete="name" value={form.name} onChange={set('name')} disabled={submitting} />
        </div>

        <div className="grid gap-1.5">
          <Label>{t('form.labelPhone')}</Label>
          <PhoneInput
            value={form.phone}
            onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
            disabled={submitting}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>{t('form.labelEmail')}</Label>
          <Input type="email" placeholder={t('form.placeholderEmail')} autoComplete="email" value={form.email} onChange={set('email')} disabled={submitting} />
        </div>

        <div className="grid gap-1.5">
          <Label>{t('form.labelMessage')} *</Label>
          <Textarea rows={4} placeholder={t('form.placeholderMessage')} value={form.message} onChange={set('message')} disabled={submitting} />
        </div>

        <div ref={containerRef} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          {t('form.cancel')}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && (
          <ContactFormContent
            captcha={captcha}
            submitLabel={submitLabel}
            successMessage={successMessage}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
