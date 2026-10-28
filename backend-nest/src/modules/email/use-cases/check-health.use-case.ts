import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';

@Injectable()
export class CheckEmailHealthUseCase {
  constructor(private readonly emailService: EmailService) {}

  async execute(): Promise<{ operational: boolean; reason?: string }> {
    return this.emailService.checkHealth();
  }
}
