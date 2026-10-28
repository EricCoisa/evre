import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetSystemPageLayoutUseCase } from './set-system-page-layout.use-case';
import { GetSystemPageLayoutUseCase } from './get-system-page-layout.use-case';
import { FindSystemConfigByLabelKeyUseCase } from '../../system-configuration/use-cases/find-by-label-key.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { PageSourceRegistry } from '../page-source-registry.service';
import { PageBuilderBridgeService } from '../page-builder-bridge.service';
import { PageLayoutValidator } from '../page-layout-validator.service';
import { PAGE_LAYOUTS_KEY, type PageLayout } from '../dto/page-layout.dto';

const usersListSource = {
  key: 'users.list',
  kind: 'list' as const,
  description: 'Usuários.',
  roles: ['ADMIN'],
  params: [{ name: 'limit', type: 'number' as const, description: 'Linhas.' }],
};

const layout = (source = 'users.list'): PageLayout => ({
  v: 1,
  blocks: [
    { id: 'b1', type: 'stat.card', span: 4, props: { label: 'Total' }, data: { source } },
  ],
});

const mockFindByLabelKey = { execute: vi.fn() };
const mockSystemConfig = { update: vi.fn() };
const mockSources = { listForRole: vi.fn(), get: vi.fn(), getKind: vi.fn(), has: vi.fn() };
const mockBridge = { describeSchema: vi.fn() };

describe('SetSystemPageLayoutUseCase', () => {
  let useCase: SetSystemPageLayoutUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SetSystemPageLayoutUseCase,
        PageLayoutValidator,
        { provide: FindSystemConfigByLabelKeyUseCase, useValue: mockFindByLabelKey },
        { provide: SystemConfigurationService, useValue: mockSystemConfig },
        { provide: PageSourceRegistry, useValue: mockSources },
        { provide: PageBuilderBridgeService, useValue: mockBridge },
      ],
    }).compile();
    useCase = mod.get(SetSystemPageLayoutUseCase);
    vi.clearAllMocks();

    mockSources.listForRole.mockReturnValue([usersListSource]);
    mockSources.get.mockReturnValue(usersListSource);
    mockBridge.describeSchema.mockResolvedValue({
      blocks: [
        { type: 'stat.card', description: '', accepts: ['list', 'count'], container: false, props: [] },
      ],
      pages: [{ pageKey: '/dashboard', description: '' }],
      spans: [1, 2, 3, 4],
      classNames: ['text-center'],
    });
    mockFindByLabelKey.execute.mockResolvedValue({
      id: 'cfg-1',
      labelKey: PAGE_LAYOUTS_KEY,
      value: {},
    });
    mockSystemConfig.update.mockResolvedValue({});
  });

  it('grava o layout do sistema serializado, com o autor para auditoria', async () => {
    await useCase.execute('admin-1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout(),
    });

    expect(mockSystemConfig.update).toHaveBeenCalledWith(
      'cfg-1',
      { value: JSON.stringify({ '/dashboard': layout() }) },
      'admin-1',
    );
  });

  it('preserva o layout das outras páginas ao gravar uma', async () => {
    const outra = { v: 1 as const, blocks: [] };
    mockFindByLabelKey.execute.mockResolvedValue({
      id: 'cfg-1',
      labelKey: PAGE_LAYOUTS_KEY,
      value: { '/outra': outra },
    });

    await useCase.execute('admin-1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout(),
    });

    const written = JSON.parse(
      mockSystemConfig.update.mock.calls[0][1].value as string,
    ) as Record<string, PageLayout>;
    expect(Object.keys(written).sort()).toEqual(['/dashboard', '/outra']);
    expect(written['/outra']).toEqual(outra);
  });

  it('aceita o valor guardado ainda como string JSON', async () => {
    mockFindByLabelKey.execute.mockResolvedValue({
      id: 'cfg-1',
      labelKey: PAGE_LAYOUTS_KEY,
      value: JSON.stringify({ '/outra': { v: 1, blocks: [] } }),
    });

    await useCase.execute('admin-1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout(),
    });

    const written = JSON.parse(
      mockSystemConfig.update.mock.calls[0][1].value as string,
    ) as Record<string, PageLayout>;
    expect(Object.keys(written).sort()).toEqual(['/dashboard', '/outra']);
  });

  it('roda a MESMA validação semântica da escrita de usuário', async () => {
    // Fonte fora do alcance do role: recusa antes de tocar na config.
    mockSources.listForRole.mockReturnValue([]);

    await expect(
      useCase.execute('admin-1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list'),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockSystemConfig.update).not.toHaveBeenCalled();
  });

  it('recusa pageKey que nenhuma tela renderiza', async () => {
    await expect(
      useCase.execute('admin-1', 'ADMIN', {
        pageKey: '/inexistente',
        layout: layout(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('falha com mensagem acionável quando a config do sistema não foi semeada', async () => {
    mockFindByLabelKey.execute.mockRejectedValue(new Error('not found'));

    await expect(
      useCase.execute('admin-1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout(),
      }),
    ).rejects.toThrow(/seed/);
  });
});

describe('GetSystemPageLayoutUseCase', () => {
  let useCase: GetSystemPageLayoutUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        GetSystemPageLayoutUseCase,
        { provide: FindSystemConfigByLabelKeyUseCase, useValue: mockFindByLabelKey },
      ],
    }).compile();
    useCase = mod.get(GetSystemPageLayoutUseCase);
    vi.clearAllMocks();
  });

  it('devolve o mapa de layouts do sistema', async () => {
    const map = { '/dashboard': layout() };
    mockFindByLabelKey.execute.mockResolvedValue({ value: map });

    expect(await useCase.execute()).toEqual(map);
  });

  it('aceita o valor ainda serializado', async () => {
    mockFindByLabelKey.execute.mockResolvedValue({
      value: JSON.stringify({ '/dashboard': layout() }),
    });

    expect(await useCase.execute()).toEqual({ '/dashboard': layout() });
  });

  // Está no caminho de exibição de toda página customizável: quebrar aqui derrubaria a tela
  // de quem nunca customizou nada.
  it('devolve mapa vazio quando a config não existe, em vez de lançar', async () => {
    mockFindByLabelKey.execute.mockRejectedValue(new Error('not found'));

    expect(await useCase.execute()).toEqual({});
  });

  it('devolve mapa vazio quando o valor está corrompido', async () => {
    mockFindByLabelKey.execute.mockResolvedValue({ value: '{quebrado' });

    expect(await useCase.execute()).toEqual({});
  });
});
