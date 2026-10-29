'use client';

import React from 'react';
import {
  Check,
  Eye,
  Redo2,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { useEditorOrThrow } from './context';

export function EditorTopBar({
  pageKey,
  dirty,
  saving,
  onSave,
  onSaveAsDefault,
  onCancel,
  onOpenPanel,
  onPreview,
}: {
  pageKey: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onSaveAsDefault?: () => void;
  onCancel: () => void;
  onOpenPanel?: () => void;
  onPreview?: () => void;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-xs">
        {/* Lado Esquerdo: Identificação */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight">{t('editor.title', { defaultValue: 'Editor de Página' })}</span>
            <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
              {pageKey}
            </Badge>
          </div>
        </div>

        {/* Centro: Desfazer e Refazer (Histórico estilo Excalidraw) */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                disabled={!editor.canUndo}
                onClick={editor.undo}
                aria-label="Desfazer"
              >
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Desfazer (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                disabled={!editor.canRedo}
                onClick={editor.redo}
                aria-label="Refazer"
              >
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Refazer (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Lado Direito: Ações de Salvar e Sair */}
        <div className="flex items-center gap-2">
          {onOpenPanel ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenPanel}
                  className="h-8 gap-1.5 text-xs"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span className="hidden sm:inline">Propriedades</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Abrir painel de propriedades</p>
              </TooltipContent>
            </Tooltip>
          ) : null}

          {onSaveAsDefault ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveAsDefault}
              disabled={saving}
              className="h-8 text-xs hidden md:inline-flex"
              aria-label="Publicar como padrão"
            >
              {t('editor.saveAsDefault', { defaultValue: 'Definir como Padrão' })}
            </Button>
          ) : null}

          {onPreview ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPreview}
                  className="h-8 gap-1.5 text-xs"
                  aria-label={t('editor.preview')}
                >
                  <Eye className="size-3.5" />
                  <span className="hidden sm:inline">{t('editor.preview')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{t('editor.previewTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={!dirty || saving}
            className="h-8 gap-1.5 px-3 text-xs"
            aria-label="Salvar alterações"
          >
            <Check className="size-3.5" />
            <span>{saving ? t('editor.saving') : t('editor.save')}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={saving}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Fechar editor"
            aria-label="Fechar editor"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
