import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseUpdateFeatureFlag = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/feature-flag/queries', () => ({
  useUpdateFeatureFlag: mockUseUpdateFeatureFlag,
}));

import { FeatureFlagSwitch } from './feature-flag-switch';

beforeEach(() => {
  mockUseUpdateFeatureFlag.mockReturnValue({ mutate: mockMutate, isPending: false });
  vi.clearAllMocks();
});

describe('FeatureFlagSwitch', () => {
  it('renderiza o switch com o estado correto', () => {
    render(<FeatureFlagSwitch id="FF_TEST" enabled={true} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('renderiza desabilitado quando enabled=false', () => {
    render(<FeatureFlagSwitch id="FF_TEST" enabled={false} />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('desabilita o switch quando mutação está pendente', () => {
    mockUseUpdateFeatureFlag.mockReturnValue({ mutate: mockMutate, isPending: true });
    render(<FeatureFlagSwitch id="FF_TEST" enabled={false} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('chama mutate com id e dto ao alternar', async () => {
    render(<FeatureFlagSwitch id="FF_FEAT" enabled={false} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'FF_FEAT', dto: { enabled: true } });
  });
});
