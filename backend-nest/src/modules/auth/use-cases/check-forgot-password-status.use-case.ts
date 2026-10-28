import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

@Injectable()
export class CheckForgotPasswordStatusUseCase {
  constructor(private readonly emailService: EmailService) {}

  async execute(): Promise<{ available: boolean }> {
    const health = await this.emailService.checkHealth();
    return { available: health.operational === true };
  }
}
