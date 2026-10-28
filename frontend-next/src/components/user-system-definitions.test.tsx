import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserSystemDefinitions } from './user-system-definitions';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseScreenItem = vi.hoisted(() => vi.fn());
vi.mock('@/components/agent/screen-registry', () => ({ useScreenItem: mockUseScreenItem }));

const mockUseDefinitions = vi.hoisted(() => vi.fn());
const mockMutateAsync = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/userConfigurationDefinition/queries', () => ({
  useUserConfigurationsDefinitions: mockUseDefinitions,
  useSetUserConfigurationDefinitions: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('./base-configuration', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BaseConfiguration: (props: any) => (
    <div>
      <span>data:{JSON.stringify(props.data)}</span>
      <button onClick={() => props.onUpdate('new-value')}>update</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserSystemDefinitions', () => {
  it('registra o screen item com a labelKey', () => {
    mockUseDefinitions.mockReturnValue({ data: undefined });
    render(<UserSystemDefinitions labelKey="FOO" />);

    expect(mockUseScreenItem).toHaveBeenCalledWith('config', 'user-configurations-definitions', 'FOO');
  });

  it('sem data: onUpdate não faz nada', async () => {
    mockUseDefinitions.mockReturnValue({ data: undefined });
    render(<UserSystemDefinitions labelKey="FOO" />);

    fireEvent.click(screen.getByText('update'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('com data: monta o payload a partir de defaultValue, atualiza e mostra toast quando showMessage', async () => {
    mockUseDefinitions.mockReturnValue({
      data: { id: '1', labelKey: 'FOO', valueType: 'STRING', options: null, defaultValue: 'old' },
    });
    mockMutateAsync.mockResolvedValue(true);

    render(<UserSystemDefinitions labelKey="FOO" showMessage />);

    fireEvent.click(screen.getByText('update'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      userConfigurationDefinitions: { id: '1', labelKey: 'FOO', valueType: 'STRING', options: null, defaultValue: 'new-value' },
    }));
    expect(toast.success).toHaveBeenCalledWith('updatedSuccessfully');
  });

  it('sem showMessage: não mostra toast mesmo com sucesso', async () => {
    mockUseDefinitions.mockReturnValue({
      data: { id: '1', labelKey: 'FOO', valueType: 'STRING', defaultValue: 'old' },
    });
    mockMutateAsync.mockResolvedValue(true);

    render(<UserSystemDefinitions labelKey="FOO" />);

    fireEvent.click(screen.getByText('update'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
