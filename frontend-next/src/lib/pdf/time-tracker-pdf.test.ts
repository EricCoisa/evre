import { describe, it, expect, vi } from 'vitest';
import { generateTimeTrackerPdf } from './time-tracker-pdf';

describe('generateTimeTrackerPdf', () => {
  it('generates a PDF and calls save', async () => {
    const filename = await generateTimeTrackerPdf({
      entries: [
        {
          id: '1',
          date: '08/11/2026',
          startTime: '08:00:00',
          endTime: '10:00:00',
          duration: 7200,
          durationFormatted: '02:00:00',
          durationHours: '2,00',
          projectName: 'Projeto Teste',
          description: 'Desenvolvimento',
          entityType: 'TASK',
          entityTitle: 'Tarefa 1',
          userName: 'Carlos Dev',
          userEmail: 'carlos@example.com',
          isBillable: true,
          source: 'Cronômetro',
          isForgotten: false,
        },
      ],
      totalSeconds: 7200,
      billableSeconds: 7200,
      totalEntries: 1,
      period: {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
      projectName: 'Projeto Teste',
      generatedBy: 'Carlos Dev',
    });

    expect(filename).toContain('relatorio-tempo-2026-11-01-a-2026-11-30.pdf');
  });
});
