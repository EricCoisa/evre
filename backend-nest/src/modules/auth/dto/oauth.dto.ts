import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { OAUTH_INTENTS } from '../../../domain/auth/oauthProvider.const';

const OauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export class OauthCallbackDto extends createZodDto(OauthCallbackSchema) {}

const OauthAuthorizeRequestSchema = z.object({
  callbackUrl: z.string().optional(),
  inviteToken: z.string().optional(),
  intent: z.enum(OAUTH_INTENTS).default('LOGIN'),
});

export class OauthAuthorizeRequestDto extends createZodDto(
  OauthAuthorizeRequestSchema,
) {}

const OauthCompleteSignupSchema = z.object({
  token: z.string().min(1),
  acceptTerms: z.literal(true),
});

export class OauthCompleteSignupDto extends createZodDto(
  OauthCompleteSignupSchema,
) {}

/** Credenciais de um provider; `clientSecret` vazio mantém o gravado (o GET devolve `****`). */
const SaveOauthConfigSchema = z.object({
  // Issuers OIDC reais são sempre https (RFC 8414 §2) — rejeitar http evita SSRF via discovery.
  issuer: z
    .string()
    .url()
    .refine((v) => new URL(v).protocol === 'https:', {
      message: 'issuer precisa usar https',
    }),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
});

export class SaveOauthConfigDto extends createZodDto(SaveOauthConfigSchema) {
  @ApiProperty({ example: 'https://accounts.google.com' }) issuer: string;
  @ApiProperty() clientId: string;
  @ApiProperty({
    required: false,
    description: 'Vazio mantém a credencial já gravada',
  })
  clientSecret?: string;
}

export class OauthProviderDto {
  @ApiProperty({ example: 'GOOGLE' }) id: string;
  @ApiProperty({ example: 'Google' }) label: string;
  @ApiProperty({
    description:
      'Issuer, client id e client secret preenchidos. Só os `true` aparecem no login',
  })
  configured: boolean;
  @ApiProperty({
    description:
      'Toggle do admin — true por padrão. Desligado esconde o provider do login sem apagar as credenciais',
  })
  enabled: boolean;
}

export class OauthAuthorizeUrlDto {
  @ApiProperty({ description: 'URL de autorização do provider' }) url: string;
}

export class OauthCallbackResponseDto {
  @ApiProperty({ required: false })
  user?: { id: string; email: string; roleId: string | null };
  @ApiProperty({ required: false })
  consentRequired?: boolean;
  @ApiProperty({ required: false })
  signupToken?: string;
  @ApiProperty({ required: false })
  providerId?: string;
  @ApiProperty({ required: false, description: 'Destino relativo pós-login' })
  callbackUrl?: string;
}
