import * as path from 'path';
import { renderTemplateFromFile } from 'src/common/utils/email.util';

type FormattedEntry = {
  date: string;
  startTime: string;
  endTime: string;
  durationFormatted: string;
  projectName: string;
  description: string;
  entityType: string;
  userName: string;
  isBillable: boolean;
  source: string;
  isForgotten: boolean;
};

type TimeEntriesExportData = {
  totalEntries: number;
  totalSeconds: number;
  billableSeconds: number;
  entries: FormattedEntry[];
  period: { startDate: string | null; endDate: string | null };
};

function hms(seconds: number): string {
  if (seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildTimeEntriesHtml(
  data: TimeEntriesExportData,
): Promise<string> {
  const tableRows = data.entries
    .map((e) => {
      const cls = e.isForgotten ? ' class="forgotten"' : '';
      const alertBadge = e.isForgotten
        ? '<span class="badge badge-amber">Timer Esquecido</span>'
        : '';
      const billableBadge = e.isBillable
        ? '<span class="badge badge-green">Sim</span>'
        : '<span class="badge badge-gray">Não</span>';
      return `<tr${cls}>
        <td class="mono">${escapeHtml(e.date)}</td>
        <td class="mono">${escapeHtml(e.startTime)}</td>
        <td class="mono">${escapeHtml(e.endTime)}</td>
        <td class="mono">${escapeHtml(e.durationFormatted)}</td>
        <td>${escapeHtml(e.projectName)}</td>
        <td>${escapeHtml(e.description)}</td>
        <td>${escapeHtml(e.userName)}</td>
        <td>${escapeHtml(e.entityType)}</td>
        <td>${escapeHtml(e.source)}</td>
        <td>${billableBadge}</td>
        <td>${alertBadge}</td>
      </tr>`;
    })
    .join('\n');

  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  const templatePath = path.join(__dirname, 'time-entries.template.html');
  return renderTemplateFromFile(templatePath, {
    title: 'Relatório de Registros de Tempo',
    periodStart: data.period.startDate ?? '',
    periodEnd: data.period.endDate ?? '',
    generatedAt,
    totalEntries: String(data.totalEntries),
    totalTime: hms(data.totalSeconds),
    billableTime: hms(data.billableSeconds),
    tableRows,
  });
}
