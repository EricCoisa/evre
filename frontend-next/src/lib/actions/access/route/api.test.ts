import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  routeControllerFindAll: vi.fn(),
  routeControllerCreate: vi.fn(),
  routeControllerGetHomeRoute: vi.fn(),
  routeControllerGetRouteByPath: vi.fn(),
  routeControllerUpdate: vi.fn(),
  routeControllerRemove: vi.fn(),
  routeControllerGetRoleHomes: vi.fn(),
  routeControllerSaveRoleHomes: vi.fn(),
}));

vi.mock('@/lib/generated/route/route', () => ({
  getRoute: () => mockApi,
}));

import {
  getRoutes,
  createRoute,
  getHomeRoute,
  getRouteByPath,
  updateRoute,
  deleteRoute,
  getRoleHomes,
  saveRoleHomes,
} from './api';
import type { CreateRouteDto, UpdateRouteDto } from './types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRoutes', () => {
  it('normaliza os params de paginação e devolve envelope de sucesso', async () => {
    mockApi.routeControllerFindAll.mockResolvedValue({ data: [], meta: {} });

    const result = await getRoutes({ page: 1, limit: 10 });

    expect(mockApi.routeControllerFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    expect(result).toEqual({ success: true, data: { data: [], meta: {} }, message: '', status: 200 });
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.routeControllerFindAll.mockResolvedValue({ data: [], meta: {} });

    await getRoutes();

    expect(mockApi.routeControllerFindAll).toHaveBeenCalledWith(undefined);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.routeControllerFindAll.mockRejectedValue({
      response: { status: 500, data: { message: 'falhou' } },
    });

    const result = await getRoutes();

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toBe('falhou');
  });
});

describe('createRoute', () => {
  it('repassa o payload', async () => {
    mockApi.routeControllerCreate.mockResolvedValue({ id: 'r1', path: '/x' });
    const data = { path: '/x', labelKey: 'x', icon: null } as unknown as CreateRouteDto;

    const result = await createRoute(data);

    expect(mockApi.routeControllerCreate).toHaveBeenCalledWith(data);
    expect(result).toMatchObject({ success: true, data: { id: 'r1' } });
  });
});

describe('getHomeRoute', () => {
  it('busca a rota home sem argumentos', async () => {
    mockApi.routeControllerGetHomeRoute.mockResolvedValue({ id: 'home', path: '/' });

    const result = await getHomeRoute();

    expect(mockApi.routeControllerGetHomeRoute).toHaveBeenCalledWith();
    expect(result.success).toBe(true);
  });
});

describe('getRouteByPath', () => {
  it('busca a rota pelo path', async () => {
    mockApi.routeControllerGetRouteByPath.mockResolvedValue({ id: 'r1', path: '/foo' });

    const result = await getRouteByPath('/foo');

    expect(mockApi.routeControllerGetRouteByPath).toHaveBeenCalledWith('/foo');
    expect(result.success).toBe(true);
  });
});

describe('updateRoute', () => {
  it('atualiza a rota por id', async () => {
    mockApi.routeControllerUpdate.mockResolvedValue({ id: 'r1', path: '/novo' });
    const data = { path: '/novo' } as unknown as UpdateRouteDto;

    const result = await updateRoute('r1', data);

    expect(mockApi.routeControllerUpdate).toHaveBeenCalledWith('r1', data);
    expect(result.success).toBe(true);
  });
});

describe('deleteRoute', () => {
  it('remove a rota por id', async () => {
    mockApi.routeControllerRemove.mockResolvedValue(undefined);

    const result = await deleteRoute('r1');

    expect(mockApi.routeControllerRemove).toHaveBeenCalledWith('r1');
    expect(result.success).toBe(true);
  });
});

describe('getRoleHomes', () => {
  it('busca as home routes por role sem argumentos', async () => {
    mockApi.routeControllerGetRoleHomes.mockResolvedValue({ admin: '/admin' });

    const result = await getRoleHomes();

    expect(mockApi.routeControllerGetRoleHomes).toHaveBeenCalledWith();
    expect(result).toMatchObject({ success: true, data: { admin: '/admin' } });
  });
});

describe('saveRoleHomes', () => {
  it('envolve o mapa de homes em { homes }', async () => {
    mockApi.routeControllerSaveRoleHomes.mockResolvedValue({ admin: '/admin' });
    const homes = { admin: '/admin' };

    const result = await saveRoleHomes(homes);

    expect(mockApi.routeControllerSaveRoleHomes).toHaveBeenCalledWith({ homes });
    expect(result).toMatchObject({ success: true, data: homes });
  });
});
