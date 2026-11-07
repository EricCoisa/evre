import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { MessagingFeatureFlag } from 'src/domain/messaging/messaging.const';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';
import {
  CreateMessagingTemplateTypeDto,
  MessagingTemplateTypeDto,
  MessagingTemplateVariableDto,
  MessagingTemplateButtonsInfoDto,
  UpdateMessagingTemplateTypeDto,
} from './dto/messaging-template-type.dto';
import {
  CreateMessagingTemplateDto,
  MessagingTemplateDto,
  UpdateMessagingTemplateDto,
} from './dto/messaging-template.dto';
import {
  CheckMetaTemplateDto,
  MessagingTemplateSubmissionDto,
  MetaTemplateCheckDto,
  SubmitTemplateDto,
} from './dto/messaging-template-submission.dto';
import { ListTemplateTypesUseCase } from './use-cases/list-template-types.use-case';
import { GetTemplateTypeUseCase } from './use-cases/get-template-type.use-case';
import { CreateTemplateTypeUseCase } from './use-cases/create-template-type.use-case';
import { UpdateTemplateTypeUseCase } from './use-cases/update-template-type.use-case';
import { RemoveTemplateTypeUseCase } from './use-cases/remove-template-type.use-case';
import { ListTemplatesUseCase } from './use-cases/list-templates.use-case';
import { GetTemplateUseCase } from './use-cases/get-template.use-case';
import { CreateTemplateUseCase } from './use-cases/create-template.use-case';
import { UpdateTemplateUseCase } from './use-cases/update-template.use-case';
import { RemoveTemplateUseCase } from './use-cases/remove-template.use-case';
import { SubmitTemplateUseCase } from './use-cases/submit-template.use-case';
import { ReconcileTemplateSubmissionsUseCase } from './use-cases/reconcile-template-submissions.use-case';
import { ListTemplateVariablesUseCase } from './use-cases/list-template-variables.use-case';
import { ListTemplateButtonsUseCase } from './use-cases/list-template-buttons.use-case';
import { CheckMetaTemplateUseCase } from './use-cases/check-meta-template.use-case';

import {
  ImportRemoteTemplateDto,
  LinkRemoteTemplateDto,
  RemoteTemplateItemDto,
} from './dto/messaging-remote-template.dto';
import { ListRemoteTemplatesUseCase } from './use-cases/list-remote-templates.use-case';
import { LinkRemoteTemplateUseCase } from './use-cases/link-remote-template.use-case';
import { ImportRemoteTemplateUseCase } from './use-cases/import-remote-template.use-case';

const ListTemplatesQuerySchema = PaginationQuerySchema.extend({
  typeId: z.string().optional(),
  connectionId: z.string().optional(),
});

import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

/** Separado do controller principal de mensageria para não empurrá-lo a 28 use-cases injetados (mcp/ já faz isso). */
@ApiTags('messaging')
@UseGuards(FeatureFlagGuard)
@RequireFeature(MessagingFeatureFlag.TEMPLATES)
@Controller('messaging')
@RouteAccess(RoutePathConst.COMMUNICATION_TEMPLATES)
export class MessagingTemplateController {
  constructor(
    private readonly listTypes: ListTemplateTypesUseCase,
    private readonly getType: GetTemplateTypeUseCase,
    private readonly createType: CreateTemplateTypeUseCase,
    private readonly updateType: UpdateTemplateTypeUseCase,
    private readonly removeType: RemoveTemplateTypeUseCase,
    private readonly listTemplates: ListTemplatesUseCase,
    private readonly getTemplate: GetTemplateUseCase,
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly updateTemplate: UpdateTemplateUseCase,
    private readonly removeTemplate: RemoveTemplateUseCase,
    private readonly submitTemplate: SubmitTemplateUseCase,
    private readonly reconcileSubmissions: ReconcileTemplateSubmissionsUseCase,
    private readonly listVariables: ListTemplateVariablesUseCase,
    private readonly listButtons: ListTemplateButtonsUseCase,
    private readonly checkMeta: CheckMetaTemplateUseCase,
    private readonly listRemoteTemplates: ListRemoteTemplatesUseCase,
    private readonly linkRemoteTemplate: LinkRemoteTemplateUseCase,
    private readonly importRemoteTemplate: ImportRemoteTemplateUseCase,
  ) {}

  @GetApi({
    path: 'template-buttons',
    summary:
      'Lista os botões reservados e os handlers de botão registrados em código',
    description:
      'Reservados são liberados por tipo; handlers mostram, para cada botão custom, se já existe código reagindo ao toque do cliente.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Reservados e handlers',
          schema: { dto: MessagingTemplateButtonsInfoDto },
        },
      ],
    },
  })
  listTemplateButtonsHandler() {
    return this.listButtons.execute();
  }

  @GetApi({
    path: 'template-variables',
    summary: 'Lista as variáveis reservadas do sistema',
    description:
      'Globais a qualquer template: derivadas do contexto do envio ou fornecidas por quem dispara. Nunca entram no formulário do operador.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Variáveis reservadas',
          schema: { dto: MessagingTemplateVariableDto, isArray: true },
        },
      ],
    },
  })
  listTemplateVariablesHandler() {
    return this.listVariables.execute();
  }

  @GetApi({
    path: 'template-types',
    summary: 'Lista os tipos de template (vocabulário de variáveis)',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [
      { name: 'page', required: false, type: Number },
      { name: 'limit', required: false, type: Number },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Tipos de template',
          schema: {
            dto: MessagingTemplateTypeDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async listTemplateTypes(@Query() query: Record<string, string>) {
    return this.listTypes.execute(PaginationQuerySchema.parse(query));
  }

  @GetApi({
    path: 'template-types/:id',
    summary: 'Busca um tipo de template por id',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Tipo encontrado',
          schema: { dto: MessagingTemplateTypeDto },
        },
      ],
    },
  })
  async getTemplateType(@Param('id') id: string) {
    return this.getType.execute(id);
  }

  @PostApi({
    path: 'template-types',
    summary: 'Cria um tipo de template',
    description:
      'Declara o vocabulário de variáveis compartilhado por todas as linguagens do template.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: CreateMessagingTemplateTypeDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Tipo criado',
          schema: { dto: MessagingTemplateTypeDto },
        },
      ],
    },
  })
  async createTemplateType(@Body() dto: CreateMessagingTemplateTypeDto) {
    return this.createType.execute(dto);
  }

  @PatchApi({
    path: 'template-types/:id',
    summary: 'Atualiza um tipo de template',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: UpdateMessagingTemplateTypeDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Tipo atualizado',
          schema: { dto: MessagingTemplateTypeDto },
        },
      ],
    },
  })
  async updateTemplateType(
    @Param('id') id: string,
    @Body() dto: UpdateMessagingTemplateTypeDto,
  ) {
    return this.updateType.execute(id, dto);
  }

  @DeleteApi({
    path: 'template-types/:id',
    summary: 'Remove um tipo de template',
    description: 'Falha se algum template ainda referenciar este tipo.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
  })
  async removeTemplateType(@Param('id') id: string) {
    return this.removeType.execute(id);
  }

  @GetApi({
    path: 'templates',
    summary: 'Lista os templates do catálogo',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [
      { name: 'page', required: false, type: Number },
      { name: 'limit', required: false, type: Number },
      { name: 'typeId', required: false, type: String },
      {
        name: 'connectionId',
        required: false,
        type: String,
        description:
          'Presente = cada template sai com approvalStatus calculado para essa conexão',
      },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Templates',
          schema: {
            dto: MessagingTemplateDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async listTemplatesHandler(@Query() query: Record<string, string>) {
    return this.listTemplates.execute(ListTemplatesQuerySchema.parse(query));
  }

  @GetApi({
    path: 'templates/:id',
    summary: 'Busca um template por id',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Template encontrado',
          schema: { dto: MessagingTemplateDto },
        },
      ],
    },
  })
  async getTemplateHandler(@Param('id') id: string) {
    return this.getTemplate.execute(id);
  }

  @PostApi({
    path: 'templates',
    summary: 'Cria um template no catálogo',
    description:
      'Já pode ser usado no envio por provider sem fluxo de aprovação (Evolution). Na Meta, submissão é sempre manual — ver POST .../submissions.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: CreateMessagingTemplateDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Template criado',
          schema: { dto: MessagingTemplateDto },
        },
      ],
    },
  })
  async createTemplateHandler(@Body() dto: CreateMessagingTemplateDto) {
    return this.createTemplate.execute(dto);
  }

  @PatchApi({
    path: 'templates/:id',
    summary: 'Atualiza um template do catálogo',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: UpdateMessagingTemplateDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Template atualizado',
          schema: { dto: MessagingTemplateDto },
        },
      ],
    },
  })
  async updateTemplateHandler(
    @Param('id') id: string,
    @Body() dto: UpdateMessagingTemplateDto,
  ) {
    return this.updateTemplate.execute(id, dto);
  }

  @DeleteApi({
    path: 'templates/:id',
    summary: 'Remove um template do catálogo',
    description:
      'Por padrão remove também na WABA de cada conexão em que foi submetido e só apaga localmente se todas aceitarem. `remote=false` apaga apenas localmente.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
  })
  async removeTemplateHandler(
    @Param('id') id: string,
    @Query('remote') remote?: string,
  ) {
    return this.removeTemplate.execute(id, remote !== 'false');
  }

  @PostApi({
    path: 'templates/check-meta',
    summary: 'Confere um rascunho de template contra as regras da Meta',
    description:
      'Mesmas regras que barram a submissão (variável no início/fim do corpo, variável no rodapé, link encurtado…), sem gravar nada. `error` barra a submissão; `warning` só avisa.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    body: CheckMetaTemplateDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Problemas encontrados (lista vazia = nada a apontar)',
          schema: { dto: MetaTemplateCheckDto },
        },
      ],
    },
  })
  checkMetaTemplateHandler(@Body() dto: CheckMetaTemplateDto) {
    return this.checkMeta.execute(dto);
  }

  @PostApi({
    path: 'templates/:id/submissions',
    summary: 'Cria ou edita o template na WABA da conexão',
    description:
      'Sempre manual: criar a conexão não submete nada. Editar um template aprovado volta a submissão para PENDING.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SubmitTemplateDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Submissão criada ou atualizada',
          schema: { dto: MessagingTemplateSubmissionDto },
        },
      ],
    },
  })
  async submitTemplateHandler(
    @Param('id') id: string,
    @Body() dto: SubmitTemplateDto,
  ) {
    return this.submitTemplate.execute(id, dto);
  }

  @PostApi({
    path: 'connections/:id/templates/reconcile',
    summary: 'Reconcilia submissões PENDING contra o catálogo remoto',
    description:
      'Sob demanda (botão "Verificar status"), nunca por polling — só consulta a WABA se houver submissão PENDING. A aprovação é assíncrona e chega por webhook; use quando o aviso se perdeu.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
  })
  async reconcileHandler(@Param('id') id: string) {
    return this.reconcileSubmissions.execute(id);
  }

  @GetApi({
    path: 'connections/:id/templates/remote',
    summary: 'Lista os templates salvos na WABA do provedor (Meta)',
    description:
      'Consulta o catálogo remoto na Meta e identifica correspondências com templates locais para verificação e vínculo.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista de templates remotos com compatibilidade local',
          schema: { dto: RemoteTemplateItemDto, isArray: true },
        },
      ],
    },
  })
  async listRemoteTemplatesHandler(@Param('id') id: string) {
    return this.listRemoteTemplates.execute(id);
  }

  @PostApi({
    path: 'connections/:id/templates/link',
    summary: 'Vincula um template da Meta a um template local existente',
    description:
      'Cria ou atualiza a submissão vinculando o template local com o ID do template no provedor.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: LinkRemoteTemplateDto,
  })
  async linkRemoteTemplateHandler(
    @Param('id') id: string,
    @Body() dto: LinkRemoteTemplateDto,
  ) {
    return this.linkRemoteTemplate.execute(id, dto);
  }

  @PostApi({
    path: 'connections/:id/templates/import',
    summary:
      'Baixa e cria um template da Meta localmente, vinculando-o à conexão',
    description:
      'Cria o tipo de template (se necessário), cria o template local com os componentes da Meta e cria a submissão vinculada.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: ImportRemoteTemplateDto,
  })
  async importRemoteTemplateHandler(
    @Param('id') id: string,
    @Body() dto: ImportRemoteTemplateDto,
  ) {
    return this.importRemoteTemplate.execute(id, dto);
  }
}
