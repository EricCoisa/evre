'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  AreaChart,
  BarChart,
  Columns,
  LineChart,
  List,
  MousePointerClick,
  Plus,
  Search,
  Table,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/cn';
import { BLOCK_META, isInlineBlockType, type BlockType } from '../blocks.meta';
import { LAYOUT_PROFILES } from '../profiles';
import { useEditorOrThrow } from './context';
import { isContainerType } from './mutations';

interface BlockDefinitionItem {
  type: BlockType;
  titleKey: string;
  defaultTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'charts' | 'content' | 'data' | 'structure';
  descriptionKey: string;
}

const BLOCK_DEFINITIONS: BlockDefinitionItem[] = [
  {
    type: 'chart.area',
    titleKey: 'blocks.chart.area',
    defaultTitle: 'Gráfico de Área',
    icon: AreaChart,
    category: 'charts',
    descriptionKey: 'Evolução de dados ao longo do tempo com preenchimento.',
  },
  {
    type: 'chart.line',
    titleKey: 'blocks.chart.line',
    defaultTitle: 'Gráfico de Linha',
    icon: LineChart,
    category: 'charts',
    descriptionKey: 'Tendências e variações de indicadores ao longo do tempo.',
  },
  {
    type: 'chart.bar',
    titleKey: 'blocks.chart.bar',
    defaultTitle: 'Gráfico de Barras',
    icon: BarChart,
    category: 'charts',
    descriptionKey: 'Comparação de valores discretos ou períodos.',
  },
  {
    type: 'table.basic',
    titleKey: 'blocks.table.basic',
    defaultTitle: 'Tabela de Dados',
    icon: Table,
    category: 'data',
    descriptionKey: 'Listagem tabular paginada com colunas personalizáveis.',
  },
  {
    type: 'list.feed',
    titleKey: 'blocks.list.feed',
    defaultTitle: 'Lista / Atividades Recentes',
    icon: List,
    category: 'data',
    descriptionKey: 'Feed compacto de itens e eventos recentes.',
  },
  {
    type: 'alert.banner',
    titleKey: 'blocks.alert.banner',
    defaultTitle: 'Alerta Informativo',
    icon: AlertCircle,
    category: 'content',
    descriptionKey: 'Aviso de destaque com ícone e mensagem rápida.',
  },
  {
    type: 'text.rich',
    titleKey: 'blocks.text.rich',
    defaultTitle: 'Texto Formatado (Rich Text)',
    icon: Type,
    category: 'content',
    descriptionKey: 'Bloco de texto livre com formatação, títulos, negrito e links.',
  },
  {
    type: 'button.action',
    titleKey: 'blocks.button.action',
    defaultTitle: 'Botão de Ação',
    icon: MousePointerClick,
    category: 'content',
    descriptionKey: 'Botão clicável com link e rótulo formatável para chamadas de ação.',
  },
  {
    type: 'group',
    titleKey: 'blocks.group',
    defaultTitle: 'Grupo de Colunas',
    icon: Columns,
    category: 'structure',
    descriptionKey: 'Caixa com colunas internas para agrupar blocos lado a lado.',
  },
];

export function BlockInserter({
  index = 0,
  gridSlot,
  parentId,
  alwaysVisible,
  className,
}: {
  /** Posição linear onde o novo bloco será inserido. */
  index?: number;
  /** Se informado, insere exatamente nas coordenadas (x, y) e largura (span) deste espaço livre. */
  gridSlot?: { x: number; y: number; span: number };
  /** Se informado, insere dentro deste container. */
  parentId?: string;
  /** Quando `true`, mantém o botão `+` visível (ex: no espaço livre abaixo de um Texto na mesma célula). */
  alwaysVisible?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const canAdd = editor.canAddTo(parentId);
  if (!canAdd) return null;

  const parentBlock = parentId
    ? editor.draft.blocks.find((b) => b.id === parentId)
    : undefined;
  const parentOnlyAcceptsInline =
    !!parentBlock && !isContainerType(parentBlock.type);

  const inProfile = new Set<string>(LAYOUT_PROFILES[editor.profile].blocks);

  const filteredBlocks = BLOCK_DEFINITIONS.filter((item) =>
    inProfile.has(item.type),
  ).filter((item) => {
    if (parentId && isContainerType(item.type)) return false;
    if (parentOnlyAcceptsInline && !isInlineBlockType(item.type)) return false;

    const query = search.trim().toLowerCase();
    if (!query) return true;
    const name = t(item.titleKey, { defaultValue: item.defaultTitle }).toLowerCase();
    const desc = (BLOCK_META[item.type]?.description || item.descriptionKey).toLowerCase();
    return name.includes(query) || desc.includes(query) || item.type.includes(query);
  });

  const handleSelect = (type: BlockType) => {
    if (gridSlot) {
      editor.insertAtGrid(type, gridSlot.x, gridSlot.y, gridSlot.span, parentId);
    } else {
      editor.insertAt(type, index, parentId);
    }
    setOpen(false);
    setSearch('');
  };

  return (
    <div
      className={cn(
        'group/inserter relative flex items-center justify-center transition-all',
        gridSlot ? 'h-full w-full' : 'col-span-full h-5',
        open && !gridSlot && 'z-30 h-8',
        className,
      )}
    >
      {/* Linha guia suave (apenas no modo de linha divisória) */}
      {!gridSlot && !alwaysVisible ? (
        <div
          className={cn(
            'absolute inset-x-4 h-0.5 bg-transparent transition-colors group-hover/inserter:bg-primary/40',
            open && 'bg-primary/50',
          )}
        />
      ) : null}

      {/* Botão de Adicionar (+) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={gridSlot || alwaysVisible ? 'sm' : 'icon'}
            className={cn(
              'border border-dashed border-primary/50 bg-background text-primary shadow-sm transition-all',
              gridSlot
                ? 'h-7 max-w-full gap-1 overflow-hidden rounded-full px-2 text-[11px] opacity-40 group-hover/slot:opacity-100 hover:opacity-100 hover:border-primary'
                : alwaysVisible
                  ? 'h-7 gap-1 rounded-full px-2.5 text-[11px] opacity-65 hover:opacity-100 hover:border-primary'
                : 'size-6 rounded-full opacity-0 group-hover/inserter:opacity-100 group-hover/inserter:scale-105',
              open && 'opacity-100 scale-105 border-primary ring-2 ring-primary/20',
            )}
            title={t('editor.addBlock', { defaultValue: 'Inserir bloco aqui' })}
            aria-label={t('editor.addBlock', { defaultValue: 'Inserir bloco aqui' })}
          >
            <Plus className="size-3.5" />
            {gridSlot && gridSlot.span >= 3 ? (
              <span className="truncate">{t('editor.addHere', { defaultValue: 'Adicionar aqui' })}</span>
            ) : alwaysVisible ? (
              <span>{t('editor.addHere', { defaultValue: 'Adicionar aqui' })}</span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-3 shadow-xl border rounded-xl"
          align="center"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" />
                <Input
                  autoFocus
                  placeholder={t('editor.searchBlocks', { defaultValue: 'Buscar bloco...' })}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {filteredBlocks.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  {t('editor.noBlocksFound', { defaultValue: 'Nenhum bloco encontrado' })}
                </p>
              ) : (
                filteredBlocks.map((item) => {
                  const Icon = item.icon;
                  const title = t(item.titleKey, { defaultValue: item.defaultTitle });
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleSelect(item.type)}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground group/item"
                    >
                      <div className="rounded-md border bg-muted/60 p-1.5 text-muted-foreground group-hover/item:border-primary/40 group-hover/item:text-primary transition-colors">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{title}</p>
                        <p className="text-muted-foreground line-clamp-1 text-[11px]">
                          {BLOCK_META[item.type]?.description || item.descriptionKey}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
