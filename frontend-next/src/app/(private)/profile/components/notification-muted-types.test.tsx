import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationMutedTypes } from './notification-muted-types';

const mocks = vi.hoisted(() => ({
  data: {
    id: 'config-id',
    labelKey: 'NOTIFICATION_MUTED_TYPES',
    value: [] as string[],
  },
  mutate: vi.fn(),
}));

vi.mock('@/lib/actions/userConfiguration/queries', () => ({
  useUserConfiguration: () => ({ data: mocks.data }),
  useSetUserConfiguration: () => ({ mutate: mocks.mutate }),
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('NotificationMutedTypes', () => {
  beforeEach(() => {
    mocks.data.value = [];
    mocks.mutate.mockClear();
  });

  it('deixa todos os tipos habilitados por padrão', () => {
    render(<NotificationMutedTypes />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('desmarcar um tipo persiste-o como desabilitado', () => {
    render(<NotificationMutedTypes />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(mocks.mutate).toHaveBeenCalledWith({
      userConfiguration: {
        ...mocks.data,
        value: JSON.stringify(['SYSTEM_ANNOUNCEMENT']),
      },
    });
  });

  it('mantém desabilitado um tipo que já estava silenciado e o reabilita ao marcar', () => {
    mocks.data.value = ['SYSTEM_ANNOUNCEMENT'];
    render(<NotificationMutedTypes />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(mocks.mutate).toHaveBeenCalledWith({
      userConfiguration: { ...mocks.data, value: '[]' },
    });
  });
});
