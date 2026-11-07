import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTaskPath, copyTaskLink } from './task-link';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('task-link utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTaskPath', () => {
    it('retorna a rota unificada /project/[projectId]/[taskId]', () => {
      const path = getTaskPath('proj-123', 'task-456');
      expect(path).toBe('/project/proj-123/task-456');
    });
  });

  describe('copyTaskLink', () => {
    it('copia a URL canônica usando navigator.clipboard e dispara toast de sucesso', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const result = await copyTaskLink('proj-1', 'task-2');

      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/project/proj-1/task-2`);
      expect(toast.success).toHaveBeenCalledWith('Link da tarefa copiado!');
    });

    it('lida com falha e dispara toast de erro', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permissão negada')),
        },
      });

      const result = await copyTaskLink('proj-1', 'task-2');

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Erro ao copiar link');
    });
  });
});
