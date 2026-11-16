import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import type { SendEmailDto } from '../dto/send-email.dto';
import type { ProviderResult } from 'src/domain/interface/provider-result';

@Injectable()
export class SendEmailUseCase {
  constructor(private readonly emailService: EmailService) {}

  async execute(dto: SendEmailDto, performedById: string): Promise<ProviderResult> {
    return this.emailService.send({
      to: dto.to,
      subject: dto.subject,
      html: dto.html,
      performedById,
    });
  }
}
