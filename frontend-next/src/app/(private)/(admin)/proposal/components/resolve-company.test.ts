import { describe, expect, it, vi } from 'vitest';
import { resolveOrCreateCompanyId } from './resolve-company';
import type { Company } from '@/lib/actions/company/types';

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Acme',
    tradeName: null,
    taxId: null,
    site: null,
    segment: null,
    notes: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Company;
}

describe('resolveOrCreateCompanyId', () => {
  it('usa o id da empresa existente quando o nome casa (sem diferenciar caixa)', async () => {
    const createCompany = vi.fn();
    const id = await resolveOrCreateCompanyId('acme', [company({ id: 'c1', name: 'Acme' })], createCompany);

    expect(id).toBe('c1');
    expect(createCompany).not.toHaveBeenCalled();
  });

  it('cria uma empresa nova quando o texto não casa com nenhuma existente', async () => {
    const createCompany = vi
      .fn()
      .mockResolvedValue({ success: true, data: company({ id: 'c-new', name: 'Empresa Nova' }) });

    const id = await resolveOrCreateCompanyId('Empresa Nova', [company({ id: 'c1', name: 'Acme' })], createCompany);

    expect(createCompany).toHaveBeenCalledWith('Empresa Nova');
    expect(id).toBe('c-new');
  });

  it('nada é porta: criação falhando devolve undefined em vez de travar a proposta', async () => {
    const createCompany = vi.fn().mockResolvedValue({ success: false, data: null });

    const id = await resolveOrCreateCompanyId('Empresa Nova', [], createCompany);

    expect(id).toBeUndefined();
  });

  it('texto vazio não cria nem resolve nada', async () => {
    const createCompany = vi.fn();
    const id = await resolveOrCreateCompanyId('   ', [], createCompany);

    expect(id).toBeUndefined();
    expect(createCompany).not.toHaveBeenCalled();
  });
});
