import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProviderEnabledSwitch } from './provider-enabled-switch';
import { useConfiguration, useUpdateConfiguration } from '@/lib/actions/systemConfiguration/queries';

vi.mock('@/lib/actions/systemConfiguration/queries', () => ({
  useConfiguration: vi.fn(),
  useUpdateConfiguration: vi.fn(),
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);

function setup(data: unknown, pending = false) {
  vi.mocked(useConfiguration).mockReturnValue({ data } as unknown as ReturnType<typeof useConfiguration>);
  vi.mocked(useUpdateConfiguration).mockReturnValue({
    mutateAsync,
    isPending: pending,
  } as unknown as ReturnType<typeof useUpdateConfiguration>);

  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProviderEnabledSwitch labelKey="SYSTEM_CAPTCHA_ENABLED" label="Captcha" />
    </QueryClientProvider>,
  );
}

describe('ProviderEnabledSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(undefined);
  });

  it('renders nothing while the configuration has not loaded', () => {
    setup(undefined);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows checked when the stored value is the boolean true', () => {
    setup({ id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: true });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows checked when the stored value is the string "true"', () => {
    setup({ id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: 'true' });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows unchecked for any other value', () => {
    setup({ id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: false });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('disables the switch while an update is pending', () => {
    setup({ id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: false }, true);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('disables the switch when the configuration itself is blocked', () => {
    setup({ id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: false, blocked: true });
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('saves the new value as a string and invalidates the extra caches', async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    vi.mocked(useConfiguration).mockReturnValue({
      data: { id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: false },
    } as unknown as ReturnType<typeof useConfiguration>);
    vi.mocked(useUpdateConfiguration).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateConfiguration>);

    render(
      <QueryClientProvider client={client}>
        <ProviderEnabledSwitch
          labelKey="SYSTEM_CAPTCHA_ENABLED"
          label="Captcha"
          invalidateKeys={[['other-cache']]}
        />
      </QueryClientProvider>,
    );

    screen.getByRole('switch').click();

    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        systemConfiguration: { id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: 'true' },
      }),
    );
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['other-cache'] }),
    );
  });

  it('stops click propagation so a clickable parent card is not toggled', () => {
    vi.mocked(useConfiguration).mockReturnValue({
      data: { id: 'x', labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: false },
    } as unknown as ReturnType<typeof useConfiguration>);
    vi.mocked(useUpdateConfiguration).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateConfiguration>);

    const parentClick = vi.fn();
    const client = new QueryClient();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={parentClick}>
        <QueryClientProvider client={client}>
          <ProviderEnabledSwitch labelKey="SYSTEM_CAPTCHA_ENABLED" label="Captcha" />
        </QueryClientProvider>
      </div>,
    );

    screen.getByRole('switch').click();

    expect(parentClick).not.toHaveBeenCalled();
  });
});
