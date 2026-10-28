import { Injectable, Logger } from '@nestjs/common';
import { FindSystemConfigByLabelKeyUseCase } from '../../system-configuration/use-cases/find-by-label-key.use-case';
import { asLayoutMap } from '../page-layout-validator.service';
import { PAGE_LAYOUTS_KEY, type PageLayout } from '../dto/page-layout.dto';

/** Retorna o layout padrão do sistema, ou um mapa vazio se não configurado ou inválido. */
@Injectable()
export class GetSystemPageLayoutUseCase {
  private readonly logger = new Logger(GetSystemPageLayoutUseCase.name);

  constructor(
    private readonly findByLabelKey: FindSystemConfigByLabelKeyUseCase,
  ) {}

  async execute(): Promise<Record<string, PageLayout>> {
    try {
      const config = await this.findByLabelKey.execute(PAGE_LAYOUTS_KEY);
      return asLayoutMap(config.value);
    } catch {
      // NotFound é o caso normal de quem ainda não rodou o seed com PAGE_LAYOUTS.
      this.logger.debug(`${PAGE_LAYOUTS_KEY} não configurado no sistema`);
      return {};
    }
  }
}
