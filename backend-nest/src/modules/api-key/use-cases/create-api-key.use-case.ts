import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { LoggingService } from '../../logging/logging.service';
import { ApiKeyService } from '../api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(dto: CreateApiKeyDto, userId: string) {
    const rawKey = this.apiKeyService.generate();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash: this.apiKeyService.hash(rawKey),
        keyPrefix: rawKey.slice(0, 12),
        scopes: dto.scopes,
        userId,
        expiresAt: dto.expiresAt ?? null,
      },
    });

    await this.loggingService.create(
      {
        module: 'API_KEY',
        action: LogActions.API_KEY_CREATED,
        message: `API key criada: ${apiKey.name}`,
        metadata: { apiKeyId: apiKey.id, scopes: apiKey.scopes },
      },
      userId,
    );

    // rawKey é exibido UMA única vez — o banco guarda apenas o hash.
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      rawKey,
    };
  }
}
