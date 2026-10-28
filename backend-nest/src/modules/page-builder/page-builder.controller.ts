import { Body, Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi, PutApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { PageSourceRegistry } from './page-source-registry.service';
import { SetPageLayoutUseCase } from './use-cases/set-page-layout.use-case';
import { GetSystemPageLayoutUseCase } from './use-cases/get-system-page-layout.use-case';
import { SetSystemPageLayoutUseCase } from './use-cases/set-system-page-layout.use-case';
import { PageSourceDto } from './dto/page-source.dto';
import { SetPageLayoutBodyDto } from './dto/set-page-layout.dto';
import { SystemPageLayoutsDto } from './dto/system-page-layouts.dto';

/** Endpoints do editor visual do PageBuilder: catálogo de fontes e escrita de layout. */
@ApiTags('page-builder')
@Controller('page-builder')
export class PageBuilderController {
  constructor(
    private readonly pageSources: PageSourceRegistry,
    private readonly setPageLayout: SetPageLayoutUseCase,
    private readonly getSystemPageLayout: GetSystemPageLayoutUseCase,
    private readonly setSystemPageLayout: SetSystemPageLayoutUseCase,
  ) {}

  /** Único endpoint do módulo fora da flag `PAGE_BUILDER`: exibição não depende de autoria. */
  @GetApi({
    path: 'system-layout',
    summary: 'Layout padrão do sistema',
    description:
      'Mapa pageKey → layout que vale para quem não tem layout próprio. Qualquer usuário ' +
      'autenticado lê, porque é caminho de exibição; só ADMIN grava. Devolve `{}` quando ' +
      'não há padrão configurado.',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Layouts padrão do sistema',
          schema: { dto: SystemPageLayoutsDto },
        },
      ],
    },
  })
  async listSystemLayouts(): Promise<SystemPageLayoutsDto> {
    return { layouts: await this.getSystemPageLayout.execute() };
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature('PAGE_BUILDER')
  @PutApi({
    path: 'system-layout',
    summary: 'Grava o layout padrão do sistema (Salvar como Padrão)',
    description:
      'Define o layout que todo usuário SEM layout próprio passa a ver. Merge por pageKey, ' +
      'mesma validação semântica da escrita de usuário. Restrito a ADMIN, e a alteração ' +
      'entra no log de auditoria de configuração do sistema.',
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        { status: 'OK', description: 'Layout padrão gravado com sucesso' },
        { status: 'BAD_REQUEST', description: 'Layout não renderizável' },
      ],
    },
  })
  saveSystemLayout(
    @Body() dto: SetPageLayoutBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.setSystemPageLayout.execute(user.id, user.roleName, dto);
  }

  // @UseGuards acima de @GetApi: o FeatureFlagGuard lê request.user e precisa rodar após a auth.
  @UseGuards(FeatureFlagGuard)
  @RequireFeature('PAGE_BUILDER')
  @GetApi({
    path: 'sources',
    summary: 'Lista as fontes de dados disponíveis para o usuário logado',
    description:
      'Catálogo de fontes do PageBuilder já filtrado pelo role de quem chamou. ' +
      'O editor usa `kind` para saber quais blocos aceitam cada fonte, `fields` para ' +
      'oferecer as colunas reais e `params` para montar os controles de parâmetro.',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Fontes disponíveis',
          schema: { dto: PageSourceDto, isArray: true, isPagination: false },
        },
      ],
    },
  })
  listSources(@CurrentUser() user: AuthenticatedUser): PageSourceDto[] {
    // Sem use-case — `listForRole` já É a regra, e um use-case de uma linha seria
    // só indireção. Se aparecer lógica além do filtro por role, extrair aí.
    return this.pageSources.listForRole(user.roleName).map((s) => ({
      key: s.key,
      kind: s.kind,
      description: s.description,
      fields: s.fields ?? [],
      params: s.params ?? [],
    }));
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature('PAGE_BUILDER')
  @PutApi({
    path: 'layout',
    summary: 'Grava o layout de uma página do usuário logado',
    description:
      'Mesma regra da tool set_page_layout: merge por pageKey (as outras páginas não são ' +
      'afetadas) e recusa de layout que grava mas não renderiza. Enviar `blocks` vazio ' +
      'limpa a página, que volta a renderizar a versão em código.',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        { status: 'OK', description: 'Layout gravado com sucesso' },
        { status: 'BAD_REQUEST', description: 'Layout não renderizável' },
      ],
    },
  })
  saveLayout(
    // Validado pelo ZodValidationPipe global (main.ts) a partir do schema do createZodDto —
    // exatamente o mesmo que a tool do agente usa.
    @Body() dto: SetPageLayoutBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.setPageLayout.execute(user.id, user.roleName, dto);
  }
}
