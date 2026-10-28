import { Injectable, OnModuleInit } from '@nestjs/common';
import { CapabilityRegistry } from '../capability/capability.registry';
import { EmailService } from './email.service';
import { EMAIL_CAPABILITY } from 'src/domain/mail/email-template-type.const';

@Injectable()
export class EmailCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(EMAIL_CAPABILITY, {
      flags: [],
      check: () => this.emailService.checkHealth(),
    });
  }
}
