import { BadRequestException, Injectable } from '@nestjs/common';
import { FindSystemConfigByLabelKeyUseCase } from '../../system-configuration/use-cases/find-by-label-key.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import {
  PageLayoutValidator,
  asLayoutMap,
} from '../page-layout-validator.service';
import {
  PAGE_LAYOUTS_KEY,
  type SetPageLayoutInput,
} from '../dto/page-layout.dto';

/** Grava o layout padrão do sistema, visto por todo usuário sem layout próprio. */
@Injectable()
export class SetSystemPageLayoutUseCase {
  constructor(
    private readonly findByLabelKey: FindSystemConfigByLabelKeyUseCase,
    private readonly systemConfiguration: SystemConfigurationService,
    private readonly validator: PageLayoutValidator,
  ) {}

  async execute(
    performedById: string,
    roleName: string,
    input: SetPageLayoutInput,
  ): Promise<{ pageKey: string; blocks: number }> {
    await this.validator.assertWritable(roleName, input);

    const config = await this.findByLabelKey
      .execute(PAGE_LAYOUTS_KEY)
      .catch(() => null);
    if (!config) {
      throw new BadRequestException(
        `Configuração de sistema ${PAGE_LAYOUTS_KEY} não existe — rode o seed do backend.`,
      );
    }

    const layouts = asLayoutMap(config.value);
    layouts[input.pageKey] = input.layout;

    await this.systemConfiguration.update(
      config.id,
      { value: JSON.stringify(layouts) },
      performedById,
    );

    return { pageKey: input.pageKey, blocks: input.layout.blocks.length };
  }
}
