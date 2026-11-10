import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { CheckPdfHealthUseCase } from './use-cases/check-health.use-case';

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(private readonly checkPdfHealth: CheckPdfHealthUseCase) {}

  @GetApi({
    path: 'health',
    summary: 'Saúde do serviço PDF / Gotenberg (via cache)',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async health(): Promise<{ operational: boolean; reason?: string }> {
    return this.checkPdfHealth.execute();
  }
}
