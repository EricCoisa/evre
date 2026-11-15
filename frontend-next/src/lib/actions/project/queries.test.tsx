import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  getProjectBoard: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  reorderMilestones: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
  reorderTasks: vi.fn(),
  createComment: vi.fn(),
  getComments: vi.fn(),
  deleteComment: vi.fn(),
  requestApproval: vi.fn(),
  respondApproval: vi.fn(),
  cancelApproval: vi.fn(),
  getApprovals: vi.fn(),
  createInfoRequest: vi.fn(),
  answerInfoRequest: vi.fn(),
  cancelInfoRequest: vi.fn(),
  getInfoRequests: vi.fn(),
  getInfoRequestValue: vi.fn(),
  getProjectMembers: vi.fn(),
}));
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: () => unknown) => fn,
  Alive: (fn: () => unknown) => fn,
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import { getProjects, getProject, createProject, getProjectMembers } from './api';
import { useProjects, useProject, useCreateProject, useProjectMembers } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useProjects', () => {
  it('lista projetos', async () => {
    vi.mocked(getProjects).mockResolvedValue(ok([{ id: 'p1' }]) as never);

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProjects).toHaveBeenCalledWith(undefined);
  });
});

describe('useProject', () => {
  it('busca projeto quando id é não-vazio', async () => {
    vi.mocked(getProject).mockResolvedValue(ok({ id: 'p1' }) as never);

    const { result } = renderHook(() => useProject('p1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProject).toHaveBeenCalledWith('p1');
  });

  it('não busca quando id é vazio (enabled: false)', () => {
    const { result } = renderHook(() => useProject(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe('useCreateProject', () => {
  it('cria projeto e invalida a query de projetos', async () => {
    vi.mocked(createProject).mockResolvedValue(ok({ id: 'p1' }) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ name: 'Proj', description: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });
});

describe('useProjectMembers', () => {
  it('busca membros quando projectId é não-vazio', async () => {
    vi.mocked(getProjectMembers).mockResolvedValue(ok([{ userId: 'u1' }]) as never);

    const { result } = renderHook(() => useProjectMembers('p1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProjectMembers).toHaveBeenCalledWith('p1');
  });
});
