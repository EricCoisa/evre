import { Controller, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { PostApi, GetApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { VerificationService } from './verification.service';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ConfirmVerificationDto } from './dto/confirm-verification.dto';
import { VerificationRequestResponseDto } from './dto/verification-request-response.dto';
import {
  VerificationHealthQuerySchema,
  type VerificationHealthQuery,
} from './dto/verification-health-query.dto';
import { VerificationHealthResponseDto } from './dto/verification-health-response.dto';

/** Só o mecanismo de pedir/confirmar um código por propósito, sem efeito de negócio. */
@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  // Mesmo padrão de rate-limit de forgot-password (3/min por usuário autenticado).
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @PostApi({
    path: 'request',
    summary: 'Solicita um código de verificação para um propósito',
    status: 'CREATED',
    authenticated: true,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Código enviado',
          schema: { dto: VerificationRequestResponseDto },
        },
      ],
    },
  })
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestVerificationDto,
  ): Promise<VerificationRequestResponseDto> {
    return this.verificationService.request({
      userId: user.id,
      purpose: dto.purpose,
      channel: dto.channel,
      target: dto.target,
    });
  }

  @PostApi({
    path: 'confirm',
    summary: 'Confirma o código de verificação de um propósito',
    status: 'NO_CONTENT',
    authenticated: true,
  })
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmVerificationDto,
  ): Promise<void> {
    await this.verificationService.confirm({
      userId: user.id,
      purpose: dto.purpose,
      code: dto.code,
    });
  }

  // "Pronto para enviar" via cache do EmailService / consultas baratas do Messaging — sem
  // Redis próprio aqui (ver CheckChannelHealthUseCase). Qualquer usuário autenticado pode ler:
  // é isso que permite um botão se autodesabilitar (ver docs/frontend/service-health-gate.md).
  @GetApi({
    path: 'health',
    summary: 'Saúde de um canal de verificação (pronto para enviar)',
    status: 'OK',
    authenticated: true,
    queries: [
      {
        name: 'channel',
        required: true,
        schema: {
          type: 'string',
          enum: ['EMAIL', 'WHATSAPP', 'AUTHENTICATOR'],
        },
      },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Status do canal',
          schema: { dto: VerificationHealthResponseDto },
        },
      ],
    },
  })
  async health(
    @Query(new ZodValidationPipe(VerificationHealthQuerySchema))
    query: VerificationHealthQuery,
  ) {
    return this.verificationService.checkChannelHealth(query.channel);
  }
}
