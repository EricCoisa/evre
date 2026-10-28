import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { CaptchaProviderIds } from '../../../domain/auth/captcha.const';

/** Formulário de credenciais: `secretKey` vazia mantém a gravada; `token` é o do widget, que valida o par. */
export const SaveCaptchaConfigSchema = z.object({
  provider: z.string().min(1),
  siteKey: z.string().min(1),
  secretKey: z.string().optional(),
  token: z.string().optional(),
});

export class SaveCaptchaConfigDto extends createZodDto(
  SaveCaptchaConfigSchema,
) {
  @ApiProperty({ enum: CaptchaProviderIds }) provider: string;
  @ApiProperty() siteKey: string;
  @ApiProperty({
    required: false,
    description: 'Vazia mantém a credencial já gravada',
  })
  secretKey?: string;
  @ApiProperty({
    required: false,
    description:
      'Token do widget resolvido no browser — sem ele só a secret key é validada',
  })
  token?: string;
}

/** Catálogo para a tela de configuração — ver CaptchaProviders no domínio. */
export class CaptchaProviderDto {
  @ApiProperty({ example: 'TURNSTILE' }) id: string;
  @ApiProperty({ example: 'Cloudflare Turnstile' }) label: string;
  @ApiProperty({
    description:
      'URL do script, para a tela desenhar o widget com a site key digitada antes de salvar',
  })
  scriptUrl: string;
}

/** Só dado público: site key é para ir ao browser mesmo. */
export class CaptchaConfigDto {
  @ApiProperty({
    description:
      'false quando desligado, sem provider escolhido ou sem credencial preenchida',
  })
  enabled: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: CaptchaProviderIds,
    description: 'Provider escolhido pelo dono do sistema',
  })
  provider: string | null;

  // `type: String` explícito: sem ele o Swagger não infere `string | null` do TS
  // e o Orval gera `{ [key: string]: unknown }` no lugar de string.
  @ApiProperty({ type: String, required: false, nullable: true })
  siteKey: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'URL do script do provider, pronta para o front injetar',
  })
  scriptUrl: string | null;
}
