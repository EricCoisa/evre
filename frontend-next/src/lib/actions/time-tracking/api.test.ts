import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTimeTrackingApi = vi.hoisted(() => ({
  timeTrackingControllerGetActiveTimer: vi.fn(),
  timeTrackingControllerStartTimer: vi.fn(),
  timeTrackingControllerStopTimer: vi.fn(),
  timeTrackingControllerCreateManualEntry: vi.fn(),
  timeTrackingControllerUpdateTimeEntry: vi.fn(),
  timeTrackingControllerDeleteTimeEntry: vi.fn(),
  timeTrackingControllerListTimeEntries: vi.fn(),
  timeTrackingControllerExportTimeEntries: vi.fn(),
}));

vi.mock('@/lib/generated/time-tracking/time-tracking', () => ({
  getTimeTracking: () => mockTimeTrackingApi,
}));

import {
  getActiveTimer,
  startTimer,
  stopTimer,
  createManualTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  listTimeEntries,
  exportTimeEntries,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getActiveTimer', () => {
  it('retorna o timer ativo quando existe', async () => {
    mockTimeTrackingApi.timeTrackingControllerGetActiveTimer.mockResolvedValue({
      entry: { id: 'e1', startTime: new Date().toISOString() },
      isForgotten: false,
      thresholdHours: 8,
    });

    const result = await getActiveTimer();

    expect(result.success).toBe(true);
  });

  it('retorna null entry quando endpoint retorna 404', async () => {
    mockTimeTrackingApi.timeTrackingControllerGetActiveTimer.mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } }),
    );

    const result = await getActiveTimer();

    expect(result.success).toBe(true);
    expect(result.data?.entry).toBeNull();
  });
});

describe('startTimer', () => {
  it('inicia timer com dto', async () => {
    mockTimeTrackingApi.timeTrackingControllerStartTimer.mockResolvedValue({
      id: 'e1',
      startTime: new Date().toISOString(),
    });

    const result = await startTimer({ description: 'Trabalhando' });

    expect(result.success).toBe(true);
    expect(mockTimeTrackingApi.timeTrackingControllerStartTimer).toHaveBeenCalledWith({
      description: 'Trabalhando',
    });
  });
});

describe('stopTimer', () => {
  it('para o timer ativo', async () => {
    mockTimeTrackingApi.timeTrackingControllerStopTimer.mockResolvedValue({
      id: 'e1',
      endTime: new Date().toISOString(),
    });

    const result = await stopTimer();

    expect(result.success).toBe(true);
  });
});

describe('createManualTimeEntry', () => {
  it('cria entrada manual', async () => {
    mockTimeTrackingApi.timeTrackingControllerCreateManualEntry.mockResolvedValue({
      id: 'e1',
    });

    const result = await createManualTimeEntry({ startTime: '2024-01-01T09:00:00Z', endTime: '2024-01-01T10:00:00Z', duration: 3600 });

    expect(result.success).toBe(true);
  });
});

describe('updateTimeEntry', () => {
  it('atualiza entrada por id', async () => {
    mockTimeTrackingApi.timeTrackingControllerUpdateTimeEntry.mockResolvedValue({ id: 'e1' });

    const result = await updateTimeEntry('e1', { description: 'Atualizado' });

    expect(result.success).toBe(true);
    expect(mockTimeTrackingApi.timeTrackingControllerUpdateTimeEntry).toHaveBeenCalledWith('e1', {
      description: 'Atualizado',
    });
  });
});

describe('deleteTimeEntry', () => {
  it('remove entrada por id', async () => {
    mockTimeTrackingApi.timeTrackingControllerDeleteTimeEntry.mockResolvedValue({ success: true });

    const result = await deleteTimeEntry('e1');

    expect(result.success).toBe(true);
  });
});

describe('listTimeEntries', () => {
  it('lista entradas com params', async () => {
    mockTimeTrackingApi.timeTrackingControllerListTimeEntries.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });

    const result = await listTimeEntries({ page: 1, limit: 10 } as never);

    expect(result.success).toBe(true);
  });
});

describe('exportTimeEntries', () => {
  it('exporta entradas', async () => {
    mockTimeTrackingApi.timeTrackingControllerExportTimeEntries.mockResolvedValue({ csv: '' });

    const result = await exportTimeEntries();

    expect(result.success).toBe(true);
  });
});
