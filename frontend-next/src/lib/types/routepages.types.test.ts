import { describe, it, expect, vi } from 'vitest';

vi.mock('../actions/user/api', () => ({ getUser: vi.fn() }));

import { RoutePagesList, nullFunction } from './routepages.types';
import { getUser } from '../actions/user/api';

describe('nullFunction', () => {
  it('resolves to null regardless of the generic type', async () => {
    await expect(nullFunction<string>()).resolves.toBeNull();
  });
});

describe('RoutePagesList', () => {
  it('builds the breadcrumb query for /user from the given id', async () => {
    vi.mocked(getUser).mockResolvedValue({ data: { id: 'u1' } } as never);
    const userRoute = RoutePagesList.find((r) => r.path === '/user')!;

    const query = userRoute.getBreadName('u1');

    expect(query.queryKey('u1')).toEqual(['user', 'u1']);
    await expect(query.queryFn('u1')).resolves.toEqual({ data: { id: 'u1' } });
    expect(getUser).toHaveBeenCalledWith('u1');
  });
});
