
import { Controller, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { GetApi, PostApi } from '../../common/decorators/api-method.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { ContactDto } from './dto/contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { commonPaginationQueries } from 'src/common/swagger/pagination-queries';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
	constructor(private readonly contactService: ContactService) {}

	@GetApi({
		summary: 'Lista contatos',
		description: 'Retorna uma lista paginada de contatos enviados pela landing page',
		status: 'OK',
		authenticated: false,
    queries: commonPaginationQueries,
		response: {
			success: [
				{
					status: 'OK',
					description: 'Resposta paginada',
					schema: { dto: ContactDto, isArray: true, isPagination: true },
				},
			],
		},
	})
	async findAll(
		@Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
	): Promise<PaginatedResponse<ContactDto> | ContactDto[]> {
		const result = await this.contactService.findAll(query);
		if ('data' in result) {
			return {
				...result,
				data: result.data.map((c) => new ContactDto(c)),
			};
		}
		return result.map((c) => new ContactDto(c));
	}

	@PostApi({
		summary: 'Cria contato',
		description: 'Cria um novo contato enviado pela landing page',
		status: 'CREATED',
		authenticated: false,
		response: {
			success: [
				{
					status: 'CREATED',
					description: 'Contato criado com sucesso',
					schema: { dto: ContactDto },
				},
			],
		},
	})
	async create(@Body() dto: CreateContactDto): Promise<ContactDto> {
		const contact = await this.contactService.create(dto);
		return new ContactDto(contact);
	}
}
