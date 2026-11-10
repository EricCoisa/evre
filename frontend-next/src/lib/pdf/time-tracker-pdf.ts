import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportTimeEntryRow } from '../actions/time-tracking/types';

// Garante compatibilidade universal com CJS/ESM/Turbopack/Webpack
const JsPdfConstructor = (
  typeof jsPDF === 'function' ? jsPDF : (jsPDF as any)?.jsPDF || (jsPDF as any)?.default
) as typeof jsPDF;

export interface TimeTrackerPdfOptions {
  entries: ExportTimeEntryRow[];
  totalSeconds: number;
  billableSeconds: number;
  totalEntries: number;
  period?: {
    startDate: string | null;
    endDate: string | null;
  };
  projectName?: string;
  generatedBy?: string;
}

function formatDurationHms(seconds: number): string {
  if (seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function generateTimeTrackerPdf(options: TimeTrackerPdfOptions): Promise<string> {
  const {
    entries = [],
    totalSeconds = 0,
    billableSeconds = 0,
    totalEntries = 0,
    period,
    projectName,
    generatedBy,
  } = options;

  // Orientação paisagem (A4: 297mm x 210mm) para visualização clara de todas as colunas
  const doc = new JsPdfConstructor({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // 1. Cabeçalho Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Relatório de Apontamento de Horas', marginX, 16);

  // Período e filtros
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500

  let periodText = 'Período: Histórico Completo';
  if (period?.startDate && period?.endDate) {
    periodText = `Período: ${period.startDate} até ${period.endDate}`;
  } else if (period?.startDate) {
    periodText = `Período: A partir de ${period.startDate}`;
  } else if (period?.endDate) {
    periodText = `Período: Até ${period.endDate}`;
  }
  if (projectName) {
    periodText += ` | Projeto: ${projectName}`;
  }
  doc.text(periodText, marginX, 22);

  // Metadados à direita (data de emissão e emissor)
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const metaRight = `Emitido em: ${dateFormatted} às ${timeFormatted}${generatedBy ? ` por ${generatedBy}` : ''}`;
  doc.text(metaRight, pageWidth - marginX, 22, { align: 'right' });

  // Linha divisória horizontal
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(marginX, 25, pageWidth - marginX, 25);

  // 2. Blocos de Indicadores Executivos (KPIs)
  const cardY = 28;
  const cardHeight = 16;
  const availableWidth = pageWidth - marginX * 2;
  const cardGap = 4;
  const cardWidth = (availableWidth - cardGap * 2) / 3;

  const forgottenCount = entries.filter((e) => e.isForgotten).length;
  const avgSeconds = totalEntries > 0 ? Math.round(totalSeconds / totalEntries) : 0;

  const kpis = [
    {
      label: 'TEMPO TOTAL ACUMULADO',
      value: formatDurationHms(totalSeconds),
      sub: `${(totalSeconds / 3600).toFixed(2).replace('.', ',')} horas apuradas`,
      bgColor: [238, 242, 255] as [number, number, number], // indigo-50
      borderColor: [199, 210, 254] as [number, number, number],
      textColor: [67, 56, 202] as [number, number, number], // indigo-700
    },
    {
      label: 'TOTAL DE LANÇAMENTOS',
      value: String(totalEntries),
      sub: `Média de ${formatDurationHms(avgSeconds)} por registro`,
      bgColor: [248, 250, 252] as [number, number, number], // slate-50
      borderColor: [226, 232, 240] as [number, number, number],
      textColor: [51, 65, 85] as [number, number, number], // slate-700
    },
    {
      label: 'ALERTAS OPERACIONAIS',
      value: String(forgottenCount),
      sub: forgottenCount > 0 ? `${forgottenCount} registro(s) com tempo excedido` : 'Nenhum alerta registrado',
      bgColor: forgottenCount > 0 ? ([254, 243, 199] as [number, number, number]) : ([236, 253, 245] as [number, number, number]),
      borderColor: forgottenCount > 0 ? ([253, 230, 138] as [number, number, number]) : ([167, 243, 208] as [number, number, number]),
      textColor: forgottenCount > 0 ? ([180, 83, 9] as [number, number, number]) : ([4, 120, 87] as [number, number, number]),
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + cardGap);

    // Fundo do card
    doc.setFillColor(...kpi.bgColor);
    doc.setDrawColor(...kpi.borderColor);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...kpi.textColor);
    doc.text(kpi.label, x + 3, cardY + 4.5);

    // Valor principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(kpi.value, x + 3, cardY + 10.5);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 3, cardY + 14.5);
  });

  // 3. Tabela de Registros
  const headers = [
    'Data',
    'Horário',
    'Duração',
    'Projeto',
    'Descrição / Atividade',
    'Operador',
    'Status',
  ];

  const rows = entries.map((e) => {
    const horario = `${e.startTime} - ${e.endTime || 'Em andamento'}`;
    const duracao = `${e.durationFormatted}\n(${e.durationHours}h)`;
    let desc = e.description || '';
    if (e.entityTitle && e.entityTitle !== e.description) {
      desc = desc ? `${desc} (${e.entityTitle})` : e.entityTitle;
    }
    const status = e.isForgotten ? 'Alerta: Excedido' : 'Normal';

    return [
      e.date,
      horario,
      duracao,
      e.projectName || 'Avulso',
      desc || '-',
      e.userName || 'N/A',
      status,
    ];
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: cardY + cardHeight + 5,
    margin: { left: marginX, right: marginX, bottom: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, // Data
      1: { cellWidth: 35, halign: 'center' }, // Horário
      2: { cellWidth: 25, halign: 'center' }, // Duração
      3: { cellWidth: 45 },                   // Projeto
      4: { cellWidth: 'auto' },               // Descrição
      5: { cellWidth: 40 },                   // Operador
      6: { cellWidth: 30, halign: 'center' }, // Status
    },
    didParseCell: (data) => {
      // Destaca registros em alerta com cor de aviso âmbar
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const entry = entries[rowIndex];
        if (entry?.isForgotten) {
          if (data.column.index === 6) {
            data.cell.styles.textColor = [180, 83, 9]; // amber-700
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199]; // amber-100
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Rodapé em cada página
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400

      // Rodapé esquerdo
      doc.text(
        'EVRE — Sistema de Gerenciamento e Apontamento de Horas',
        marginX,
        pageHeight - 7,
      );

      // Rodapé direito (numeração de páginas)
      const pageNumber = (doc as any).internal.getNumberOfPages
        ? (doc as any).internal.getNumberOfPages()
        : data.pageNumber;
      doc.text(
        `Página ${data.pageNumber} de ${pageNumber}`,
        pageWidth - marginX,
        pageHeight - 7,
        { align: 'right' },
      );
    },
  });

  // Nome do arquivo para download
  let filename = `relatorio-tempo-${now.toISOString().slice(0, 10)}.pdf`;
  if (period?.startDate && period?.endDate) {
    const s = period.startDate.replace(/[/]/g, '-');
    const e = period.endDate.replace(/[/]/g, '-');
    filename = `relatorio-tempo-${s}-a-${e}.pdf`;
  }

  doc.save(filename);
  return filename;
}
