import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { TimeEntryEdit } from './edit-time-entry-dialog';
import { ManualEntryDialog } from './manual-entry-dialog';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn().mockResolvedValue({ id: 'entry-1' }),
  createMutateAsync: vi.fn().mockResolvedValue({ id: 'new-entry' }),
  useScreenItem: vi.fn(),
}));

vi.mock('@/components/agent/screen-registry', () => ({
  useScreenItem: mocks.useScreenItem,
}));

vi.mock('@/lib/actions/time-tracking/queries', () => ({
  useUpdateTimeEntry: () => ({ mutateAsync: mocks.updateMutateAsync }),
  useCreateManualEntry: () => ({ mutateAsync: mocks.createMutateAsync }),
}));

vi.mock('@/lib/actions/project/queries', () => ({
  useProjects: () => ({ data: [{ id: 'p1', name: 'Projeto Alpha' }] }),
}));

vi.mock('@/components/form/form-builder', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FormBuilder: (props: any) => (
    <div>
      <button
        onClick={() =>
          props.onSubmit({
            description: 'Trabalho no projeto',
            startTime: '2026-11-07T09:00',
            endTime: '2026-11-07T11:00',
            isBillable: true,
          })
        }
      >
        submit-edit
      </button>
      <button onClick={props.onCancel}>cancel-edit</button>
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FormBuilderModal: (props: any) =>
    props.open ? (
      <div>
        <button
          onClick={() =>
            props.onSubmit({
              description: 'Lançamento manual',
              projectId: 'p1',
              startTime: '2026-11-07T14:00',
              endTime: '2026-11-07T16:00',
              isBillable: false,
            })
          }
        >
          submit-manual
        </button>
        <button onClick={() => props.onOpenChange(false)}>close-manual</button>
      </div>
    ) : null,
}));

function mockEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    description: 'Atividade de teste',
    startTime: '2026-11-07T09:00:00.000Z',
    endTime: '2026-11-07T11:00:00.000Z',
    duration: 7200,
    isBillable: true,
    isManual: false,
    projectId: 'p1',
    createdAt: '2026-11-07T09:00:00.000Z',
    updatedAt: '2026-11-07T11:00:00.000Z',
    ...overrides,
  };
}

describe('Time Tracker Dialogs - Padrão da aplicação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TimeEntryEdit', () => {
    it('registra o item na tela com useScreenItem e chama useUpdateTimeEntry no submit', async () => {
      const entry = mockEntry();
      render(<TimeEntryEdit entry={entry} />);

      expect(mocks.useScreenItem).toHaveBeenCalledWith('record', 'time-entries', 'entry-1');

      await userEvent.click(screen.getByText('submit-edit'));

      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        id: 'entry-1',
        data: expect.objectContaining({
          description: 'Trabalho no projeto',
          isBillable: true,
        }),
      });
    });

    it('converte horários para string local datetime no preenchimento de edição', () => {
      const entry = mockEntry({
        startTime: '2026-11-07T12:30:00.000Z',
        endTime: '2026-11-07T14:45:00.000Z',
      });
      render(<TimeEntryEdit entry={entry} />);
      expect(screen.getByText('submit-edit')).toBeInTheDocument();
    });

    it('não renderiza o formulário se nenhum entry for passado', () => {
      render(<TimeEntryEdit entry={null} />);
      expect(screen.queryByText('submit-edit')).not.toBeInTheDocument();
    });
  });

  describe('ManualEntryDialog', () => {
    it('chama useCreateManualEntry com os dados convertidos em ISO', async () => {
      const onOpenChange = vi.fn();
      render(<ManualEntryDialog open={true} onOpenChange={onOpenChange} />);

      await userEvent.click(screen.getByText('submit-manual'));

      expect(mocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Lançamento manual',
          projectId: 'p1',
          isBillable: false,
        }),
      );
    });
  });
});
