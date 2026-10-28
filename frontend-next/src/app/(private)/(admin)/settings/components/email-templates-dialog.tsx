'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { insertToken, VariableButtons } from '@/components/variable-insert';
import { useTranslation } from '@/hooks/use-translation';
import { getEmailTemplates } from '@/lib/actions/email/api';
import type { EmailTemplateInfo, EmailTemplateVariable } from '@/lib/actions/email/types';
import { useConfiguration } from '@/lib/actions/systemConfiguration/queries';
import { updateSystemConfiguration } from '@/lib/actions/systemConfiguration/api';

const CONFIG_KEY = 'EMAIL_TEMPLATES';

/** Troca `{{ var }}` pelo valor fictício de cada variável — é o que o preview mostra. */
export function renderPreview(html: string, variables: EmailTemplateVariable[]): string {
  const byName = new Map(variables.map((v) => [v.name, v.dummy]));
  return html.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (token, name: string) => byName.get(name) ?? token,
  );
}

function TemplatePane({
  template,
  draft,
  onDraftChange,
}: {
  template: EmailTemplateInfo;
  draft: string;
  onDraftChange: (html: string) => void;
}) {
  const { t } = useTranslation('settings');
  const ref = useRef<HTMLTextAreaElement>(null);
  const usedNames = useMemo(() => {
    const found = draft.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
    return new Set(found.map((raw) => raw.replace(/[{}\s]/g, '')));
  }, [draft]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-2">
        <Label>{t('system_email_template_html')}</Label>
        <VariableButtons
          variables={template.variables.map((v) => ({ name: v.name, title: t(v.labelKey) }))}
          usedNames={usedNames}
          onInsert={(name) => ref.current && insertToken(ref.current, draft, name, onDraftChange)}
        />
        <Textarea
          ref={ref}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          className="h-[55vh] font-mono text-xs"
          spellCheck={false}
        />
      </div>

      <div className="grid content-start gap-2">
        <Label>{t('system_email_template_preview')}</Label>
        <iframe
          title={t('system_email_template_preview')}
          sandbox=""
          srcDoc={renderPreview(draft, template.variables)}
          className="h-[55vh] w-full rounded-md border bg-white"
        />
      </div>
    </div>
  );
}

export function EmailTemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const { data: row } = useConfiguration<Record<string, string>>(CONFIG_KEY);
  const [templates, setTemplates] = useState<EmailTemplateInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void getEmailTemplates().then((res) => {
      const list = res.data ?? [];
      setTemplates(list);
      setDrafts(Object.fromEntries(list.map((item) => [item.type, item.html])));
    });
  }, [open]);

  const persist = async (nextMap: Record<string, string>) => {
    if (!row) {
      toast.error(t('system_email_template_save_error'));
      return false;
    }
    const result = await updateSystemConfiguration(row.id, JSON.stringify(nextMap));
    if (!result.success) {
      toast.error(result.message);
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ['system-configuration', CONFIG_KEY] });
    return true;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const nextMap = { ...(row?.value ?? {}) };
    for (const item of templates) {
      const draft = drafts[item.type] ?? item.html;
      if (draft === item.defaultHtml) delete nextMap[item.type];
      else nextMap[item.type] = draft;
    }
    const ok = await persist(nextMap);
    setSaving(false);
    if (!ok) return;

    setTemplates((prev) =>
      prev.map((item) => {
        const draft = drafts[item.type] ?? item.html;
        return { ...item, html: draft, isDefault: draft === item.defaultHtml };
      }),
    );
    toast.success(t('save_configuration'));
    onOpenChange(false);
  };

  const restoreDefault = (type: string) => {
    const template = templates.find((item) => item.type === type);
    if (template) setDrafts((prev) => ({ ...prev, [type]: template.defaultHtml }));
  };

  const first = templates[0]?.type;

  return (
    <Modal
      title={t('system_email_templates')}
      description={t('system_email_templates_desc')}
      open={open}
      onOpenChange={onOpenChange}
      size="full"
    >
      {templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('system_email_template_loading')}</p>
      ) : (
        <Tabs defaultValue={first}>
          <TabsList>
            {templates.map((item) => (
              <TabsTrigger key={item.type} value={item.type}>
                {t(`system_email_template_${item.type.toLowerCase()}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((item) => (
            <TabsContent key={item.type} value={item.type}>
              <TemplatePane
                template={item}
                draft={drafts[item.type] ?? item.html}
                onDraftChange={(html) => setDrafts((prev) => ({ ...prev, [item.type]: html }))}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                disabled={(drafts[item.type] ?? item.html) === item.defaultHtml}
                onClick={() => restoreDefault(item.type)}
              >
                {t('system_email_template_restore_default')}
              </Button>
            </TabsContent>
          ))}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('system_email_template_cancel')}
            </Button>
            <Button type="button" disabled={saving} onClick={handleSaveAll}>
              {t('save_configuration')}
            </Button>
          </div>
        </Tabs>
      )}
    </Modal>
  );
}
