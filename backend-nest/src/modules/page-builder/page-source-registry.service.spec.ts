import { Controller } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { PageSourceRegistry } from './page-source-registry.service';
import { CheckAccessUseCase } from '../user-route-access/use-cases/check-access.use-case';

@Controller('fake')
class FakeController {
  @GetApi({
    summary: 'restrito',
    roles: ['ADMIN'],
    pageSource: { key: 'fake.admin', kind: 'list', description: 'Só admin.' },
  })
  adminOnly() {
    return [];
  }

  @GetApi({
    summary: 'aberto',
    authenticated: true,
    pageSource: {
      key: 'fake.open',
      kind: 'series',
      description: 'Qualquer autenticado.',
    },
  })
  open() {
    return [];
  }

  @GetApi({ summary: 'sem tag', authenticated: true })
  notASource() {
    return [];
  }
}

describe('PageSourceRegistry', () => {
  let registry: PageSourceRegistry;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [FakeController],
      providers: [
        PageSourceRegistry,
        { provide: CheckAccessUseCase, useValue: {} },
      ],
    }).compile();
    await mod.init();
    registry = mod.get(PageSourceRegistry);
  });

  it('descobre apenas endpoints marcados com pageSource', () => {
    expect(registry.has('fake.admin')).toBe(true);
    expect(registry.has('fake.open')).toBe(true);
    expect(registry.has('fake.notASource')).toBe(false);
  });

  it('filtra por role: ADMIN vê a fonte restrita', () => {
    const keys = registry.listForRole('ADMIN').map((s) => s.key);

    expect(keys.sort()).toEqual(['fake.admin', 'fake.open']);
  });

  it('filtra por role: USER não vê a fonte restrita', () => {
    const keys = registry.listForRole('USER').map((s) => s.key);

    expect(keys).toEqual(['fake.open']);
  });

  it('preserva kind e description para o agente', () => {
    const open = registry
      .listForRole('USER')
      .find((s) => s.key === 'fake.open');

    expect(open).toMatchObject({
      kind: 'series',
      description: 'Qualquer autenticado.',
    });
  });

  it('getKind devolve o kind da fonte, ou undefined se não existe', () => {
    expect(registry.getKind('fake.open')).toBe('series');
    expect(registry.getKind('fake.ghost')).toBeUndefined();
  });

  it('get devolve a entrada completa, ou undefined se não existe', () => {
    expect(registry.get('fake.admin')).toMatchObject({ key: 'fake.admin', kind: 'list' });
    expect(registry.get('fake.ghost')).toBeUndefined();
  });

  it('recusa duas fontes com a mesma key', async () => {
    @Controller('dup')
    class DupController {
      @GetApi({
        summary: 'a',
        authenticated: true,
        pageSource: { key: 'dup.key', kind: 'list', description: '' },
      })
      a() {
        return [];
      }

      @GetApi({
        summary: 'b',
        authenticated: true,
        pageSource: { key: 'dup.key', kind: 'list', description: '' },
      })
      b() {
        return [];
      }
    }

    const mod = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [DupController],
      providers: [
        PageSourceRegistry,
        { provide: CheckAccessUseCase, useValue: {} },
      ],
    }).compile();

    await expect(mod.init()).rejects.toThrow('PageSource duplicada');
  });
});
