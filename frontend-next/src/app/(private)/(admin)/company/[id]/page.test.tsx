import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyDetailPage from './page';
import { getCompany } from '@/lib/actions/company/api';
import type { Company } from '@/lib/actions/company/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/company/api', () => ({
  getCompany: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/company/c1',
  useSearchParams: () => mocks.searchParams,
}));

// Config e propostas carregam DataTable/FormBuilder reais — mockados aqui, cobertos nos próprios
// arquivos de teste (company-edit.test.tsx, company-proposals-tab.test.tsx).
vi.mock('./components/company-config-tab', () => ({
  CompanyConfigTab: () => <div>config-tab-content</div>,
}));
vi.mock('./components/company-proposals-tab', () => ({
  CompanyProposalsTab: () => <div>proposals-tab-content</div>,
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
  const result = await CompanyDetailPage({ params: Promise.resolve({ id: 'c1' }) });
  render(result);
}

describe('/company/[id]', () => {
  it('renderiza as 4 abas: configuração, propostas, projetos e contratos', async () => {
    mocks.searchParams = new URLSearchParams();
    await renderPage();

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['tabConfig', 'tabProposals', 'tabProjects', 'tabContracts']);
  });

  it('?tab=propostas abre direto na aba de propostas', async () => {
    mocks.searchParams = new URLSearchParams('tab=propostas');
    await renderPage();

    expect(screen.getByText('proposals-tab-content')).toBeInTheDocument();
    expect(screen.queryByText('config-tab-content')).not.toBeInTheDocument();
  });

  it('aba projetos mostra estado vazio explícito — Project só nasce em F2', async () => {
    mocks.searchParams = new URLSearchParams('tab=projetos');
    await renderPage();

    expect(screen.getByText('projectsEmpty')).toBeInTheDocument();
  });

  it('aba contratos mostra estado vazio explícito — Contract só nasce em F2', async () => {
    mocks.searchParams = new URLSearchParams('tab=contratos');
    await renderPage();

    expect(screen.getByText('contractsEmpty')).toBeInTheDocument();
  });
});
