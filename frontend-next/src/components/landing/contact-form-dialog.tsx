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
import { PhoneInput } from '@/components/ui/phone-input';
import { useCaptcha } from '@/hooks/use-captcha';
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
  if (!f.name.trim()) return 'Informe seu nome.';
  if (!f.phone.trim() && !f.email.trim()) return 'Informe telefone ou e-mail.';
  if (!f.message.trim()) return 'Escreva uma mensagem.';
  return null;
}

function ContactFormContent({
  submitLabel = 'Enviar',
  successMessage = 'Mensagem enviada! Entraremos em contato em breve.',
  captcha,
  onClose,
}: {
  submitLabel?: string;
  successMessage?: string;
  captcha?: CaptchaConfigDto | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>({ name: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const { containerRef, getToken, enabled: captchaEnabled } = useCaptcha(captcha);

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async () => {
    const error = validate(form);
    if (error) { toast.error(error); return; }

    let captchaToken: string | null = null;
    if (captchaEnabled) {
      captchaToken = await getToken();
      if (!captchaToken) { toast.error('Resolva o captcha antes de enviar.'); return; }
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
        toast.error(res.message ?? 'Erro ao enviar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label>Nome *</Label>
          <Input placeholder="Seu nome" autoComplete="name" value={form.name} onChange={set('name')} disabled={submitting} />
        </div>

        <div className="grid gap-1.5">
          <Label>Telefone</Label>
          <PhoneInput
            value={form.phone}
            onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
            disabled={submitting}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>E-mail</Label>
          <Input type="email" placeholder="voce@empresa.com" autoComplete="email" value={form.email} onChange={set('email')} disabled={submitting} />
        </div>

        <div className="grid gap-1.5">
          <Label>Mensagem *</Label>
          <Textarea rows={4} placeholder="Conte um pouco sobre o que você precisa…" value={form.message} onChange={set('message')} disabled={submitting} />
        </div>

        <div ref={containerRef} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancelar
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
