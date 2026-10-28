import { Injectable } from '@nestjs/common';
import { EmailService, type EmailTemplateInfo } from '../email.service';

@Injectable()
export class ListEmailTemplatesUseCase {
  constructor(private readonly emailService: EmailService) {}

  async execute(): Promise<EmailTemplateInfo[]> {
    return this.emailService.listTemplates();
  }
}
