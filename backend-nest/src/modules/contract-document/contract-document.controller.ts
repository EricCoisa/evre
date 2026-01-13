import { Controller, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GetApi,
  PostApi,
  PutApi,
} from '../../common/decorators/api-method.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import { ContractDocumentService } from './contract-document.service';
import { CreateContractDocumentDto } from './dto/create-contract-document.dto';
import { UpdateContractDocumentContentDto } from './dto/update-contract-document-content.dto';
import { ContractDocumentDto } from './dto/contract-document.dto';

@ApiTags('contract-document')
@Controller('contract-documents')
export class ContractDocumentController {
  constructor(
    private readonly contractDocumentService: ContractDocumentService,
  ) {}

  @GetApi({
    summary: 'Lista documentos contratuais',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: {
            dto: ContractDocumentDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ) {
    const result = await this.contractDocumentService.findAll(query);

    if (Array.isArray(result)) {
      return result.map((contract) => new ContractDocumentDto(contract));
    }

    return {
      data: result.data.map((contract) => new ContractDocumentDto(contract)),
      meta: result.meta,
      filter: result.filter,
    };
  }

  @GetApi({
    path: ':id',
    summary: 'Busca documento contratual por ID',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documento contratual',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string) {
    return await this.contractDocumentService.findOne(id);
  }

  @GetApi({
    path: 'project/:projectId',
    summary: 'Busca documentos por projeto',
    description:
      'Retorna documentos contratuais de um projeto específico. Valida acesso do usuário ao projeto.',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documentos do projeto',
          schema: { dto: ContractDocumentDto, isArray: true },
        },
      ],
    },
  })
  async findByProject(
    @Param('projectId') projectId: string,
    @Request() req: { user: { sub: string; role: string; companyId?: string } },
  ) {
    return await this.contractDocumentService.findByProject(
      projectId,
      req.user,
    );
  }

  @PostApi({
    summary: 'Cria documento contratual',
    status: 'CREATED',
    authenticated: true,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Documento criado',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async create(
    @Body() dto: CreateContractDocumentDto,
    @Request() req: { user: { sub: string } },
  ) {
    return await this.contractDocumentService.create(dto, req.user.sub);
  }

  @PutApi({
    path: ':id/content',
    summary: 'Atualiza conteúdo do documento contratual',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documento atualizado',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateContractDocumentContentDto,
    @Request() req: { user: { sub: string } },
  ) {
    return await this.contractDocumentService.update(id, dto, req.user.sub);
  }

  @PostApi({
    path: ':id/send',
    summary: 'Envia documento contratual',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documento enviado',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async send(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return await this.contractDocumentService.send(id, req.user.sub);
  }

  @PostApi({
    path: ':id/accept',
    summary: 'Aceita documento contratual',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documento aceito',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async accept(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return await this.contractDocumentService.accept(id, req.user.sub);
  }

  @PostApi({
    path: ':id/archive',
    summary: 'Arquiva documento contratual',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Documento arquivado',
          schema: { dto: ContractDocumentDto },
        },
      ],
    },
  })
  async archive(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return await this.contractDocumentService.archive(id, req.user.sub);
  }
}
