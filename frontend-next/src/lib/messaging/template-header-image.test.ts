import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockUsePublishArtifact = vi.hoisted(() => vi.fn());
const mockUseArtifactPreviewUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/artifact/queries', () => ({
  usePublishArtifact: mockUsePublishArtifact,
  useArtifactPreviewUrl: mockUseArtifactPreviewUrl,
}));

import {
  WHATSAPP_HEADER_IMAGE_FILTER,
  WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS,
  useTemplateHeaderImage,
} from './template-header-image';

beforeEach(() => {
  mockUsePublishArtifact.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  mockUseArtifactPreviewUrl.mockReturnValue({ data: null });
  vi.clearAllMocks();
});

describe('WHATSAPP_HEADER_IMAGE_FILTER', () => {
  it('aceita artefato FILE com contentType de imagem', () => {
    expect(WHATSAPP_HEADER_IMAGE_FILTER({ kind: 'FILE', contentType: 'image/jpeg' } as never)).toBe(true);
  });

  it('rejeita artefato que não é FILE', () => {
    expect(WHATSAPP_HEADER_IMAGE_FILTER({ kind: 'LINK', contentType: 'image/jpeg' } as never)).toBe(false);
  });

  it('rejeita artefato FILE sem contentType', () => {
    expect(WHATSAPP_HEADER_IMAGE_FILTER({ kind: 'FILE', contentType: undefined } as never)).toBe(false);
  });

  it('rejeita artefato FILE com contentType que não é imagem', () => {
    expect(WHATSAPP_HEADER_IMAGE_FILTER({ kind: 'FILE', contentType: 'application/pdf' } as never)).toBe(false);
  });
});

describe('WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS', () => {
  it('tem maxSizeBytes de 5 MB', () => {
    expect(WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS.maxSizeBytes).toBe(5_000_000);
  });

  it('tem a proporção 191:100 (≈1.91:1)', () => {
    const { width, height } = WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS.aspectRatio;
    expect(width / height).toBeCloseTo(1.91, 1);
  });
});

describe('useTemplateHeaderImage', () => {
  it('inicia com draftArtifact=null e pickerOpen=false', () => {
    const { result } = renderHook(() => useTemplateHeaderImage());
    expect(result.current.draftArtifact).toBeNull();
    expect(result.current.pickerOpen).toBe(false);
  });

  it('needsPublishConfirm=false quando não há rascunho', () => {
    const { result } = renderHook(() => useTemplateHeaderImage());
    expect(result.current.needsPublishConfirm).toBe(false);
  });

  it('needsPublishConfirm=true quando artefato não está publicado', () => {
    const { result } = renderHook(() => useTemplateHeaderImage());
    act(() => {
      result.current.setDraftArtifact({ id: 'a1', published: false } as never);
    });
    expect(result.current.needsPublishConfirm).toBe(true);
  });

  it('needsPublishConfirm=false quando artefato já está publicado com token', () => {
    const { result } = renderHook(() => useTemplateHeaderImage());
    act(() => {
      result.current.setDraftArtifact({ id: 'a1', published: true, publicToken: 'tok' } as never);
    });
    expect(result.current.needsPublishConfirm).toBe(false);
  });

  it('resolveUrl lança erro quando não há rascunho selecionado', async () => {
    const { result } = renderHook(() => useTemplateHeaderImage());
    await expect(result.current.resolveUrl()).rejects.toThrow('no artifact selected');
  });

  it('resolveUrl usa o token existente quando artefato já está publicado', async () => {
    vi.stubGlobal('location', { origin: 'https://app.test' });
    const { result } = renderHook(() => useTemplateHeaderImage());
    act(() => {
      result.current.setDraftArtifact({ id: 'a1', published: true, publicToken: 'abc123' } as never);
    });
    const url = await result.current.resolveUrl();
    expect(url).toBe('https://app.test/api/artifacts/public/abc123');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('resolveUrl publica o artefato quando ele ainda não está publicado', async () => {
    vi.stubGlobal('location', { origin: 'https://app.test' });
    mockMutateAsync.mockResolvedValue({ id: 'a1', published: true, publicToken: 'newtoken' });
    const { result } = renderHook(() => useTemplateHeaderImage());
    act(() => {
      result.current.setDraftArtifact({ id: 'a1', published: false } as never);
    });
    const url = await result.current.resolveUrl();
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'a1', isPublic: true });
    expect(url).toBe('https://app.test/api/artifacts/public/newtoken');
  });

  it('previewUrl vem de useArtifactPreviewUrl', () => {
    mockUseArtifactPreviewUrl.mockReturnValue({ data: { url: 'https://cdn/preview.jpg' } });
    const { result } = renderHook(() => useTemplateHeaderImage());
    expect(result.current.previewUrl).toBe('https://cdn/preview.jpg');
  });
});
