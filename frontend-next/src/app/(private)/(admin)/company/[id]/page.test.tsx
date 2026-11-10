import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import CompanyDetailPage from './page';
import { getCompany } from '@/lib/actions/company/api';
import { getCurrentUser } from '@/lib/actions/auth/api';
import type { Company } from '@/lib/actions/company/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/company/api', () => ({
  getCompany: vi.fn(),
}));

vi.mock('@/lib/actions/auth/api', () => ({
  getCurrentUser: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/company/c1',
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('./components/company-config-tab', () => ({
  CompanyConfigTab: () => <div>config-tab-content</div>,
}));
vi.mock('./components/company-proposals-tab', () => ({
  CompanyProposalsTab: () => <div>proposals-tab-content</div>,
}));
vi.mock('../components/company-contacts-tab', () => ({
  CompanyContactsTab: () => <div>contacts-tab-content</div>,
}));
vi.mock('./components/company-projects-tab', () => ({
  CompanyProjectsTab: () => <div>projects-tab-content</div>,
}));
vi.mock('./components/company-members-tab', () => ({
  CompanyMembersTab: () => <div>members-tab-content</div>,
}));
vi.mock('./components/company-contracts-tab', () => ({
  CompanyContractsTab: () => <div>contracts-tab-content</div>,
}));

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Empresa',
    tradeName: null,
    taxId: null,
    site: null,
    segment: null,
    notes: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function renderPage() {
  vi.mocked(getCompany).mockResolvedValue({
    success: true,
    data: company(),
    message: '',
    status: 200,
    errors: undefined,
  });
  vi.mocked(getCurrentUser).mockResolvedValue({
    success: true,
    data: { id: 'u1', email: 'a@b.com', roleName: 'ADMIN' } as never,
    message: '',
    status: 200,
    errors: undefined,
  });
  const result = await CompanyDetailPage({ params: Promise.resolve({ id: 'c1' }) });
  render(result);
}

describe('/company/[id]', () => {
  it('renderiza as 6 abas: configuração, contatos, propostas, projetos, membros e contratos', async () => {
    mocks.searchParams = new URLSearchParams();
    await renderPage();

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['tabConfig', 'tabContacts', 'tabProposals', 'tabProjects', 'tabMembers', 'tabContracts']);
  });

  it('?tab=propostas abre direto na aba de propostas', async () => {
    mocks.searchParams = new URLSearchParams('tab=propostas');
    await renderPage();

    expect(screen.getByText('proposals-tab-content')).toBeInTheDocument();
    expect(screen.queryByText('config-tab-content')).not.toBeInTheDocument();
  });

  it('?tab=projetos abre direto na aba de projetos', async () => {
    mocks.searchParams = new URLSearchParams('tab=projetos');
    await renderPage();

    expect(screen.getByText('projects-tab-content')).toBeInTheDocument();
  });

  it('?tab=contratos abre direto na aba de contratos', async () => {
    mocks.searchParams = new URLSearchParams('tab=contratos');
    await renderPage();

    expect(screen.getByText('contracts-tab-content')).toBeInTheDocument();
  });
});
