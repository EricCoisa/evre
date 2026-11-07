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
import { useUpdateTimeEntry } from '@/lib/actions/time-tracking/queries';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import { Edit2, ShieldAlert } from 'lucide-react';

interface EditTimeEntryDialogProps {
  entry: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toLocalDatetimeString(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function EditTimeEntryDialog({
  entry,
  open,
  onOpenChange,
}: EditTimeEntryDialogProps) {
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  const updateMutation = useUpdateTimeEntry();

  useEffect(() => {
    if (entry) {
      setDescription(entry.description ?? entry.entityTitle ?? '');
      setStartTime(toLocalDatetimeString(entry.startTime));
      setEndTime(toLocalDatetimeString(entry.endTime));
      setIsBillable(entry.isBillable ?? true);
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        data: {
          description: description.trim() || undefined,
          startTime: startTime ? new Date(startTime).toISOString() : undefined,
          endTime: endTime ? new Date(endTime).toISOString() : null,
          isBillable,
        },
      });
      onOpenChange(false);
    } catch {
      // Toast de erro já tratado via Collector
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Editar Registro de Tempo
            </DialogTitle>
            <DialogDescription>
              Ajuste horários e detalhes. As alterações são registradas na auditoria interna do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Descrição / Atividade</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Desenvolvimento da feature..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start">Início</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-end">Término</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-billable" className="cursor-pointer font-medium">
                  Atividade Faturável
                </Label>
                <p className="text-xs text-muted-foreground">
                  Considerar horas no faturamento do projeto
                </p>
              </div>
              <Switch
                id="edit-billable"
                checked={isBillable}
                onCheckedChange={setIsBillable}
              />
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/60 text-muted-foreground text-xs">
              <ShieldAlert className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
              <span>
                Ao salvar, o registro será carimbado internamente como <strong>Editado Manualmente</strong> para fins de auditoria.
              </span>
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
