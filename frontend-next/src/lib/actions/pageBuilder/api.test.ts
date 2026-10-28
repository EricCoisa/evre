import { describe, it, expect, vi } from 'vitest';

const mockUserApi = vi.hoisted(() => ({
  userControllerFindAll: vi.fn(),
  userControllerSignupsSeries: vi.fn(),
}));
const mockLoggingApi = vi.hoisted(() => ({ loggingControllerFindAll: vi.fn() }));
const mockPageBuilderApi = vi.hoisted(() => ({
  pageBuilderControllerListSources: vi.fn(),
  pageBuilderControllerSaveLayout: vi.fn(),
  pageBuilderControllerListSystemLayouts: vi.fn(),
  pageBuilderControllerSaveSystemLayout: vi.fn(),
}));

vi.mock('@/lib/generated/user/user', () => ({ getUser: () => mockUserApi }));
vi.mock('@/lib/generated/logging/logging', () => ({ getLogging: () => mockLoggingApi }));
vi.mock('@/lib/generated/page-builder/page-builder', () => ({ getPageBuilder: () => mockPageBuilderApi }));

import {
  fetchUsersList,
  fetchLogsList,
  fetchSignupsSeries,
  fetchPageSources,
  savePageLayout,
  fetchSystemPageLayouts,
  saveSystemPageLayout,
} from './api';

describe('pageBuilder/api', () => {
  it('fetchUsersList wraps userControllerFindAll', async () => {
    mockUserApi.userControllerFindAll.mockResolvedValue({ items: [], total: 0 });

    const result = await fetchUsersList({ page: 1 });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerFindAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('fetchLogsList wraps loggingControllerFindAll', async () => {
    mockLoggingApi.loggingControllerFindAll.mockResolvedValue({ items: [], total: 0 });

    const result = await fetchLogsList();

    expect(result.success).toBe(true);
  });

  it('fetchSignupsSeries wraps userControllerSignupsSeries', async () => {
    mockUserApi.userControllerSignupsSeries.mockResolvedValue({ series: [] });

    const result = await fetchSignupsSeries({ from: '2024-01-01' });

    expect(result.success).toBe(true);
    expect(mockUserApi.userControllerSignupsSeries).toHaveBeenCalledWith({ from: '2024-01-01' });
  });

  it('fetchPageSources wraps pageBuilderControllerListSources', async () => {
    mockPageBuilderApi.pageBuilderControllerListSources.mockResolvedValue([{ key: 'home' }]);

    const result = await fetchPageSources();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ key: 'home' }]);
  });

  it('savePageLayout wraps pageBuilderControllerSaveLayout with the pageKey+layout payload', async () => {
    mockPageBuilderApi.pageBuilderControllerSaveLayout.mockResolvedValue(undefined);

    const result = await savePageLayout('home', { blocks: [] } as never);

    expect(result.success).toBe(true);
    expect(mockPageBuilderApi.pageBuilderControllerSaveLayout).toHaveBeenCalledWith({
      pageKey: 'home',
      layout: { blocks: [] },
    });
  });

  it('fetchSystemPageLayouts wraps pageBuilderControllerListSystemLayouts', async () => {
    mockPageBuilderApi.pageBuilderControllerListSystemLayouts.mockResolvedValue({ layouts: {} });

    const result = await fetchSystemPageLayouts();

    expect(result.success).toBe(true);
  });

  it('saveSystemPageLayout wraps pageBuilderControllerSaveSystemLayout with the pageKey+layout payload', async () => {
    mockPageBuilderApi.pageBuilderControllerSaveSystemLayout.mockResolvedValue(undefined);

    const result = await saveSystemPageLayout('home', { blocks: [] } as never);

    expect(result.success).toBe(true);
    expect(mockPageBuilderApi.pageBuilderControllerSaveSystemLayout).toHaveBeenCalledWith({
      pageKey: 'home',
      layout: { blocks: [] },
    });
  });

  it('maps a thrown error into a failure envelope', async () => {
    mockPageBuilderApi.pageBuilderControllerListSources.mockRejectedValue(new Error('boom'));

    const result = await fetchPageSources();

    expect(result.success).toBe(false);
  });
});
