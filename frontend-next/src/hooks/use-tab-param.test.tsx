import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabParam } from './use-tab-param';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/settings',
  useSearchParams: () => mocks.searchParams,
}));

describe('useTabParam', () => {
  it('monta com ?tab=X na URL e retorna X, não o default', () => {
    mocks.searchParams = new URLSearchParams('tab=emailConfig');
    const { result } = renderHook(() => useTabParam('systemConfig'));
    expect(result.current[0]).toBe('emailConfig');
  });

  it('sem ?tab na URL usa o default', () => {
    mocks.searchParams = new URLSearchParams();
    const { result } = renderHook(() => useTabParam('systemConfig'));
    expect(result.current[0]).toBe('systemConfig');
  });
});
