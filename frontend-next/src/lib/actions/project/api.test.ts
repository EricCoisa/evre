import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProjectApi = vi.hoisted(() => ({
  projectControllerFindAll: vi.fn(),
  projectControllerFindOne: vi.fn(),
  projectControllerCreate: vi.fn(),
  projectControllerUpdate: vi.fn(),
  projectControllerRemove: vi.fn(),
  projectControllerBoard: vi.fn(),
  projectControllerAddMilestone: vi.fn(),
  projectControllerEditMilestone: vi.fn(),
  projectControllerDeleteMilestone: vi.fn(),
  projectControllerReorderMilestonesEndpoint: vi.fn(),
  projectControllerAddTask: vi.fn(),
  projectControllerEditTask: vi.fn(),
  projectControllerDeleteTask: vi.fn(),
  projectControllerMoveTaskEndpoint: vi.fn(),
  projectControllerReorderTasksEndpoint: vi.fn(),
  projectControllerAddComment: vi.fn(),
  projectControllerGetComments: vi.fn(),
  projectControllerRemoveComment: vi.fn(),
  projectControllerRequestMilestoneApproval: vi.fn(),
  projectControllerRespondMilestoneApproval: vi.fn(),
  projectControllerCancelMilestoneApproval: vi.fn(),
  projectControllerGetMilestoneApprovals: vi.fn(),
  projectControllerAddInfoRequest: vi.fn(),
  projectControllerAnswerInfoRequest: vi.fn(),
  projectControllerCancelInfoRequestEndpoint: vi.fn(),
  projectControllerGetInfoRequests: vi.fn(),
  projectControllerGetInfoRequestValue: vi.fn(),
  projectControllerGetMembers: vi.fn(),
}));

vi.mock('@/lib/generated/project/project', () => ({
  getProject: () => mockProjectApi,
}));

import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  getProjectBoard,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  reorderTasks,
  createComment,
  getComments,
  deleteComment,
  requestApproval,
  respondApproval,
  cancelApproval,
  getApprovals,
  createInfoRequest,
  answerInfoRequest,
  cancelInfoRequest,
  getInfoRequests,
  getInfoRequestValue,
  getProjectMembers,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProjects', () => {
  it('lista projetos com params de paginação', async () => {
    mockProjectApi.projectControllerFindAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    const result = await getProjects({ page: 1 });

    expect(result.success).toBe(true);
  });
});

describe('getProject', () => {
  it('busca projeto por id', async () => {
    mockProjectApi.projectControllerFindOne.mockResolvedValue({ id: 'p1', name: 'Proj' });

    const result = await getProject('p1');

    expect(result.success).toBe(true);
    expect(mockProjectApi.projectControllerFindOne).toHaveBeenCalledWith('p1');
  });
});

describe('createProject', () => {
  it('cria projeto com dados', async () => {
    mockProjectApi.projectControllerCreate.mockResolvedValue({ id: 'p1' });

    const result = await createProject({ name: 'Proj', description: '' });

    expect(result.success).toBe(true);
  });
});

describe('updateProject', () => {
  it('atualiza projeto por id', async () => {
    mockProjectApi.projectControllerUpdate.mockResolvedValue({ id: 'p1' });

    const result = await updateProject('p1', { name: 'Nova' });

    expect(result.success).toBe(true);
    expect(mockProjectApi.projectControllerUpdate).toHaveBeenCalledWith('p1', { name: 'Nova' });
  });
});

describe('archiveProject', () => {
  it('arquiva projeto por id', async () => {
    mockProjectApi.projectControllerRemove.mockResolvedValue({ id: 'p1' });

    const result = await archiveProject('p1');

    expect(result.success).toBe(true);
  });
});

describe('getProjectBoard', () => {
  it('retorna board do projeto', async () => {
    mockProjectApi.projectControllerBoard.mockResolvedValue([]);

    const result = await getProjectBoard('p1');

    expect(result.success).toBe(true);
  });
});

describe('createMilestone', () => {
  it('cria milestone', async () => {
    mockProjectApi.projectControllerAddMilestone.mockResolvedValue({ id: 'm1' });

    const result = await createMilestone('p1', { name: 'M1' });

    expect(result.success).toBe(true);
  });
});

describe('createTask', () => {
  it('cria task', async () => {
    mockProjectApi.projectControllerAddTask.mockResolvedValue({ id: 't1' });

    const result = await createTask('p1', 'm1', { name: 'T1' });

    expect(result.success).toBe(true);
    expect(mockProjectApi.projectControllerAddTask).toHaveBeenCalledWith('p1', 'm1', { name: 'T1' });
  });
});

describe('moveTask', () => {
  it('move task para milestone', async () => {
    mockProjectApi.projectControllerMoveTaskEndpoint.mockResolvedValue({ id: 't1' });

    const result = await moveTask('p1', 't1', { milestoneId: 'm2', position: 0 });

    expect(result.success).toBe(true);
  });
});

describe('createComment', () => {
  it('cria comentário', async () => {
    mockProjectApi.projectControllerAddComment.mockResolvedValue({ id: 'c1' });

    const result = await createComment('p1', { content: 'oi', entityType: 'TASK', entityId: 't1' });

    expect(result.success).toBe(true);
  });
});

describe('requestApproval', () => {
  it('solicita aprovação de milestone', async () => {
    mockProjectApi.projectControllerRequestMilestoneApproval.mockResolvedValue({ id: 'a1' });

    const result = await requestApproval('p1', 'm1');

    expect(result.success).toBe(true);
  });
});

describe('createInfoRequest', () => {
  it('cria info request', async () => {
    mockProjectApi.projectControllerAddInfoRequest.mockResolvedValue({ id: 'ir1' });

    const result = await createInfoRequest('p1', { question: 'Dúvida?' });

    expect(result.success).toBe(true);
  });
});

describe('getProjectMembers', () => {
  it('retorna membros do projeto', async () => {
    mockProjectApi.projectControllerGetMembers.mockResolvedValue([{ userId: 'u1' }]);

    const result = await getProjectMembers('p1');

    expect(result.success).toBe(true);
    expect(mockProjectApi.projectControllerGetMembers).toHaveBeenCalledWith('p1');
  });
});

describe('errors', () => {
  it('propaga falha como envelope de erro', async () => {
    mockProjectApi.projectControllerFindOne.mockRejectedValue(new Error('boom'));

    const result = await getProject('p1');

    expect(result.success).toBe(false);
  });
});
