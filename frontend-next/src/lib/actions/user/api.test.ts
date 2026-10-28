import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUserApi = vi.hoisted(() => ({
  userControllerFindAll: vi.fn(),
  userControllerGetById: vi.fn(),
  userControllerSignup: vi.fn(),
  userControllerGetRoles: vi.fn(),
  userControllerGetStatus: vi.fn(),
  userControllerUpdate: vi.fn(),
  userControllerUpdateProfile: vi.fn(),
  userControllerUpdatePassword: vi.fn(),
  userControllerGetUserRoutes: vi.fn(),
  userControllerGetUserRoutesManagement: vi.fn(),
  userControllerExportMyData: vi.fn(),
  userControllerDeleteMyAccount: vi.fn(),
  userControllerRemoveUser: vi.fn(),
}));

const mockAuthApi = vi.hoisted(() => ({
  authControllerRegister: vi.fn(),
  authControllerGenerateInviteToken: vi.fn(),
  authControllerValidateInviteToken: vi.fn(),
  authControllerAcceptInvite: vi.fn(),
  authControllerGetInvites: vi.fn(),
  authControllerDeleteInvite: vi.fn(),
}));

const mockCustomInstance = vi.hoisted(() => vi.fn());

vi.mock('@/lib/generated/user/user', () => ({ getUser: () => mockUserApi }));
vi.mock('@/lib/generated/auth/auth', () => ({ getAuth: () => mockAuthApi }));
vi.mock('@/lib/api/orval-instance', () => ({ customInstance: mockCustomInstance }));

import {
  getUsers,
  getUser,
  signUp,
  completeEmailSignup,
  getRoles,
  getStatus,
  updateUser,
  updateProfile,
  updatePassword,
  getUserRoutes,
  getUserRoutesManagement,
  exportMyData,
  deleteMyAccount,
  deleteUser,
  createUser,
  createInvite,
  validateInvite,
  acceptInvite,
  getInvites,
  deleteInvite,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUsers', () => {
  it('normaliza os params de paginação e devolve envelope de sucesso', async () => {
    mockUserApi.userControllerFindAll.mockResolvedValue({ items: [], total: 0 });

    const result = await getUsers({ page: 1, limit: 10 });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('sem params: chama a API com undefined', async () => {
    mockUserApi.userControllerFindAll.mockResolvedValue([]);

    await getUsers();

    expect(mockUserApi.userControllerFindAll).toHaveBeenCalledWith(undefined);
  });

  it('propaga falha como envelope de erro', async () => {
    mockUserApi.userControllerFindAll.mockRejectedValue(new Error('boom'));

    const result = await getUsers();

    expect(result.success).toBe(false);
  });
});

describe('getUser', () => {
  it('busca por id', async () => {
    mockUserApi.userControllerGetById.mockResolvedValue({ id: 'u1', email: 'a@a.com' });

    const result = await getUser('u1');

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: 'u1' });
    expect(mockUserApi.userControllerGetById).toHaveBeenCalledWith('u1');
  });
});

describe('signUp', () => {
  it('envia dados de cadastro com o header de captcha', async () => {
    mockUserApi.userControllerSignup.mockResolvedValue({ accountCreated: true });

    const data = { email: 'a@a.com', password: 'secret', name: 'Ana' };
    const result = await signUp(data, 'captcha-tok');

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerSignup).toHaveBeenCalledWith(data, {
      headers: { 'x-captcha-token': 'captcha-tok' },
    });
  });

  it('sem captcha: header fica vazio', async () => {
    mockUserApi.userControllerSignup.mockResolvedValue({ accountCreated: false });

    await signUp({ email: 'a@a.com' });

    expect(mockUserApi.userControllerSignup).toHaveBeenCalledWith(
      { email: 'a@a.com' },
      { headers: {} },
    );
  });
});

describe('completeEmailSignup', () => {
  it('posta no endpoint de confirmação via customInstance', async () => {
    mockCustomInstance.mockResolvedValue(undefined);

    const data = { token: 'tok', password: 'secret', acceptTerms: true as const };
    const result = await completeEmailSignup(data, 'captcha-tok');

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith({
      url: '/user/signup/confirm',
      method: 'POST',
      data,
      headers: { 'x-captcha-token': 'captcha-tok' },
    });
  });
});

describe('getRoles', () => {
  it('lista roles', async () => {
    mockUserApi.userControllerGetRoles.mockResolvedValue([{ value: 'admin', label: 'Admin' }]);

    const result = await getRoles();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ value: 'admin', label: 'Admin' }]);
  });
});

describe('getStatus', () => {
  it('lista status', async () => {
    mockUserApi.userControllerGetStatus.mockResolvedValue([{ value: 'ACTIVE', label: 'Ativo' }]);

    const result = await getStatus();

    expect(result.success).toBe(true);
  });
});

describe('updateUser', () => {
  it('atualiza usuário por id', async () => {
    mockUserApi.userControllerUpdate.mockResolvedValue({ id: 'u1', email: 'a@a.com' });

    const result = await updateUser('u1', { email: 'a@a.com' });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerUpdate).toHaveBeenCalledWith('u1', { email: 'a@a.com' });
  });
});

describe('updateProfile', () => {
  it('sem imagem: usa o endpoint JSON com name/phone', async () => {
    mockUserApi.userControllerUpdateProfile.mockResolvedValue({ id: 'u1' });

    const result = await updateProfile('u1', { name: 'Ana', phone: '123' });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerUpdateProfile).toHaveBeenCalledWith('u1', {
      name: 'Ana',
      phone: '123',
    });
    expect(mockCustomInstance).not.toHaveBeenCalled();
  });

  it('com imagem: monta FormData e chama customInstance via PATCH', async () => {
    mockCustomInstance.mockResolvedValue({ id: 'u1' });
    const image = new File(['conteudo'], 'avatar.png', { type: 'image/png' });

    const result = await updateProfile('u1', { name: 'Ana', phone: '123', image });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerUpdateProfile).not.toHaveBeenCalled();
    expect(mockCustomInstance).toHaveBeenCalledTimes(1);

    const call = mockCustomInstance.mock.calls[0][0];
    expect(call.url).toBe('/user/u1/profile');
    expect(call.method).toBe('PATCH');
    expect(call.data).toBeInstanceOf(FormData);
    expect((call.data as FormData).get('name')).toBe('Ana');
    expect((call.data as FormData).get('phone')).toBe('123');
    expect((call.data as FormData).get('image')).toBe(image);
  });
});

describe('updatePassword', () => {
  it('troca a senha', async () => {
    mockUserApi.userControllerUpdatePassword.mockResolvedValue({ id: 'u1' });

    const data = { currentPassword: 'old', newPassword: 'new', confirmNewPassword: 'new' };
    const result = await updatePassword('u1', data);

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerUpdatePassword).toHaveBeenCalledWith('u1', data);
  });
});

describe('getUserRoutes', () => {
  it('normaliza params e busca as rotas do usuário', async () => {
    mockUserApi.userControllerGetUserRoutes.mockResolvedValue([]);

    await getUserRoutes('u1', { page: 1 });

    expect(mockUserApi.userControllerGetUserRoutes).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ page: 1 }),
    );
  });
});

describe('getUserRoutesManagement', () => {
  it('normaliza params e busca rotas de gestão', async () => {
    mockUserApi.userControllerGetUserRoutesManagement.mockResolvedValue([]);

    const result = await getUserRoutesManagement('u1', { limit: 5 });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerGetUserRoutesManagement).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ limit: 5 }),
    );
  });
});

describe('exportMyData', () => {
  it('embrulha o export em um Blob JSON', async () => {
    mockUserApi.userControllerExportMyData.mockResolvedValue({ foo: 'bar' });

    const result = await exportMyData();

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
    expect(result.data?.type).toBe('application/json');
  });
});

describe('deleteMyAccount', () => {
  it('envia a senha de confirmação', async () => {
    mockUserApi.userControllerDeleteMyAccount.mockResolvedValue(undefined);

    const result = await deleteMyAccount('minha-senha');

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerDeleteMyAccount).toHaveBeenCalledWith({ password: 'minha-senha' });
  });
});

describe('deleteUser', () => {
  it('remove usuário por id', async () => {
    mockUserApi.userControllerRemoveUser.mockResolvedValue(undefined);

    const result = await deleteUser('u1');

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerRemoveUser).toHaveBeenCalledWith('u1');
  });
});

describe('createUser', () => {
  it('registra usuário via authApi', async () => {
    mockAuthApi.authControllerRegister.mockResolvedValue({ user: { id: 'u1' } });

    const result = await createUser({ email: 'a@a.com', password: 'secret' });

    expect(result.success).toBe(true);
    expect(mockAuthApi.authControllerRegister).toHaveBeenCalledWith({ email: 'a@a.com', password: 'secret' });
  });
});

describe('createInvite', () => {
  it('gera link de convite', async () => {
    mockAuthApi.authControllerGenerateInviteToken.mockResolvedValue({ actionUrl: 'https://x/invite' });

    const result = await createInvite({ email: 'a@a.com' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ actionUrl: 'https://x/invite' });
  });
});

describe('validateInvite', () => {
  it('valida token de convite', async () => {
    mockAuthApi.authControllerValidateInviteToken.mockResolvedValue({ valid: true, token: 't', email: 'a@a.com', userExists: false });

    const result = await validateInvite('t');

    expect(result.success).toBe(true);
    expect(mockAuthApi.authControllerValidateInviteToken).toHaveBeenCalledWith({ token: 't' });
  });
});

describe('acceptInvite', () => {
  it('aceita convite com captcha', async () => {
    mockAuthApi.authControllerAcceptInvite.mockResolvedValue({ created: 'ROLE' });

    const result = await acceptInvite('t', 'captcha-tok');

    expect(result.success).toBe(true);
    expect(mockAuthApi.authControllerAcceptInvite).toHaveBeenCalledWith(
      { token: 't' },
      { headers: { 'x-captcha-token': 'captcha-tok' } },
    );
  });
});

describe('getInvites', () => {
  it('lista convites', async () => {
    mockAuthApi.authControllerGetInvites.mockResolvedValue([]);

    const result = await getInvites();

    expect(result.success).toBe(true);
  });
});

describe('deleteInvite', () => {
  it('remove convite por id', async () => {
    mockAuthApi.authControllerDeleteInvite.mockResolvedValue(undefined);

    const result = await deleteInvite('inv1');

    expect(result.success).toBe(true);
    expect(mockAuthApi.authControllerDeleteInvite).toHaveBeenCalledWith('inv1');
  });
});
