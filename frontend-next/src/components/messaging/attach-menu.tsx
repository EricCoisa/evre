'use client';

import { useRef } from 'react';
import { FileText, Image as ImageIcon, LayoutTemplate, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';

/** Clipe do WhatsApp Web: documento, fotos e vídeos, e template. Cada item aparece só se o provider o suporta. */
export function AttachMenu({
  canPickDocument,
  canPickMedia,
  canTemplate,
  disabled,
  onPick,
  onTemplate,
}: {
  canPickDocument: boolean;
  canPickMedia: boolean;
  canTemplate: boolean;
  disabled: boolean;
  /** `asDocument`: enviar como arquivo, sem pré-visualização. */
  onPick: (file: File | undefined, asDocument: boolean) => void;
  onTemplate: () => void;
}) {
  const { t } = useTranslation('messaging');
  const mediaInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const fileInput = (
    ref: React.RefObject<HTMLInputElement | null>,
    testId: string,
    asDocument: boolean,
    accept?: string,
  ) => (
    <input
      ref={ref}
      type="file"
      hidden
      data-testid={testId}
      accept={accept}
      onChange={(event) => {
        onPick(event.target.files?.[0], asDocument);
        // Sem limpar, escolher o mesmo arquivo de novo não dispara `change`.
        event.target.value = '';
      }}
    />
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('attach')}
            disabled={disabled || (!canPickMedia && !canPickDocument && !canTemplate)}
          >
            <Paperclip />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {canPickDocument && (
            <DropdownMenuItem onSelect={() => documentInput.current?.click()}>
              <FileText /> {t('attachDocument')}
            </DropdownMenuItem>
          )}
          {canPickMedia && (
            <DropdownMenuItem onSelect={() => mediaInput.current?.click()}>
              <ImageIcon /> {t('attachMedia')}
            </DropdownMenuItem>
          )}
          {canTemplate && (
            <DropdownMenuItem onSelect={onTemplate}>
              <LayoutTemplate /> {t('template')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {fileInput(mediaInput, 'media-input', false, 'image/*,video/*')}
      {fileInput(documentInput, 'document-input', true)}
    </>
  );
}
