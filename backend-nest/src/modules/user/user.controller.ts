import {
  Controller,
  Query,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpStatus,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CaptchaGuard, RequireCaptcha } from '../captcha/captcha.guard';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { assertOwnershipOrRole } from '../../common/utils/ownership.util';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PAGINATION_PAGE_SOURCE_PARAMS,
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import { UserDto } from './dto/user.dto';
import { plainToInstance } from 'class-transformer';
import {
  UpdatePasswordDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/update-user.dto';
import type { PaginatedResponse } from '../../common/types/pagination.types';

import { FindAllByOneUseCase } from '../user-route-access/use-cases/find-all-by-one.use-case';
import { FindAllRoutesWithUserAccessUseCase } from '../user-route-access/use-cases/find-all-routes-with-user-access.use-case';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { EnumItemDto } from './dto/enum-item.response.dto';
import { CompleteEmailSignupDto, SignUpDto } from './dto/signup.dto';
import { SignupUseCase } from '../auth/use-cases/signup.use-case';
import { FindAllUsersUseCase } from './use-cases/find-all-users.use-case';
import { GetSignupsSeriesUseCase } from './use-cases/get-signups-series.use-case';
import {
  SignupsSeriesDto,
  SignupsSeriesQuerySchema,
  type SignupsSeriesQuery,
} from './dto/signups-series.response.dto';
import { FindOneUserUseCase } from './use-cases/find-one-user.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';
import { UpdateProfileUseCase } from './use-cases/update-profile.use-case';
import { UpdatePasswordUseCase } from './use-cases/update-password.use-case';
import { GetUserImageUseCase } from './use-cases/get-user-image.use-case';
import { ExportMyDataUseCase } from './use-cases/export-my-data.use-case';
import { DeleteMyAccountUseCase } from './use-cases/delete-my-account.use-case';
import { RemoveUserUseCase } from './use-cases/remove-user.use-case';
import { GetSystemRolesUseCase } from './use-cases/get-system-roles.use-case';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  VerificationGuard,
  RequireVerification,
} from '../verification/verification.guard';
import { PhoneAvailabilityGuard } from './phone-availability.guard';
import { UserVerificationPurpose } from 'src/domain/user/user-verification-purpose.const';
import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';
// UserRole enum moved to Role table (3.2); role field kept as string

@ApiTags('user')
@Controller('user')
@RouteAccess(RoutePathConst.USER)
export class UserController {
  constructor(
    private readonly signupUseCase: SignupUseCase,
    private readonly i18n: I18nService,
    private readonly findAllRoutesByUser: FindAllByOneUseCase,
    private readonly findAllRoutesWithUserAccess: FindAllRoutesWithUserAccessUseCase,
    private readonly findAllUsersUseCase: FindAllUsersUseCase,
    private readonly getSignupsSeriesUseCase: GetSignupsSeriesUseCase,
    private readonly findOneUserUseCase: FindOneUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly updatePasswordUseCase: UpdatePasswordUseCase,
    private readonly getUserImageUseCase: GetUserImageUseCase,
    private readonly exportMyDataUseCase: ExportMyDataUseCase,
    private readonly deleteMyAccountUseCase: DeleteMyAccountUseCase,
    private readonly removeUserUseCase: RemoveUserUseCase,
    private readonly getSystemRolesUseCase: GetSystemRolesUseCase,
  ) {}

  // Rota de signup: throttle de 5/min por IP e captcha exigido.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    path: 'signup',
    summary: 'Register a new user',
    description: 'Creates a new user in the system',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'User registered successfully',
          schema: { dto: UserDto },
        },
      ],
    },
    authenticated: false,
    status: 'CREATED',
  })
  async signup(@Body() dto: SignUpDto) {
    return this.signupUseCase.execute(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    path: 'signup/confirm',
    summary: 'Complete email-verified user signup',
    description:
      'Consumes a one-time email confirmation and creates a USER account.',
    response: {
      success: [
        { status: 'CREATED', description: 'User registered successfully' },
      ],
    },
    authenticated: false,
    status: 'CREATED',
  })
  async completeEmailSignup(@Body() dto: CompleteEmailSignupDto) {
    return this.signupUseCase.completeEmailSignup(dto);
  }

  @GetApi({
    summary: 'Lista usuários',
    description: 'Retorna uma lista paginada de usuários do sistema',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    roles: ['ADMIN'],
    scope: 'users:read',
    pageSource: {
      key: 'users.list',
      kind: 'list',
      description: 'Usuários do sistema.',
      fields: ['name', 'email', 'role', 'status', 'createdAt'],
      params: PAGINATION_PAGE_SOURCE_PARAMS,
    },
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: UserDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<UserDto> | UserDto[]> {
    const result = await this.findAllUsersUseCase.execute(query);

    if (Array.isArray(result)) {
      return plainToInstance(UserDto, result);
    }

    return {
      data: plainToInstance(UserDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: 'stats/signups',
    summary: 'Série de cadastros por dia',
    description:
      'Quantidade de usuários criados por dia nos últimos N dias (shape `series` do PageBuilder)',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    scope: 'users:read',
    queries: [
      {
        name: 'days',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      },
    ],
    pageSource: {
      key: 'users.signups.series',
      kind: 'series',
      description: 'Cadastros de usuários por dia nos últimos N dias.',
      params: [
        {
          name: 'days',
          type: 'number',
          description:
            'Tamanho da janela em dias, inteiro de 1 a 365 (padrão 30).',
        },
      ],
    },
    response: {
      success: [
        {
          status: 'OK',
          description: 'Série temporal',
          schema: { dto: SignupsSeriesDto },
        },
      ],
    },
  })
  async signupsSeries(
    @Query(new ZodValidationPipe(SignupsSeriesQuerySchema))
    query: SignupsSeriesQuery,
  ): Promise<SignupsSeriesDto> {
    return this.getSignupsSeriesUseCase.execute(query.days);
  }

  @GetApi({
    path: 'roles',
    summary: 'Lista de papéis disponíveis',
    description: 'Retorna todos os (roles) de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista de roles',
          schema: { dto: EnumItemDto, isArray: true },
        },
      ],
    },
  })
  getRoles() {
    return this.getSystemRolesUseCase.execute();
  }

  @GetApi({
    path: 'status',
    summary: 'Lista de status disponíveis',
    description: 'Retorna todos os status de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista de status',
          schema: { dto: EnumItemDto, isArray: true },
        },
      ],
    },
  })
  getStatus() {
    const i18n = I18nContext.current();
    return Object.values(UserStatusConst).map((status) => ({
      value: status,
      label: i18n?.t(`user.statuses.${status}`) ?? status,
    }));
  }

  @GetApi({
    path: 'profile',
    summary: 'Perfil do usuário',
    description: 'Retorna os dados completos do usuário autenticado',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Perfil do usuário',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return await this.findOneUserUseCase.execute(user.id);
  }

  @GetApi({
    path: '/:id',
    summary: 'Perfil do usuário',
    description: 'Retorna os dados completos do usuário especificado pelo ID',
    authenticated: true,
    scope: 'users:read',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Dados do usuário',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    assertOwnershipOrRole(user.id, id, user.roleName);
    return await this.findOneUserUseCase.execute(id);
  }

  @PatchApi({
    path: ':id',
    summary: 'Atualiza um usuário pelo Admin',
    description: 'Atualiza os dados de um usuário existente no sistema',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Usuário atualizado com sucesso',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.updateUserUseCase.execute(id, updateUserDto);
    return plainToInstance(UserDto, user);
  }

  // PhoneAvailabilityGuard roda antes: rejeita telefone já usado por outro usuário sem gastar o
  // ciclo de verificação (envio de código + confirmação) num valor já fadado a falhar.
  @UseGuards(PhoneAvailabilityGuard, VerificationGuard)
  @RequireVerification({
    purpose: UserVerificationPurpose.PHONE_CONFIRMATION,
    channel: 'WHATSAPP',
    targetField: 'phone',
    method: 'ONCE',
  })
  @PatchApi({
    path: ':id/profile',
    summary: 'Atualiza um usuário',
    description: 'Atualiza os dados de um usuário existente no sistema',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Usuário atualizado com sucesso',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<UserDto> {
    assertOwnershipOrRole(currentUser.id, id, currentUser.roleName);
    if (image) {
      updateProfileDto.image = image.buffer;
      (
        updateProfileDto as UpdateProfileDto & { contentType: string }
      ).contentType = image.mimetype;
    }
    const user = await this.updateProfileUseCase.execute(id, updateProfileDto);
    return plainToInstance(UserDto, user);
  }

  @PatchApi({
    path: ':id/password',
    summary: 'Atualiza a senha do usuário',
    description: 'Atualiza a senha do usuário existente no sistema',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Senha do usuário atualizada com sucesso',
          schema: { dto: UserDto },
        },
      ],
    },
  })
  async updatePassword(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    // Password is self-only — even ADMINs cannot change another user's password via this endpoint
    if (currentUser.id !== id)
      throw new ForbiddenException('common.errors.self_only');
    const pwd = updatePasswordDto;
    await this.updatePasswordUseCase.execute(
      id,
      pwd.currentPassword,
      pwd.newPassword,
      pwd.confirmNewPassword,
    );
  }

  @GetApi({
    path: ':id/routes',
    summary: 'Lista rotas do usuário',
    description: 'Retorna todas as rotas que um usuário específico tem acesso',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async getUserRoutes(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    assertOwnershipOrRole(currentUser.id, id, currentUser.roleName);
    return await this.findAllRoutesByUser.execute(id, query);
  }

  @GetApi({
    path: ':id/routes-management',
    summary: 'Gerenciamento de rotas do usuário',
    description: `Retorna todas as rotas do sistema marcando quais o usuário tem acesso`,
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    roles: ['ADMIN'],
  })
  async getUserRoutesManagement(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ) {
    return await this.findAllRoutesWithUserAccess.execute(id, query);
  }

  @GetApi({
    path: ':id/image',
    summary: 'Obter imagem do usuário',
    description: `Retorna a imagem do usuário em formato binário`,
    status: 'OK',
    authenticated: true,
  })
  async getUserImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StreamableFile | null> {
    assertOwnershipOrRole(currentUser.id, id, currentUser.roleName);
    const imageBuffer = await this.getUserImageUseCase.execute(id);

    if (!imageBuffer) {
      res.status(HttpStatus.NOT_FOUND);
      return null;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length.toString());

    return new StreamableFile(imageBuffer);
  }

  @GetApi({
    path: 'me/export',
    summary: 'Export user data (LGPD)',
    description: 'Returns all data stored for the authenticated user as JSON',
    authenticated: true,
  })
  async exportMyData(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.exportMyDataUseCase.execute(user.id);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="meus-dados.json"',
    );
    res.json(data);
  }

  @DeleteApi({
    path: 'me',
    status: 'NO_CONTENT',
    summary: 'Delete own account (LGPD)',
    description: 'Anonymises and soft-deletes the authenticated user account',
    authenticated: true,
  })
  async deleteMyAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeleteAccountDto,
  ) {
    await this.deleteMyAccountUseCase.execute(user.id, body.password);
  }

  @DeleteApi({
    path: ':id',
    status: 'NO_CONTENT',
    summary: 'Remove um usuário (admin)',
    description: 'Soft-delete de um usuário pelo administrador',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async removeUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (id === user.id) {
      throw new ForbiddenException(this.i18n.t('user.cannot_delete_self'));
    }
    await this.removeUserUseCase.execute(id);
  }
}
