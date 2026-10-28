import {
  Get,
  Post,
  Put,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  SetMetadata,
  applyDecorators,
  Type,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiQueryOptions,
  ApiBody,
  ApiExtension,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';

import { JwtOrApiKeyAuthGuard } from '../guards/jwt-or-api-key.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ScopeGuard, API_SCOPE_KEY } from '../guards/scope.guard';
import { Roles } from './roles.decorator';
import {
  PAGE_SOURCE_KEY,
  type PageSourceEntry,
  type PageSourceMeta,
} from '../../domain/page-builder/page-source.types';

interface ApiResponseSchema {
  dto: Type<unknown>;
  isArray?: boolean;
  isPagination?: boolean;
}

interface ApiResponseItem {
  status: keyof typeof HttpStatus;
  description: string;
  schema?: ApiResponseSchema;
  type?: Type<unknown> | string;
}

interface ApiResponseConfig {
  status?: number;
  description?: string;
  type?: Type<unknown> | string;
  isArray?: boolean;
  success?: ApiResponseItem[];
}

interface ApiMethodConfig {
  path?: string;
  summary: string;
  description?: string;
  roles?: string[];
  authenticated?: boolean;
  /** Escopo exigido quando a requisição usa API key (default-deny sem scope). */
  scope?: string;
  /** Libera o endpoint como fonte do PageBuilder; exige um dos shapes de `PageSourceKind`. */
  pageSource?: PageSourceMeta;
  status?: keyof typeof HttpStatus;
  response?: ApiResponseConfig;
  queries?: ApiQueryOptions[];
  body?: Type<unknown> | string;
}

const applyMethod = (
  verb: 'Get' | 'Post' | 'Put' | 'Patch' | 'Delete',
  config: ApiMethodConfig,
) => {
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [];

  // HTTP Verb
  const methods = { Get, Post, Put, Patch, Delete };
  decorators.push(methods[verb](config.path || ''));

  // HTTP Status Code
  if (config.status) {
    decorators.push(HttpCode(HttpStatus[config.status]));
  }

  // Swagger Operation
  decorators.push(
    ApiOperation({
      summary: config.summary,
      description: config.description,
    }),
  );

  // Authentication & Authorization
  if (config.roles?.length) {
    decorators.push(
      UseGuards(JwtOrApiKeyAuthGuard, ScopeGuard, RolesGuard),
      Roles(...config.roles),
      ApiBearerAuth(),
    );
  } else if (config.authenticated) {
    decorators.push(
      UseGuards(JwtOrApiKeyAuthGuard, ScopeGuard),
      ApiBearerAuth(),
    );
  }

  // Scope para API keys (default-deny: endpoint sem scope é inalcançável por chave)
  if (config.scope) {
    decorators.push(SetMetadata(API_SCOPE_KEY, config.scope));
  }

  // Registra metadata do PageSource (PageSourceRegistry + extensão OpenAPI) com os roles do endpoint
  if (config.pageSource) {
    const entry: PageSourceEntry = {
      ...config.pageSource,
      roles: config.roles ?? [],
    };
    decorators.push(
      SetMetadata(PAGE_SOURCE_KEY, entry),
      ApiExtension('x-page-source', entry),
    );
  }

  // Response Schema
  if (config.response) {
    if (config.response.success) {
      // Nova estrutura com success array
      config.response.success.forEach((item) => {
        const statusCode = HttpStatus[item.status];
        if (item.schema) {
          // Registrar o DTO no Swagger
          decorators.push(ApiExtraModels(item.schema.dto));
          if (item.schema.isPagination) {
            // Resposta paginada
            decorators.push(
              ApiResponse({
                status: statusCode,
                description: item.description,
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: getSchemaPath(item.schema.dto) },
                    },
                    meta: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalPages: { type: 'number' },
                      },
                    },
                  },
                },
              }),
            );
          } else {
            // Resposta normal (array ou objeto único)
            decorators.push(
              ApiResponse({
                status: statusCode,
                description: item.description,
                type: item.schema.dto,
                isArray: item.schema.isArray || false,
              }),
            );
          }
        } else if (item.type) {
          // Tipo primitivo (ex.: Boolean) declarado via `type`
          decorators.push(
            ApiResponse({
              status: statusCode,
              description: item.description,
              type: item.type,
            }),
          );
        } else {
          decorators.push(
            ApiResponse({
              status: statusCode,
              description: item.description,
            }),
          );
        }
      });
    } else {
      // Estrutura antiga (compatibilidade)
      decorators.push(
        ApiResponse({
          status: config.response.status || 200,
          description: config.response.description,
          type: config.response.type,
          isArray: config.response.isArray || false,
        }),
      );
    }
  }

  // Query Parameters
  if (config.queries?.length) {
    config.queries.forEach((query) => decorators.push(ApiQuery(query)));
  }

  // Body Schema
  if (config.body) {
    decorators.push(ApiBody({ type: config.body }));
  }

  return applyDecorators(...decorators);
};

export const GetApi = (config: ApiMethodConfig) => applyMethod('Get', config);

export const PostApi = (config: ApiMethodConfig) => applyMethod('Post', config);

export const PutApi = (config: ApiMethodConfig) => applyMethod('Put', config);

export const PatchApi = (config: ApiMethodConfig) =>
  applyMethod('Patch', config);

export const DeleteApi = (config: ApiMethodConfig) =>
  applyMethod('Delete', config);
