import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { EmailService } from './email.service';
import { EmailProviderResponse } from 'src/domain/interface/email.response';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @GetApi({
    path: 'validate',
    summary: 'Valida serviço de email',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async validateConfiguration(): Promise<EmailProviderResponse> {
    try {
      await this.emailService.validateConfiguration();
      return {
        status: true,
        data: 'Configuration is valid',
      };
    } catch {
      return {
        status: false,
        data: 'Unknown error',
      };
    }
  }
}
