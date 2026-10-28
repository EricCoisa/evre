import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./actions/auth/api', () => ({ getCurrentUser: vi.fn() }));
vi.mock('./actions/feature-flag/api', () => ({ getMyFeatureFlags: vi.fn() }));
vi.mock('./actions/ai/api', () => ({ getAiHealth: vi.fn() }));
vi.mock('./actions/capability/api', () => ({ getCapabilities: vi.fn() }));

import {
  serverMe,
  serverFeatureFlags,
  serverFeatureFlag,
  serverAiHealth,
  serverCapabilities,
  serverCanAccessRoute,
} from './server-context';
import { getCurrentUser } from './actions/auth/api';
import { getMyFeatureFlags } from './actions/feature-flag/api';
import { getAiHealth } from './actions/ai/api';
import { getCapabilities } from './actions/capability/api';

describe('server-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serverMe returns the current user data on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ data: { id: 'u1' } } as never);

    await expect(serverMe()).resolves.toEqual({ id: 'u1' });
  });

  it('serverMe swallows a thrown error and returns null', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('down'));

    await expect(serverMe()).resolves.toBeNull();
  });

  it('serverFeatureFlags returns the backend data', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue({ data: { foo: true } } as never);

    await expect(serverFeatureFlags()).resolves.toEqual({ foo: true });
  });

  it('serverFeatureFlags falls back to an empty object when there is no data', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue({ data: undefined } as never);

    await expect(serverFeatureFlags()).resolves.toEqual({});
  });

  it('serverFeatureFlag reads a single key, defaulting to false when absent', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue({ data: { foo: true } } as never);

    await expect(serverFeatureFlag('foo')).resolves.toBe(true);
    await expect(serverFeatureFlag('missing')).resolves.toBe(false);
  });

  it('serverAiHealth returns the backend data or null', async () => {
    vi.mocked(getAiHealth).mockResolvedValue({ data: { operational: true } } as never);
    await expect(serverAiHealth()).resolves.toEqual({ operational: true });

    vi.mocked(getAiHealth).mockResolvedValue({ data: undefined } as never);
    await expect(serverAiHealth()).resolves.toBeNull();
  });

  it('serverCapabilities returns the backend data or an empty object', async () => {
    vi.mocked(getCapabilities).mockResolvedValue({ data: { storage: 'ready' } } as never);
    await expect(serverCapabilities()).resolves.toEqual({ storage: 'ready' });

    vi.mocked(getCapabilities).mockResolvedValue({ data: undefined } as never);
    await expect(serverCapabilities()).resolves.toEqual({});
  });

  it('serverCanAccessRoute is false when there is no current user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ data: null } as never);

    await expect(serverCanAccessRoute('/admin')).resolves.toBe(false);
  });

  it('serverCanAccessRoute checks the user routes for a matching path', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      data: { id: 'u1', routes: [{ path: '/admin' }, { path: '/home' }] },
    } as never);

    await expect(serverCanAccessRoute('/admin')).resolves.toBe(true);
    await expect(serverCanAccessRoute('/missing')).resolves.toBe(false);
  });
});
