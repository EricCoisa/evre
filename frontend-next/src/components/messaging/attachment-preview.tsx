'use client';

import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

/** Arquivo escolhido e ainda não enviado. `asDocument` força o envio como arquivo, sem pré-visualização no WhatsApp. */
export interface Attachment {
  file: File;
  asDocument: boolean;
}

export function AttachmentPreview({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const { t } = useTranslation('messaging');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = !attachment.asDocument && attachment.file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(attachment.file);
    // URL de objeto é um recurso externo: criar e revogar precisa estar atrelado ao ciclo do efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file, isImage]);

  return (
    <div className="mb-2 flex items-center gap-3 rounded-md border bg-background p-2">
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
        <img src={previewUrl} alt={attachment.file.name} className="size-14 rounded object-cover" />
      ) : (
        <FileText className="size-10 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">{attachment.file.name}</span>
      <Button type="button" size="icon" variant="ghost" aria-label={t('removeAttachment')} onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}
