import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Aceita autenticação via JWT (Bearer/cookie) ou via API key (x-api-key). */
@Injectable()
export class JwtOrApiKeyAuthGuard extends AuthGuard(['jwt', 'api-key']) {}
