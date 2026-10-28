'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useRoles } from '@/lib/actions/user/queries';
import { useSendBroadcastNotification } from '@/lib/actions/notification/queries';

type Audience = 'all' | 'roles';

function AudienceRolesList({
  roles,
  selectedRoleNames,
  toggleRole,
  hasSubmitted,
  t,
}: {
  roles?: { value: string; label: string }[];
  selectedRoleNames: string[];
  toggleRole: (name: string) => void;
  hasSubmitted: boolean;
  t: (key: string) => string;
}) {
  if (!roles?.length) {
    return <p className="text-sm text-muted-foreground">{t('no_roles')}</p>;
  }
  return (
    <div className="grid gap-2 pl-6">
      {roles.map((role) => (
        <div key={role.value} className="flex items-center gap-2">
          <Checkbox
            id={`role-${role.value}`}
            checked={selectedRoleNames.includes(role.label)}
            onCheckedChange={() => toggleRole(role.label)}
          />
          <Label htmlFor={`role-${role.value}`} className="font-normal">{role.label}</Label>
        </div>
      ))}
      {hasSubmitted && selectedRoleNames.length === 0 && (
        <p className="text-[0.8rem] text-destructive">{t('audience_roles_required')}</p>
      )}
    </div>
  );
}

function AudienceSelector({
  audience,
  setAudience,
  roles,
  selectedRoleNames,
  toggleRole,
  hasSubmitted,
  t,
}: {
  audience: Audience;
  setAudience: (v: Audience) => void;
  roles?: { value: string; label: string }[];
  selectedRoleNames: string[];
  toggleRole: (name: string) => void;
  hasSubmitted: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{t('audience_label')}</Label>
      <RadioGroup value={audience} onValueChange={(v) => setAudience(v as Audience)}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="audience-all" />
          <Label htmlFor="audience-all" className="font-normal">{t('audience_all')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="roles" id="audience-roles" />
          <Label htmlFor="audience-roles" className="font-normal">{t('audience_roles')}</Label>
        </div>
      </RadioGroup>

      {audience === 'roles' && (
        <AudienceRolesList
          roles={roles}
          selectedRoleNames={selectedRoleNames}
          toggleRole={toggleRole}
          hasSubmitted={hasSubmitted}
          t={t}
        />
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

  const [audience, setAudience] = useState<Audience>('all');
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const toggleRole = (name: string) =>
    setSelectedRoleNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const canSave =
    !!title.trim() &&
    !!message.trim() &&
    (audience === 'all' || selectedRoleNames.length > 0) &&
    !sendBroadcast.isPending;

  const reset = () => {
    setAudience('all');
    setSelectedRoleNames([]);
    setTitle('');
    setMessage('');
    setActionUrl('');
    setHasSubmitted(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (!canSave) return;

    try {
      await sendBroadcast.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        actionUrl: actionUrl.trim() || undefined,
        all: audience === 'all',
        roleNames: audience === 'all' ? [] : selectedRoleNames,
      });
      toast.success(tCommon('successMessage'));
      handleOpenChange(false);
    } catch {
      // Alive já mostrou o toast de erro
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('send_broadcast_title')}</DialogTitle>
          <DialogDescription>{t('send_broadcast_description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="broadcast-title">{t('field_title')}</Label>
            <Input
              id="broadcast-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
            {hasSubmitted && !title.trim() && (
              <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="broadcast-message">{t('field_message')}</Label>
            <Textarea
              id="broadcast-message"
              value={message}
              maxLength={2000}
              rows={4}
              onChange={(e) => setMessage(e.target.value)}
            />
            {hasSubmitted && !message.trim() && (
              <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="broadcast-action-url">{t('field_action_url')}</Label>
            <Input
              id="broadcast-action-url"
              value={actionUrl}
              placeholder={t('field_action_url_placeholder')}
              onChange={(e) => setActionUrl(e.target.value)}
            />
          </div>

          <AudienceSelector
            audience={audience}
            setAudience={setAudience}
            roles={roles}
            selectedRoleNames={selectedRoleNames}
            toggleRole={toggleRole}
            hasSubmitted={hasSubmitted}
            t={t}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" disabled={sendBroadcast.isPending} onClick={handleSubmit}>
            {tCommon('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
