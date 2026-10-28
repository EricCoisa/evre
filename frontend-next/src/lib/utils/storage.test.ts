import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/actions/storage/api', () => ({ getPresignedUrl: vi.fn() }));

import { getFileUrl } from './storage';
import { getPresignedUrl } from '@/lib/actions/storage/api';

describe('getFileUrl', () => {
  it('throws client-side, pointing callers at usePresignedUrl()', async () => {
    await expect(getFileUrl('some-key')).rejects.toThrow('usePresignedUrl');
  });

  it('resolves the presigned URL server-side', async () => {
    vi.mocked(getPresignedUrl).mockResolvedValue({ data: { url: 'https://x/file' } } as never);
    const originalWindow = globalThis.window;
    // @ts-expect-error simula execução no servidor
    delete globalThis.window;

    try {
      await expect(getFileUrl('some-key')).resolves.toBe('https://x/file');
    } finally {
      globalThis.window = originalWindow;
    }
    expect(getPresignedUrl).toHaveBeenCalledWith('some-key');
  });

  it('falls back to an empty string server-side when there is no url', async () => {
    vi.mocked(getPresignedUrl).mockResolvedValue({ data: undefined } as never);
    const originalWindow = globalThis.window;
    // @ts-expect-error simula execução no servidor
    delete globalThis.window;

    try {
      await expect(getFileUrl('some-key')).resolves.toBe('');
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
