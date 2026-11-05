import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../user/dto/user.dto';

/** Espelha o que `GetUserRoutesUseCase` devolve — o menu inteiro, não só o identificador. */
export class RouteItemDto {
  @ApiProperty() id: string;
  @ApiProperty() path: string;
  @ApiProperty() labelKey: string;
  // `type` explícito é obrigatório em campo `string | null`: sem ele o schema vira `type: object`.
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty({ type: String, nullable: true }) parentId: string | null;
  @ApiProperty() ordem: number;
  @ApiProperty() isHome: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() showSideBar: boolean;
}

export class TokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
}

/** O que o `login` monta à mão — `role` é o nome do papel, e o menu vem junto. */
export class LoginUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'Nome do papel, ex.: ADMIN' }) role: string;
  @ApiProperty({ type: () => RouteItemDto, isArray: true })
  routes: RouteItemDto[];
}

export class LoginResponseDto {
  @ApiProperty({ type: () => LoginUserDto }) user: LoginUserDto;
  @ApiProperty() message: string;
  // Tokens viajam em cookie HttpOnly; o campo existe só para clientes não-browser.
  @ApiProperty({ type: TokensDto, required: false }) tokens?: TokensDto;
}

export class MessageResponseDto {
  @ApiProperty() message: string;
}

export class ValidTokenResponseDto {
  @ApiProperty() valid: boolean;
}

export class ValidateInviteResponseDto {
  @ApiProperty() valid: boolean;
  @ApiProperty() token: string;
  @ApiProperty({ required: false }) email?: string;
  @ApiProperty({
    description:
      'Convidado já tem conta: a tela deve oferecer aceitar o convite, não cadastrar',
  })
  userExists: boolean;
  @ApiProperty({
    required: false,
    description: 'Nome opcional informado ao gerar o convite',
  })
  name?: string;
  @ApiProperty({
    required: false,
    description: 'Nome da empresa quando o convite é para membership',
  })
  companyName?: string;
}

export class InviteTokenResponseDto {
  @ApiProperty() token: string;
}

export class RegisterResponseDto {
  @ApiProperty({ type: () => UserDto }) user: UserDto;
}

/** `GET /auth/me` é a rota leve de sessão: devolve o `AuthenticatedUser` do JWT mais o menu, sem ir ao banco. */
export class MeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: String, nullable: true }) roleId: string | null;
  @ApiProperty({ description: 'Nome do papel, ex.: ADMIN' }) roleName: string;

  @ApiProperty({ type: () => RouteItemDto, isArray: true })
  routes: RouteItemDto[];
}

/** `GET /auth/user` — o perfil completo do banco mais o menu. */
export class UserProfileResponseDto extends UserDto {
  @ApiProperty({ type: () => RouteItemDto, isArray: true })
  routes: RouteItemDto[];
}

export class ForgotPasswordStatusResponseDto {
  @ApiProperty({
    description: 'Indica se a recuperação de senha está disponível',
  })
  available: boolean;
}
