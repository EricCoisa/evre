import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCompanyApi = vi.hoisted(() => ({
  companyControllerFindAll: vi.fn(),
  companyControllerFindOne: vi.fn(),
  companyControllerCreate: vi.fn(),
  companyControllerUpdate: vi.fn(),
  companyControllerRemove: vi.fn(),
  companyControllerListContacts: vi.fn(),
  companyControllerCreateContact: vi.fn(),
  companyControllerUpdateContact: vi.fn(),
  companyControllerArchiveContact: vi.fn(),
  companyControllerListMembers: vi.fn(),
  companyControllerListInvites: vi.fn(),
  companyControllerAddMember: vi.fn(),
  companyControllerInviteMember: vi.fn(),
  companyControllerRemoveMember: vi.fn(),
}));

const mockCustomInstance = vi.hoisted(() => vi.fn());

vi.mock('@/lib/generated/company/company', () => ({
  getCompany: () => mockCompanyApi,
}));
vi.mock('@/lib/api/orval-instance', () => ({
  customInstance: mockCustomInstance,
}));

import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  archiveCompany,
  getCompanyContacts,
  createCompanyContact,
  updateCompanyContact,
  archiveCompanyContact,
  getCompanyMembers,
  getCompanyInvites,
  addCompanyMember,
  inviteCompanyMember,
  updateCompanyMember,
  removeCompanyMember,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCompanies', () => {
  it('lista empresas', async () => {
    mockCompanyApi.companyControllerFindAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    const result = await getCompanies();

    expect(result.success).toBe(true);
  });
});

describe('getCompany', () => {
  it('busca empresa por id', async () => {
    mockCompanyApi.companyControllerFindOne.mockResolvedValue({ id: 'c1', name: 'ACME' });

    const result = await getCompany('c1');

    expect(result.success).toBe(true);
    expect(mockCompanyApi.companyControllerFindOne).toHaveBeenCalledWith('c1');
  });
});

describe('createCompany', () => {
  it('cria empresa', async () => {
    mockCompanyApi.companyControllerCreate.mockResolvedValue({ id: 'c1' });

    const result = await createCompany({ name: 'ACME' });

    expect(result.success).toBe(true);
  });
});

describe('updateCompany', () => {
  it('atualiza empresa', async () => {
    mockCompanyApi.companyControllerUpdate.mockResolvedValue({ id: 'c1' });

    const result = await updateCompany('c1', { name: 'ACME v2' });

    expect(result.success).toBe(true);
    expect(mockCompanyApi.companyControllerUpdate).toHaveBeenCalledWith('c1', { name: 'ACME v2' });
  });
});

describe('archiveCompany', () => {
  it('arquiva empresa', async () => {
    mockCompanyApi.companyControllerRemove.mockResolvedValue({ id: 'c1' });

    const result = await archiveCompany('c1');

    expect(result.success).toBe(true);
  });
});

describe('getCompanyContacts', () => {
  it('lista contatos da empresa', async () => {
    mockCompanyApi.companyControllerListContacts.mockResolvedValue([]);

    const result = await getCompanyContacts('c1');

    expect(result.success).toBe(true);
    expect(mockCompanyApi.companyControllerListContacts).toHaveBeenCalledWith('c1');
  });
});

describe('createCompanyContact', () => {
  it('cria contato', async () => {
    mockCompanyApi.companyControllerCreateContact.mockResolvedValue({ id: 'ct1' });

    const result = await createCompanyContact('c1', { name: 'João', email: 'j@a.com' });

    expect(result.success).toBe(true);
  });
});

describe('updateCompanyContact', () => {
  it('atualiza contato', async () => {
    mockCompanyApi.companyControllerUpdateContact.mockResolvedValue({ id: 'ct1' });

    const result = await updateCompanyContact('c1', 'ct1', { name: 'João II' });

    expect(result.success).toBe(true);
    expect(mockCompanyApi.companyControllerUpdateContact).toHaveBeenCalledWith('c1', 'ct1', { name: 'João II' });
  });
});

describe('archiveCompanyContact', () => {
  it('arquiva contato', async () => {
    mockCompanyApi.companyControllerArchiveContact.mockResolvedValue({ id: 'ct1' });

    const result = await archiveCompanyContact('c1', 'ct1');

    expect(result.success).toBe(true);
  });
});

describe('getCompanyMembers', () => {
  it('lista membros da empresa', async () => {
    mockCompanyApi.companyControllerListMembers.mockResolvedValue({ data: [], meta: { total: 0 } });

    const result = await getCompanyMembers('c1');

    expect(result.success).toBe(true);
  });
});

describe('getCompanyInvites', () => {
  it('lista convites da empresa', async () => {
    mockCompanyApi.companyControllerListInvites.mockResolvedValue([]);

    const result = await getCompanyInvites('c1');

    expect(result.success).toBe(true);
  });
});

describe('addCompanyMember', () => {
  it('adiciona membro à empresa', async () => {
    mockCompanyApi.companyControllerAddMember.mockResolvedValue({});

    const result = await addCompanyMember('c1', { userId: 'u1' });

    expect(result.success).toBe(true);
  });
});

describe('inviteCompanyMember', () => {
  it('convida membro via link', async () => {
    mockCompanyApi.companyControllerInviteMember.mockResolvedValue({ id: 'inv1' });

    const result = await inviteCompanyMember('c1', { email: 'x@x.com' });

    expect(result.success).toBe(true);
  });
});

describe('updateCompanyMember', () => {
  it('atualiza membro via customInstance', async () => {
    mockCustomInstance.mockResolvedValue({});

    const result = await updateCompanyMember('c1', 'mbr1', { role: 'MEMBER' });

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('removeCompanyMember', () => {
  it('remove membro da empresa', async () => {
    mockCompanyApi.companyControllerRemoveMember.mockResolvedValue(undefined);

    const result = await removeCompanyMember('c1', 'mbr1');

    expect(result.success).toBe(true);
  });
});

describe('errors', () => {
  it('propaga falha como envelope de erro', async () => {
    mockCompanyApi.companyControllerFindOne.mockRejectedValue(new Error('boom'));

    const result = await getCompany('c1');

    expect(result.success).toBe(false);
  });
});
