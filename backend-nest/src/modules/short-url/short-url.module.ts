import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ShortUrlService } from './short-url.service';
import { ShortUrlRedirectController } from './short-url-redirect.controller';
import { ShortenUrlUseCase } from './use-cases/shorten-url.use-case';
import { ResolveShortUrlUseCase } from './use-cases/resolve-short-url.use-case';
import { DeactivateShortUrlUseCase } from './use-cases/deactivate-short-url.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [ShortUrlRedirectController],
  providers: [
    ShortUrlService,
    ShortenUrlUseCase,
    ResolveShortUrlUseCase,
    DeactivateShortUrlUseCase,
  ],
  exports: [ShortUrlService],
})
export class ShortUrlModule {}
