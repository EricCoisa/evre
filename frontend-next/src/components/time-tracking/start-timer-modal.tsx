'use client';

import { useState, useEffect } from 'react';
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
import { useStartTimer } from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { Play } from 'lucide-react';

interface StartTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDescription?: string;
  defaultProjectId?: string;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultEntityTitle?: string;
}

export function StartTimerModal({
  open,
  onOpenChange,
  defaultDescription = '',
  defaultProjectId,
  defaultEntityType,
  defaultEntityId,
  defaultEntityTitle,
}: StartTimerModalProps) {
  const [description, setDescription] = useState(defaultDescription);
  const [projectId, setProjectId] = useState<string | undefined>(defaultProjectId);
  const [isBillable, setIsBillable] = useState(true);

  useEffect(() => {
    if (open) {
      setDescription(defaultDescription || defaultEntityTitle || '');
      setProjectId(defaultProjectId);
      setIsBillable(true);
    }
  }, [open, defaultDescription, defaultEntityTitle, defaultProjectId]);

  const startTimerMutation = useStartTimer();
  const { data: projectsData } = useProjects({ limit: 50 });

  const projects = Array.isArray(projectsData)
    ? projectsData
    : (projectsData as { data?: any[] })?.data ?? [];

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await startTimerMutation.mutateAsync({
        description: description.trim() || defaultEntityTitle || undefined,
        projectId: projectId && projectId !== 'none' ? projectId : undefined,
        isBillable,
        entityType: defaultEntityType,
        entityId: defaultEntityId,
        entityTitle: defaultEntityTitle,
      });
      onOpenChange(false);
      setDescription('');
    } catch (err) {
      console.error('[StartTimerModal] Error starting timer:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleStart} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-500 fill-emerald-500" />
              Iniciar Cronômetro
            </DialogTitle>
            <DialogDescription>
              Acompanhe o tempo dedicado aos projetos e tarefas. O cronômetro começará a rodar imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="timer-description">O que você está fazendo?</Label>
              <Input
                id="timer-description"
                placeholder="Ex.: Desenvolvendo autenticação, reunião de alinhamento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timer-project">Projeto vinculado (opcional)</Label>
              <Select
                value={projectId ?? 'none'}
                onValueChange={(val) => setProjectId(val === 'none' ? undefined : val)}
              >
                <SelectTrigger id="timer-project" className="w-full">
                  <SelectValue placeholder="Selecione um projeto ou deixe avulso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Tempo avulso)</SelectItem>
                  {projects.map((proj: any) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="timer-billable" className="cursor-pointer font-medium">
                  Atividade Faturável
                </Label>
                <p className="text-xs text-muted-foreground">
                  Marcar este registro de tempo para faturamento do projeto
                </p>
              </div>
              <Switch
                id="timer-billable"
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
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={startTimerMutation.isPending}
            >
              <Play className="h-4 w-4 fill-white" />
              {startTimerMutation.isPending ? 'Iniciando...' : 'Iniciar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
