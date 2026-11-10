import { Injectable } from '@nestjs/common';
import { PdfService } from 'src/modules/pdf/pdf.service';
import { ExportTimeEntriesUseCase } from './export-time-entries.use-case';
import { buildTimeEntriesHtml } from '../pdf/time-entries-pdf.factory';
import type { ListTimeEntriesDto } from '../dto/list-time-entries.dto';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class ExportTimeEntriesPdfUseCase {
  constructor(
    private readonly exportTimeEntries: ExportTimeEntriesUseCase,
    private readonly pdf: PdfService,
  ) {}

  async execute(
    dto: ListTimeEntriesDto,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const data = await this.exportTimeEntries.execute(dto, user);
    const html = await buildTimeEntriesHtml(data);
    return this.pdf.generate(html, { orientation: 'landscape' });
  }
}
