'use client';

import { useState } from 'react';
import { useArtifactPreviewUrl, usePublishArtifact } from '@/lib/actions/artifact/queries';
import type { Artifact } from '@/lib/actions/artifact/types';

/** Restrição da Meta para imagens de cabeçalho de template: JPEG/PNG/WEBP, ≤5 MB, 1.91:1. */
export const WHATSAPP_HEADER_IMAGE_FILTER = (a: Artifact) =>
  a.kind === 'FILE' && typeof a.contentType === 'string' && a.contentType.startsWith('image/');

export const WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS = {
  maxSizeBytes: 5_000_000,
  aspectRatio: { width: 191, height: 100, tolerancePct: 0.15 },
  accept: 'image/jpeg,image/png,image/webp',
};

/**
 * Gerencia o ciclo de vida de uma imagem de cabeçalho de template WhatsApp:
 * seleção via ArtifactPicker, preview autenticado e publicação antes do envio/submissão.
 */
export function useTemplateHeaderImage() {
  const publishArtifact = usePublishArtifact();
  const [draftArtifact, setDraftArtifact] = useState<Artifact | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: previewData } = useArtifactPreviewUrl(draftArtifact?.id);

  async function resolveUrl(): Promise<string> {
    if (!draftArtifact) throw new Error('no artifact selected');
    const target =
      draftArtifact.published && draftArtifact.publicToken
        ? draftArtifact
        : await publishArtifact.mutateAsync({ id: draftArtifact.id, isPublic: true });
    return `${window.location.origin}/api/artifacts/public/${target.publicToken}`;
  }

  return {
    draftArtifact,
    setDraftArtifact,
    pickerOpen,
    setPickerOpen,
    confirmOpen,
    setConfirmOpen,
    previewUrl: previewData?.url,
    isPending: publishArtifact.isPending,
    publishArtifact,
    resolveUrl,
    needsPublishConfirm:
      !!draftArtifact && !(draftArtifact.published && draftArtifact.publicToken),
  };
}
