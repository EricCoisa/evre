'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useTimeEntries,
  useDeleteTimeEntry,
  useStartTimer,
} from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { StartTimerModal } from '@/components/time-tracking/start-timer-modal';
import { EditTimeEntryDialog } from './components/edit-time-entry-dialog';
import { ManualEntryDialog } from './components/manual-entry-dialog';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import {
  Play,
  PlusCircle,
  Clock,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  FileEdit,
  DollarSign,
  Briefcase,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Layers,
  CornerDownRight,
  ChevronsUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface GroupedTimeEntry {
  key: string;
  title: string;
  entityType?: string | null;
  entityId?: string | null;
  entityTitle?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  entries: TimeEntry[];
  totalDuration: number;
  hasRunning: boolean;
  hasForgotten: boolean;
  hasManual: boolean;
  latestStartTime: Date;
  operators: string[];
}

export default function TimeTrackerPage() {
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Controle de agrupamento / stacking
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const startTimerMutation = useStartTimer();
  const deleteMutation = useDeleteTimeEntry();

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('evre_time_tracking_bus');
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'], refetchType: 'all' });
    };
    return () => {
      channel.close();
    };
  }, [queryClient]);

  const { data: entriesData, isLoading } = useTimeEntries({
    search: search.trim() || undefined,
    projectId: selectedProjectId && selectedProjectId !== 'all' ? selectedProjectId : undefined,
    limit: '50',
  } as any);

  const { data: projectsData } = useProjects({ limit: 50 });

  const entries: TimeEntry[] = Array.isArray(entriesData)
    ? (entriesData as TimeEntry[])
    : (entriesData as { data?: TimeEntry[] })?.data ?? [];

  const projects = Array.isArray(projectsData)
    ? projectsData
    : (projectsData as { data?: any[] })?.data ?? [];

  // Cálculos de totais
  const { totalSeconds, billableSeconds } = useMemo(() => {
    let total = 0;
    let billable = 0;
    for (const e of entries) {
      const dur = e.duration ?? 0;
      total += dur;
      if (e.isBillable) billable += dur;
    }
    return { totalSeconds: total, billableSeconds: billable };
  }, [entries]);

  // Agrupamento dos registros por tarefa ou por atividade/projeto
  const groupedEntries: GroupedTimeEntry[] = useMemo(() => {
    const groupsMap = new Map<string, GroupedTimeEntry>();

    for (const entry of entries) {
      // Prioridade 1: se vinculado a uma entidade (tarefa, milestone, etc.), agrupa pelo ID da entidade
      // Prioridade 2: agrupa pelo texto da descrição/título + ID do projeto
      const groupKey = entry.entityId
        ? `${entry.entityType || 'ENTITY'}:${entry.entityId}`
        : `DESC:${(entry.description || 'Sem descrição').trim().toLowerCase()}:${entry.projectId || 'none'}`;

      const existing = groupsMap.get(groupKey);
      const isRunning = !entry.endTime;
      const duration = entry.duration ?? 0;
      const opName = entry.user?.name || entry.user?.email || 'Operador';

      if (!existing) {
        groupsMap.set(groupKey, {
          key: groupKey,
          title: entry.description || entry.entityTitle || 'Sem descrição',
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityTitle: entry.entityTitle,
          projectId: entry.projectId,
          projectName: entry.project?.name,
          entries: [entry],
          totalDuration: duration,
          hasRunning: isRunning,
          hasForgotten: entry.isForgotten ?? false,
          hasManual: entry.isManual ?? false,
          latestStartTime: new Date(entry.startTime),
          operators: [opName],
        });
      } else {
        existing.entries.push(entry);
        existing.totalDuration += duration;
        if (isRunning) existing.hasRunning = true;
        if (entry.isForgotten) existing.hasForgotten = true;
        if (entry.isManual) existing.hasManual = true;
        if (!existing.operators.includes(opName)) {
          existing.operators.push(opName);
        }
        const entryStart = new Date(entry.startTime);
        if (entryStart > existing.latestStartTime) {
          existing.latestStartTime = entryStart;
        }
      }
    }

    // Ordena registros dentro de cada grupo do mais recente para o mais antigo
    for (const group of groupsMap.values()) {
      group.entries.sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );
    }

    // Ordena grupos: se algum tem timer em andamento fica no topo; senão, pelo registro mais recente
    return Array.from(groupsMap.values()).sort((a, b) => {
      if (a.hasRunning && !b.hasRunning) return -1;
      if (!a.hasRunning && b.hasRunning) return 1;
      return b.latestStartTime.getTime() - a.latestStartTime.getTime();
    });
  }, [entries]);

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllGroups = () => {
    const multiEntryKeys = groupedEntries.filter((g) => g.entries.length > 1).map((g) => g.key);
    if (expandedGroupKeys.size > 0) {
      setExpandedGroupKeys(new Set());
    } else {
      setExpandedGroupKeys(new Set(multiEntryKeys));
    }
  };

  const handleQuickStartGroup = async (group: GroupedTimeEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await startTimerMutation.mutateAsync({
        description: group.title,
        projectId: group.projectId || undefined,
        entityType: group.entityType || undefined,
        entityId: group.entityId || undefined,
        entityTitle: group.entityTitle || undefined,
        isBillable: true,
      });
    } catch (err) {
      console.error('[TimeTrackerPage] Erro ao reiniciar timer do grupo:', err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este registro de horas?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch {
        // Erro tratado via Collector
      }
    }
  };

  return (
    <Container variant="dataTable" border={false} className="space-y-6">
      <PageHeader
        title="Rastreamento de Tempo"
        description="Gerenciamento de horas trabalhadas, auditoria de lançamentos e controle de atividades por projeto."
      />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Tempo Total (Filtrado)</span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatDuration(totalSeconds)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Horas Faturáveis</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatDuration(billableSeconds)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Total de Entradas</span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {entries.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Agrupamento e Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou tarefa..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={selectedProjectId ?? 'all'}
            onValueChange={(val) => setSelectedProjectId(val === 'all' ? undefined : val)}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((proj: any) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Controle de Stacking / Agrupamento */}
          <div className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 bg-card text-xs">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Agrupar tarefas</span>
            <Switch
              checked={isGrouped}
              onCheckedChange={setIsGrouped}
              className="scale-75"
            />
          </div>

          {isGrouped && groupedEntries.some((g) => g.entries.length > 1) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllGroups}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span>{expandedGroupKeys.size > 0 ? 'Recolher todos' : 'Expandir todos'}</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <PlusCircle className="h-4 w-4" />
            Lançamento Manual
          </Button>

          <Button
            size="sm"
            onClick={() => setIsStartModalOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-4 w-4 fill-white" />
            Iniciar Cronômetro
          </Button>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Data / Horário</TableHead>
              <TableHead>Atividade / Vínculo</TableHead>
              <TableHead className="w-[160px]">Projeto</TableHead>
              <TableHead className="w-[130px]">Operador</TableHead>
              <TableHead className="w-[130px] text-right">Duração</TableHead>
              <TableHead className="w-[110px] text-center">Auditoria</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                  Carregando registros de horas...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                  Nenhum registro de horas encontrado no período.
                </TableCell>
              </TableRow>
            ) : !isGrouped ? (
              /* Modo Normal Desagrupado (Flat) */
              entries.map((entry) => renderSingleRow(entry))
            ) : (
              /* Modo Agrupado / Stacked com Collapse */
              groupedEntries.map((group) => {
                const isSingle = group.entries.length === 1;

                if (isSingle) {
                  // Se for entrada única, renderiza diretamente a linha individual
                  return renderSingleRow(group.entries[0]);
                }

                const isExpanded = expandedGroupKeys.has(group.key);
                const formattedDate = format(group.latestStartTime, "dd/MM/yyyy", { locale: ptBR });

                return (
                  <React.Fragment key={group.key}>
                    {/* Linha Pai do Grupo Stackado */}
                    <TableRow
                      onClick={() => toggleGroup(group.key)}
                      className={`cursor-pointer font-medium transition-colors select-none ${
                        group.hasForgotten ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      {/* Data / Horário com Chevron e Badge de Stack */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(group.key);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Badge
                            variant="secondary"
                            className="font-mono text-[10px] px-1.5 py-0 h-5 gap-1 font-semibold bg-muted-foreground/10"
                            title={`${group.entries.length} sessões agrupadas`}
                          >
                            <Layers className="h-3 w-3 text-muted-foreground" />
                            <span>{group.entries.length}</span>
                          </Badge>
                          <span className="text-muted-foreground text-[11px]">{formattedDate}</span>
                        </div>
                      </TableCell>

                      {/* Atividade / Vínculo */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground">
                            {group.title}
                          </span>
                          {group.entityType && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="font-medium px-1 py-0.2 rounded bg-muted">
                                {group.entityType}
                              </span>
                              {group.entityTitle && (
                                <span className="truncate max-w-[240px]">
                                  {group.entityTitle}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Projeto */}
                      <TableCell>
                        {group.projectName ? (
                          <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[140px]">
                            {group.projectName}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Avulso</span>
                        )}
                      </TableCell>

                      {/* Operadores */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <UserIcon className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[100px]">
                            {group.operators.length === 1
                              ? group.operators[0]
                              : `${group.operators.length} operadores`}
                          </span>
                        </div>
                      </TableCell>

                      {/* Duração Total Acumulada */}
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {group.hasRunning && (
                            <Badge className="bg-emerald-500 text-white animate-pulse text-[9px] px-1 py-0">
                              Em andamento
                            </Badge>
                          )}
                          <span className="font-mono text-xs font-bold text-foreground">
                            {formatDuration(group.totalDuration)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Auditoria do Grupo */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {group.hasForgotten && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-1 rounded bg-destructive/15 text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs font-semibold text-destructive">Timer esquecido</p>
                                <p className="text-[11px]">Uma ou mais sessões ultrapassaram o limite.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {group.hasManual && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                                  <FileEdit className="h-2.5 w-2.5" />
                                  Manual
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">Possui sessões editadas ou lançadas manualmente.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>

                      {/* Ação de Reiniciar Tarefa com 1 Clique */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={(e) => handleQuickStartGroup(group, e)}
                            title="Continuar cronômetro para esta tarefa"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Linhas Filhas Expandidas (Sub-itens indentados) */}
                    {isExpanded &&
                      group.entries.map((subEntry) =>
                        renderChildRow(subEntry, group.title),
                      )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <StartTimerModal open={isStartModalOpen} onOpenChange={setIsStartModalOpen} />
      <ManualEntryDialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen} />
      <EditTimeEntryDialog
        entry={editingEntry}
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
      />
    </Container>
  );

  // Renderiza uma linha filha indentada pertencente a um grupo expandido
  function renderChildRow(entry: TimeEntry, groupTitle: string) {
    const isRunning = !entry.endTime;
    const formattedDate = format(new Date(entry.startTime), "dd/MM/yyyy", { locale: ptBR });
    const startTimeStr = format(new Date(entry.startTime), 'HH:mm');
    const endTimeStr = entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Agora';

    return (
      <TableRow
        key={entry.id}
        className={`bg-muted/25 hover:bg-muted/40 transition-colors border-l-4 border-l-primary/40 ${
          entry.isForgotten ? 'bg-destructive/5 hover:bg-destructive/10' : ''
        }`}
      >
        {/* Horário específico da sessão com ícone de indentação */}
        <TableCell className="text-xs font-mono text-muted-foreground pl-8">
          <div className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-foreground">{formattedDate}</span>
              <span className="text-[10px] text-muted-foreground">
                {startTimeStr} - {endTimeStr}
              </span>
            </div>
          </div>
        </TableCell>

        {/* Detalhe ou observação da sessão */}
        <TableCell>
          <div className="text-xs text-muted-foreground">
            {entry.description && entry.description !== groupTitle ? (
              <span className="text-foreground">{entry.description}</span>
            ) : (
              <span className="text-[11px] italic text-muted-foreground">Sessão de trabalho</span>
            )}
          </div>
        </TableCell>

        {/* Projeto */}
        <TableCell>
          {entry.project ? (
            <Badge variant="outline" className="text-[9px] font-normal truncate max-w-[130px]">
              {entry.project.name}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Avulso</span>
          )}
        </TableCell>

        {/* Operador */}
        <TableCell className="text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
            <UserIcon className="h-3 w-3" />
            <span className="truncate max-w-[100px]">
              {entry.user?.name || entry.user?.email || 'Operador'}
            </span>
          </div>
        </TableCell>

        {/* Duração individual */}
        <TableCell className="text-right">
          {isRunning ? (
            <Badge className="bg-emerald-500 text-white animate-pulse text-[9px] px-1 py-0">
              Em andamento
            </Badge>
          ) : (
            <span className="font-mono text-xs font-medium text-foreground">
              {formatDuration(entry.duration)}
            </span>
          )}
        </TableCell>

        {/* Auditoria individual */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {entry.isForgotten && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-0.5 rounded bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-3 w-3 animate-pulse" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-semibold text-destructive">Timer esquecido</p>
                </TooltipContent>
              </Tooltip>
            )}

            {entry.isManual && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 gap-0.5">
                    <FileEdit className="h-2 w-2" />
                    Manual
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    Lançado manualmente
                    {entry.editedBy?.name ? ` por ${entry.editedBy.name}` : ''}.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {entry.isBillable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-0.5 rounded text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Atividade Faturável</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>

        {/* Ações de Edição e Exclusão para esta sessão específica */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setEditingEntry(entry);
              }}
              title="Editar sessão"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => handleDelete(entry.id, e)}
              title="Excluir sessão"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Renderiza uma linha avulsa / normal não agrupada
  function renderSingleRow(entry: TimeEntry) {
    const isRunning = !entry.endTime;
    const formattedDate = format(new Date(entry.startTime), "dd/MM/yyyy", { locale: ptBR });
    const startTimeStr = format(new Date(entry.startTime), 'HH:mm');
    const endTimeStr = entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Agora';

    return (
      <TableRow
        key={entry.id}
        className={entry.isForgotten ? 'bg-destructive/5 hover:bg-destructive/10' : ''}
      >
        {/* Data / Horário */}
        <TableCell className="text-xs font-medium">
          <div className="flex flex-col">
            <span>{formattedDate}</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {startTimeStr} - {endTimeStr}
            </span>
          </div>
        </TableCell>

        {/* Atividade / Vínculo */}
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              {entry.description || entry.entityTitle || 'Sem descrição'}
            </span>
            {entry.entityType && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-medium px-1 py-0.2 rounded bg-muted">
                  {entry.entityType}
                </span>
                {entry.entityTitle && (
                  <span className="truncate max-w-[240px]">
                    {entry.entityTitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </TableCell>

        {/* Projeto */}
        <TableCell>
          {entry.project ? (
            <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[140px]">
              {entry.project.name}
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">Avulso</span>
          )}
        </TableCell>

        {/* Operador */}
        <TableCell className="text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5" />
            <span className="truncate max-w-[100px]">
              {entry.user?.name || entry.user?.email || 'Operador'}
            </span>
          </div>
        </TableCell>

        {/* Duração */}
        <TableCell className="text-right">
          {isRunning ? (
            <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">
              Em andamento
            </Badge>
          ) : (
            <span className="font-mono text-xs font-bold text-foreground">
              {formatDuration(entry.duration)}
            </span>
          )}
        </TableCell>

        {/* Auditoria / Badges de Estado */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {entry.isForgotten && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-1 rounded bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-semibold text-destructive">Possível timer esquecido</p>
                  <p className="text-[11px]">Ultrapassou o limite operacional configurado.</p>
                </TooltipContent>
              </Tooltip>
            )}

            {entry.isManual && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                    <FileEdit className="h-2.5 w-2.5" />
                    Manual
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    Lançado ou editado manualmente
                    {entry.editedBy?.name ? ` por ${entry.editedBy.name}` : ''}.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {entry.isBillable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-0.5 rounded text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Atividade Faturável</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>

        {/* Ações */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await startTimerMutation.mutateAsync({
                    description: entry.description || entry.entityTitle || undefined,
                    projectId: entry.projectId || undefined,
                    entityType: entry.entityType || undefined,
                    entityId: entry.entityId || undefined,
                    entityTitle: entry.entityTitle || undefined,
                    isBillable: entry.isBillable ?? true,
                  });
                } catch {}
              }}
              title="Continuar este timer"
            >
              <Play className="h-3 w-3 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditingEntry(entry)}
              title="Editar lançamento"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => handleDelete(entry.id, e)}
              title="Excluir lançamento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }
}
