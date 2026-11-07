'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateManualEntry } from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntryDialog({
  open,
  onOpenChange,
}: ManualEntryDialogProps) {
  const { t } = useTranslation('time-tracking');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  const createMutation = useCreateManualEntry();
  const { data: projectsData } = useProjects({ limit: 50 });

  const projects = Array.isArray(projectsData)
    ? projectsData
    : (projectsData as { data?: any[] })?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) return;

    try {
      await createMutation.mutateAsync({
        description: description.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        projectId: projectId && projectId !== 'none' ? projectId : undefined,
        isBillable,
      });
      onOpenChange(false);
      setDescription('');
      setStartTime('');
      setEndTime('');
    } catch {
      // Toast gerenciado pelo Alive
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              {t('manualTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('manualDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="manual-description">{t('activityLabel')}</Label>
              <Input
                id="manual-description"
                placeholder={t('manualDescriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-project">{t('projectLabel')}</Label>
              <Select
                value={projectId ?? 'none'}
                onValueChange={(val) => setProjectId(val === 'none' ? undefined : val)}
              >
                <SelectTrigger id="manual-project" className="w-full">
                  <SelectValue placeholder={t('selectProjectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noProjectAvulso')}</SelectItem>
                  {projects.map((proj: any) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-start">{t('startTime')}</Label>
                <Input
                  id="manual-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-end">{t('endTime')}</Label>
                <Input
                  id="manual-end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="manual-billable" className="cursor-pointer font-medium">
                  {t('billableActivity')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('billableDescription')}
                </p>
              </div>
              <Switch
                id="manual-billable"
                checked={isBillable}
                onCheckedChange={setIsBillable}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('saving') : t('manual_entry')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
