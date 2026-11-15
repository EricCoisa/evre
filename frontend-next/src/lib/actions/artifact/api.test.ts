import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockArtifactApi = vi.hoisted(() => ({
  artifactControllerList: vi.fn(),
  artifactControllerArchive: vi.fn(),
}));

const mockCustomInstance = vi.hoisted(() => vi.fn());

vi.mock('@/lib/generated/artifact/artifact', () => ({
  getArtifact: () => mockArtifactApi,
}));
vi.mock('@/lib/api/orval-instance', () => ({
  customInstance: mockCustomInstance,
}));

import {
  getArtifacts,
  archiveArtifact,
  deleteArtifactPermanently,
  getArtifactPreviewUrl,
  publishArtifact,
  updateArtifact,
  uploadArtifact,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getArtifacts', () => {
  it('lista artefatos', async () => {
    mockArtifactApi.artifactControllerList.mockResolvedValue({ data: [], meta: { total: 0 } });

    const result = await getArtifacts();

    expect(result.success).toBe(true);
  });
});

describe('archiveArtifact', () => {
  it('arquiva artefato por id', async () => {
    mockArtifactApi.artifactControllerArchive.mockResolvedValue({ id: 'a1', archived: true });

    const result = await archiveArtifact('a1');

    expect(result.success).toBe(true);
    expect(mockArtifactApi.artifactControllerArchive).toHaveBeenCalledWith('a1');
  });
});

describe('deleteArtifactPermanently', () => {
  it('deleta permanentemente via customInstance', async () => {
    mockCustomInstance.mockResolvedValue({ id: 'a1' });

    const result = await deleteArtifactPermanently('a1');

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('getArtifactPreviewUrl', () => {
  it('retorna URL de preview via customInstance', async () => {
    mockCustomInstance.mockResolvedValue({ url: 'https://s3/preview' });

    const result = await getArtifactPreviewUrl('a1');

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('publishArtifact', () => {
  it('publica artefato via customInstance', async () => {
    mockCustomInstance.mockResolvedValue({ id: 'a1', published: true });

    const result = await publishArtifact('a1', { published: true, public: false });

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', data: { published: true, public: false } }),
    );
  });
});

describe('updateArtifact', () => {
  it('atualiza nome do artefato', async () => {
    mockCustomInstance.mockResolvedValue({ id: 'a1', name: 'Novo Nome' });

    const result = await updateArtifact('a1', { name: 'Novo Nome' });

    expect(result.success).toBe(true);
  });
});

describe('uploadArtifact', () => {
  it('envia arquivo via customInstance com FormData', async () => {
    mockCustomInstance.mockResolvedValue({ id: 'a1' });
    const file = new File(['<html></html>'], 'index.html', { type: 'text/html' });

    const result = await uploadArtifact(file, 'Meu Site');

    expect(result.success).toBe(true);
    const call = mockCustomInstance.mock.calls[0][0] as { method: string; data: FormData };
    expect(call.method).toBe('POST');
    expect(call.data).toBeInstanceOf(FormData);
    expect((call.data as FormData).get('name')).toBe('Meu Site');
  });
});

describe('errors', () => {
  it('propaga falha como envelope de erro', async () => {
    mockArtifactApi.artifactControllerList.mockRejectedValue(new Error('boom'));

    const result = await getArtifacts();

    expect(result.success).toBe(false);
  });
});
