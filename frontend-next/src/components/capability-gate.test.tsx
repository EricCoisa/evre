import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapabilityGate } from './capability-gate';
import { useCapability } from '@/lib/actions/capability/queries';
import { useMe } from '@/lib/actions/auth/queries';
import { useRouter } from 'next/navigation';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/capability/queries', () => ({
  useCapability: vi.fn(),
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

describe('CapabilityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null } as unknown as ReturnType<typeof useMe>);
  });

  it('renders nothing when the capability is hidden', () => {
    vi.mocked(useCapability).mockReturnValue({ hidden: true, disabled: false, reason: undefined, fixPath: undefined });
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.queryByText('children')).toBeNull();
  });

  it('renders the children when not disabled', () => {
    vi.mocked(useCapability).mockReturnValue({ hidden: false, disabled: false, reason: undefined, fixPath: undefined });
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.getByText('children')).toBeInTheDocument();
  });

  it('shows the reason hint instead of the children when disabled', () => {
    vi.mocked(useCapability).mockReturnValue({
      hidden: false,
      disabled: true,
      reason: 'provider down',
      fixPath: undefined,
    });
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.queryByText('children')).toBeNull();
    expect(screen.getByText('provider down')).toBeInTheDocument();
  });

  it('falls back to the generic unavailable message when there is no reason', () => {
    vi.mocked(useCapability).mockReturnValue({ hidden: false, disabled: true, reason: undefined, fixPath: undefined });
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.getByText('capability.unavailable')).toBeInTheDocument();
  });

  it('does not show the configure button for a non-admin user even with a fixPath', () => {
    vi.mocked(useCapability).mockReturnValue({
      hidden: false,
      disabled: true,
      reason: 'down',
      fixPath: '/settings?tab=captchaConfig',
    });
    vi.mocked(useMe).mockReturnValue({
      data: { role: 'USER' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useMe>);
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.queryByText('capability.configure_button')).toBeNull();
  });

  it('shows a configure button for an admin, and clicking it navigates to the fixPath', async () => {
    vi.mocked(useCapability).mockReturnValue({
      hidden: false,
      disabled: true,
      reason: 'down',
      fixPath: '/settings?tab=captchaConfig',
    });
    vi.mocked(useMe).mockReturnValue({
      data: { role: 'ADMIN' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useMe>);
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);

    const user = userEvent.setup();
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );

    const button = screen.getByText('capability.configure_button');
    await user.click(button);
    expect(push).toHaveBeenCalledWith('/settings?tab=captchaConfig');
  });

  it('hides the configure button for an admin when there is no fixPath', () => {
    vi.mocked(useCapability).mockReturnValue({ hidden: false, disabled: true, reason: 'down', fixPath: undefined });
    vi.mocked(useMe).mockReturnValue({
      data: { role: 'ADMIN' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useMe>);
    render(
      <CapabilityGate name="CAPTCHA">
        <p>children</p>
      </CapabilityGate>,
    );
    expect(screen.queryByText('capability.configure_button')).toBeNull();
  });
});
