'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { getEmailTemplates, sendEmail } from '@/lib/actions/email/api';
import type { EmailTemplateInfo, EmailTemplateVariable } from '@/lib/actions/email/types';

/** Espelha o backend email.util.ts — suporta {{#if var}}...{{/if}} e {{ var }}. */
function renderWithValues(html: string, vars: Record<string, string>, escape: boolean): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return html
    .replace(
      /\{\{#if\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, key: string, inner: string) => (vars[key] ? inner : ''),
    )
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
      const val = vars[key] ?? '';
      return escape ? esc(val) : val;
    });
}

const MULTILINE_VARS = new Set(['message', 'body', 'content', 'text']);

interface VariableFieldProps {
  variable: EmailTemplateVariable;
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function VariableField({ variable, value, onChange, label }: VariableFieldProps) {
  if (MULTILINE_VARS.has(variable.name)) {
    return (
      <div className="grid gap-1">
        <Label>{label}</Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={variable.dummy}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={variable.dummy} />
    </div>
  );
}

export interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultTemplateType?: string;
  /** Valores iniciais das variáveis do template (ex: { name: 'João', message: '...' }). */
  defaultVars?: Record<string, string>;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  defaultTo = '',
  defaultTemplateType,
  defaultVars = {},
}: SendEmailDialogProps) {
  const { t } = useTranslation('common');
  const { t: ts } = useTranslation('settings');

  const [templates, setTemplates] = useState<EmailTemplateInfo[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [varValues, setVarValues] = useState<Record<string, Record<string, string>>>({});
  const [to, setTo] = useState(defaultTo);
  const [prevDefaultTo, setPrevDefaultTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (defaultTo !== prevDefaultTo) {
    setPrevDefaultTo(defaultTo);
    setTo(defaultTo);
  }

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getEmailTemplates().then((res) => {
      if (cancelled) return;
      const list = res.data ?? [];
      setTemplates(list);
      const initial: Record<string, Record<string, string>> = {};
      list.forEach((item) => {
        initial[item.type] = Object.fromEntries(
          item.variables.map((v) => [v.name, defaultVars[v.name] ?? '']),
        );
      });
      setVarValues(initial);
      const first =
        defaultTemplateType && list.some((l) => l.type === defaultTemplateType)
          ? defaultTemplateType
          : (list[0]?.type ?? '');
      setActiveTab(first);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // defaultVars is only captured upon opening to populate initial values.
    // Intentionally omitted from deps so typing or parent re-renders don't overwrite user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTemplateType]);

  const setVar = (templateType: string, name: string, value: string) => {
    setVarValues((prev) => ({
      ...prev,
      [templateType]: { ...prev[templateType], [name]: value },
    }));
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error(t('sendEmailDialog.toRequired'));
      return;
    }
    if (!subject.trim()) {
      toast.error(t('sendEmailDialog.subjectRequired'));
      return;
    }
    const template = templates.find((item) => item.type === activeTab);
    if (!template) return;
    const html = renderWithValues(template.html, varValues[activeTab] ?? {}, true);
    setSending(true);
    const res = await sendEmail({ to: to.trim(), subject: subject.trim(), html });
    setSending(false);
    if (!res.success) {
      toast.error(res.message ?? t('sendEmailDialog.error'));
      return;
    }
    toast.success(t('sendEmailDialog.sent'));
    onOpenChange(false);
  };

  return (
    <Modal
      title={t('sendEmailDialog.title')}
      description={t('sendEmailDialog.description')}
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
    >
      <div className="grid gap-3 mb-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="send-email-to">{t('sendEmailDialog.to')}</Label>
          <Input
            id="send-email-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t('sendEmailDialog.toPlaceholder')}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="send-email-subject">{t('sendEmailDialog.subject')}</Label>
          <Input
            id="send-email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('sendEmailDialog.subjectPlaceholder')}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('sendEmailDialog.noTemplates')}</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {templates.map((item) => (
              <TabsTrigger key={item.type} value={item.type}>
                {ts(`system_email_template_${item.type.toLowerCase()}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((item) => {
            const values = varValues[item.type] ?? {};
            const preview = renderWithValues(item.html, values, false);
            return (
              <TabsContent key={item.type} value={item.type}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid content-start gap-3">
                    {item.variables.map((v) => (
                      <VariableField
                        key={v.name}
                        variable={v}
                        value={values[v.name] ?? ''}
                        onChange={(val) => setVar(item.type, v.name, val)}
                        label={ts(v.labelKey)}
                      />
                    ))}
                  </div>

                  <div className="grid content-start gap-2">
                    <Label>{ts('system_email_template_preview')}</Label>
                    <iframe
                      title={ts('system_email_template_preview')}
                      sandbox=""
                      srcDoc={preview}
                      className="h-[40vh] w-full rounded-md border bg-white"
                    />
                  </div>
                </div>
              </TabsContent>
            );
          })}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" disabled={sending} onClick={handleSend}>
              {sending ? t('sendEmailDialog.sending') : t('sendEmailDialog.send')}
            </Button>
          </div>
        </Tabs>
      )}
    </Modal>
  );
}
