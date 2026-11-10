import { Injectable, OnModuleInit } from '@nestjs/common';
import { CapabilityRegistry } from '../capability/capability.registry';
import { PdfService } from './pdf.service';
import { PDF_CAPABILITY } from 'src/domain/pdf/pdf.const';

@Injectable()
export class PdfCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly pdfService: PdfService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(PDF_CAPABILITY, {
      flags: [],
      check: () => this.pdfService.checkHealth(),
    });
  }
}
