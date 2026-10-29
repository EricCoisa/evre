import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { CompanyEdit } from './company-edit';
import type { Company } from '@/lib/actions/company/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateCompanyApi: vi.fn(),
}));

vi.mock('@/lib/actions/company/queries', () => ({
  useUpdateCompany: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock('@/lib/actions/company/api', () => ({
  updateCompany: mocks.updateCompanyApi,
}));

vi.mock('@/components/form/form-builder', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FormBuilder: (props: any) => (
    <button onClick={() => props.onSubmit({ name: 'Nova' })}>submit-form</button>
  ),
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

describe('CompanyEdit', () => {
  it('dispara o hook useUpdateCompany, não a api.ts direto (camada api.ts -> queries.ts -> componente)', async () => {
    render(<CompanyEdit company={company()} />);

    await userEvent.click(screen.getByText('submit-form'));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: 'c1', data: { name: 'Nova' } });
    expect(mocks.updateCompanyApi).not.toHaveBeenCalled();
  });
});
