'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PhoneInput, isValidPhone } from '@/components/ui/phone-input';
import { useTranslation } from '@/hooks/use-translation';
import { useConfiguration } from '@/lib/actions/systemConfiguration/queries';
import { updateSystemConfiguration } from '@/lib/actions/systemConfiguration/api';

const CONFIG_KEY = 'SYSTEM_MESSAGING_IGNORE_LIST';

/** Números que o webhook descarta por completo: nada é gravado nem respondido. */
export function MessagingIgnoreList() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const { data: row } = useConfiguration<string[]>(CONFIG_KEY);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const numbers = Array.isArray(row?.value) ? row.value : [];

  const persist = async (next: string[]) => {
    if (!row) {
      toast.error(t('system_messaging_ignore_save_error'));
      return;
    }
    setSaving(true);
    const result = await updateSystemConfiguration(row.id, JSON.stringify(next));
    setSaving(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['system-configuration', CONFIG_KEY] });
  };

  const add = async () => {
    if (!isValidPhone(draft)) {
      toast.error(t('system_messaging_ignore_invalid'));
      return;
    }
    if (numbers.includes(draft)) {
      toast.error(t('system_messaging_ignore_duplicate'));
      return;
    }
    await persist([...numbers, draft]);
    setDraft('');
  };

  return (
    <div className="mt-6">
      <p className="font-medium mb-1">{t('system_messaging_ignore_title')}</p>
      <p className="text-sm text-muted-foreground mb-3">{t('system_messaging_ignore_desc')}</p>

      <div className="grid gap-2 max-w-md">
        <Label htmlFor="ignore-phone">{t('system_messaging_ignore_add')}</Label>
        <div className="flex gap-2">
          <PhoneInput id="ignore-phone" value={draft} onChange={setDraft} className="flex-1" />
          <Button type="button" onClick={add} disabled={saving || !draft}>
            {t('system_messaging_ignore_add_button')}
          </Button>
        </div>
      </div>

      {numbers.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{t('system_messaging_ignore_empty')}</p>
      ) : (
        <ul className="mt-3 grid max-w-md gap-1">
          {numbers.map((phone) => (
            <li key={phone} className="flex items-center justify-between rounded-md border px-3 py-1.5">
              <span className="font-mono text-sm">{phone}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('system_messaging_ignore_remove')}
                disabled={saving}
                onClick={() => persist(numbers.filter((item) => item !== phone))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
