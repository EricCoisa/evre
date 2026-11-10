import { Injectable } from '@nestjs/common';
import { PdfService } from '../pdf.service';

@Injectable()
export class CheckPdfHealthUseCase {
  constructor(private readonly pdfService: PdfService) {}

  async execute(): Promise<{ operational: boolean; reason?: string }> {
    return this.pdfService.checkHealth();
  }
}
