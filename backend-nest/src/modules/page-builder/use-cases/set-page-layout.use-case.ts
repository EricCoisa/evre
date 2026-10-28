import { BadRequestException, Injectable } from '@nestjs/common';
import { GetUserConfigurationByKeyUseCase } from '../../user-configuration/use-cases/get-by-key.use-case';
import { SetUserConfigurationUseCase } from '../../user-configuration/use-cases/set-user-configuration.use-case';
import {
  PageLayoutValidator,
  asLayoutMap,
} from '../page-layout-validator.service';
import {
  PAGE_LAYOUTS_KEY,
  type SetPageLayoutInput,
} from '../dto/page-layout.dto';

/** Grava o layout de uma página do usuário logado em `UserConfiguration.PAGE_LAYOUTS`. */
@Injectable()
export class SetPageLayoutUseCase {
  constructor(
    private readonly getByKey: GetUserConfigurationByKeyUseCase,
    private readonly setUserConfiguration: SetUserConfigurationUseCase,
    private readonly validator: PageLayoutValidator,
  ) {}

  async execute(
    userId: string,
    roleName: string,
    input: SetPageLayoutInput,
  ): Promise<{ pageKey: string; blocks: number }> {
    await this.validator.assertWritable(roleName, input);

    const config = await this.getByKey.execute(userId, PAGE_LAYOUTS_KEY, {
      roleName,
    });
    if (!config) {
      throw new BadRequestException(
        `Definição ${PAGE_LAYOUTS_KEY} não existe — rode o seed do backend.`,
      );
    }

    // Merge por pageKey: o valor guardado é o mapa de TODAS as páginas, então gravar só o
    // layout recebido apagaria as outras. O agente edita uma página de cada vez.
    const layouts = asLayoutMap(config.value);
    layouts[input.pageKey] = input.layout;

    await this.setUserConfiguration.execute(userId, {
      definitionId: config.id,
      value: JSON.stringify(layouts),
    });

    return { pageKey: input.pageKey, blocks: input.layout.blocks.length };
  }
}
