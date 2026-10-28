import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/appProvider';
import { logout, refresh } from '@/lib/actions/auth/auth-action';
import { errorStatus, Alive, Collector, EmulateMutationError } from './collector';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
// Sobrescreve o mock parcial do test-setup global (só tinha `refresh`) — Alive também chama `logout`.
vi.mock('@/lib/actions/auth/auth-action', () => ({ refresh: vi.fn(), logout: vi.fn() }));

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}
function fail(status: number, message = 'deu erro') {
  return { success: false, data: null, message, status } as const;
}

describe('errorStatus', () => {
  it('reads the status from an error-shaped object', () => {
    expect(errorStatus({ status: 404 })).toBe(404);
  });

  it('returns undefined for null', () => {
    expect(errorStatus(null)).toBeUndefined();
  });

  it('returns undefined for a non-object error', () => {
    expect(errorStatus('boom')).toBeUndefined();
  });

  it('returns undefined when the object has no status field', () => {
    expect(errorStatus({ message: 'boom' })).toBeUndefined();
  });
});

describe('Alive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves with the payload on success', async () => {
    const action = vi.fn().mockResolvedValue(ok({ id: 1 }));
    await expect(Alive(action)()).resolves.toEqual({ id: 1 });
  });

  it('does not invoke the action during the caller\'s synchronous pass (deferred past the current render)', async () => {
    const action = vi.fn().mockResolvedValue(ok('pronto'));

    const promise = Alive(action)();
    expect(action).not.toHaveBeenCalled();

    await expect(promise).resolves.toBe('pronto');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('toasts and throws with the status stamped on the error for a non-401 failure', async () => {
    const action = vi.fn().mockResolvedValue(fail(500, 'falhou geral'));

    await expect(Alive(action)()).rejects.toMatchObject({ message: 'falhou geral', status: 500 });
    expect(toast.error).toHaveBeenCalledWith('falhou geral');
  });

  it('does not toast when the failing status is in silentStatuses', async () => {
    const action = vi.fn().mockResolvedValue(fail(404, 'não achei'));

    await expect(Alive(action, { silentStatuses: [404] })()).rejects.toMatchObject({ status: 404 });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('refreshes once and retries on a 401, returning the retried payload without toasting the first failure', async () => {
    const action = vi.fn()
      .mockResolvedValueOnce(fail(401, 'Unauthorized'))
      .mockResolvedValueOnce(ok({ retried: true }));
    vi.mocked(refresh).mockResolvedValue(undefined);

    await expect(Alive(action)('arg1')).resolves.toEqual({ retried: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenNthCalledWith(2, 'arg1');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('treats an "Unauthorized" message as a 401 even without the numeric status', async () => {
    const action = vi.fn()
      .mockResolvedValueOnce(fail(0, 'Unauthorized'))
      .mockResolvedValueOnce(ok('fresh'));
    vi.mocked(refresh).mockResolvedValue(undefined);

    await expect(Alive(action)()).resolves.toBe('fresh');
  });

  it('logs out and rejects when the refresh itself fails', async () => {
    const action = vi.fn().mockResolvedValue(fail(401, 'Unauthorized'));
    vi.mocked(refresh).mockRejectedValue(new Error('refresh down'));

    await expect(Alive(action)()).rejects.toThrow('Sessão expirada');
    expect(logout).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Sessão expirada. Faça login novamente.');
  });

  it('toasts and rejects when the retried call still fails after a successful refresh', async () => {
    const action = vi.fn()
      .mockResolvedValueOnce(fail(401, 'Unauthorized'))
      .mockResolvedValueOnce(fail(403, 'ainda sem acesso'));
    vi.mocked(refresh).mockResolvedValue(undefined);

    await expect(Alive(action)()).rejects.toMatchObject({ status: 403 });
    expect(toast.error).toHaveBeenCalledWith('ainda sem acesso');
    expect(logout).not.toHaveBeenCalled();
  });

  it('wraps a thrown Error from the action, toasting its message', async () => {
    const action = vi.fn().mockRejectedValue(new Error('rede caiu'));

    await expect(Alive(action)()).rejects.toThrow('rede caiu');
    expect(toast.error).toHaveBeenCalledWith('rede caiu');
  });

  it('wraps a non-Error throw (plain object with message) into an Error', async () => {
    const action = vi.fn().mockRejectedValue({ message: 'objeto esquisito' });

    await expect(Alive(action)()).rejects.toThrow('objeto esquisito');
  });

  it('wraps a totally unstructured throw by stringifying it', async () => {
    const action = vi.fn().mockRejectedValue(42);

    await expect(Alive(action)()).rejects.toThrow('42');
  });

  it('falls back to a generic message when the failure response carries none', async () => {
    const action = vi.fn().mockResolvedValue({ success: false, data: null, message: '', status: 500 });

    await expect(Alive(action)()).rejects.toThrow('Erro desconhecido');
  });
});

describe('Collector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits with an emulated error and never calls the real action', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as unknown as ReturnType<typeof useApp>);
    const action = vi.fn();

    const { result } = renderHook(() => Collector(action));

    await expect(result.current()).rejects.toThrow('Emulated error from Collector');
    expect(action).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from Collector');
  });

  it('delegates to the real action (through Alive) when not emulating errors', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: false } as unknown as ReturnType<typeof useApp>);
    const action = vi.fn().mockResolvedValue(ok('dado real'));

    const { result } = renderHook(() => Collector(action));

    await expect(result.current()).resolves.toBe('dado real');
  });
});

describe('EmulateMutationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts and throws when emulating an error', () => {
    expect(() => EmulateMutationError<void>(true, 'falha simulada')).toThrow('falha simulada');
    expect(toast.error).toHaveBeenCalledWith('falha simulada');
  });

  it('returns undefined without side effects when not emulating', () => {
    expect(EmulateMutationError<string | undefined>(false)).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
