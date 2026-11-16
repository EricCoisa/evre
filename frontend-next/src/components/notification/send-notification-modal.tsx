'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { useTranslation } from '@/hooks/use-translation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { useRoles } from '@/lib/actions/user/queries';
import { useSendBroadcastNotification } from '@/lib/actions/notification/queries';

type Audience = 'all' | 'roles';
type AudienceValue = { type: Audience; roleNames: string[] };

function AudienceField({
  value,
  onChange,
  roles,
  t,
}: {
  value: AudienceValue;
  onChange: (v: AudienceValue) => void;
  roles?: { value: string; label: string }[];
  t: (key: string) => string;
}) {
  const toggleRole = (name: string) => {
    const names = value.roleNames;
    onChange({ ...value, roleNames: names.includes(name) ? names.filter(n => n !== name) : [...names, name] });
  };

  return (
    <div className="grid gap-2">
      <Label>{t('audience_label')}</Label>
      <RadioGroup value={value.type} onValueChange={(v) => onChange({ ...value, type: v as Audience, roleNames: [] })}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="audience-all" />
          <Label htmlFor="audience-all" className="font-normal">{t('audience_all')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="roles" id="audience-roles" />
          <Label htmlFor="audience-roles" className="font-normal">{t('audience_roles')}</Label>
        </div>
      </RadioGroup>

      {value.type === 'roles' && (
        <div className="grid gap-2 pl-6">
          {!roles?.length
            ? <p className="text-sm text-muted-foreground">{t('no_roles')}</p>
            : roles.map((role) => (
                <div key={role.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role.value}`}
                    checked={value.roleNames.includes(role.label)}
                    onCheckedChange={() => toggleRole(role.label)}
                  />
                  <Label htmlFor={`role-${role.value}`} className="font-normal">{role.label}</Label>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

export function SendNotificationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('notification');
  const { t: tCommon } = useTranslation('common');
  const { data: roles } = useRoles();
  const sendBroadcast = useSendBroadcastNotification();

  const schema = useMemo(() =>
    z.object({
      title: z.string().min(1, tCommon('validation_required')),
      message: z.string().min(1, tCommon('validation_required')),
      actionUrl: z.string().optional(),
      audience: z.object({
        type: z.enum(['all', 'roles']),
        roleNames: z.array(z.string()),
      }).refine(d => d.type === 'all' || d.roleNames.length > 0, {
        message: t('audience_roles_required'),
      }),
    }),
  [t, tCommon]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: 'title', label: t('field_title') },
    { name: 'message', label: t('field_message'), type: 'textarea' },
    { name: 'actionUrl', label: t('field_action_url'), placeholder: t('field_action_url_placeholder') },
    {
      name: 'audience',
      label: '',
      type: 'custom',
      render: (field) => (
        <AudienceField
          value={field.value as AudienceValue ?? { type: 'all', roleNames: [] }}
          onChange={field.onChange}
          roles={roles}
          t={t}
        />
      ),
    },
  ], [t, roles]);

  return (
    <FormBuilderModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('send_broadcast_title')}
      description={t('send_broadcast_description')}
      schema={schema}
      fields={fields}
      values={{ audience: { type: 'all', roleNames: [] } }}
      submitLabel={tCommon('submit')}
      onSubmit={async (data) => {
        await sendBroadcast.mutateAsync({
          title: data.title.trim(),
          message: data.message.trim(),
          actionUrl: data.actionUrl?.trim() || undefined,
          all: data.audience.type === 'all',
          roleNames: data.audience.type === 'all' ? [] : data.audience.roleNames,
        });
      }}
      onSuccess={() => onOpenChange(false)}
    />
  );
}
