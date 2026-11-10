import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { PdfCapabilities } from './pdf.capabilities';
import { CheckPdfHealthUseCase } from './use-cases/check-health.use-case';

@Module({
  providers: [PdfService, CheckPdfHealthUseCase, PdfCapabilities],
  exports: [PdfService],
  controllers: [PdfController],
})
export class PdfModule {}
