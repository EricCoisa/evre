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
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { ZodValidationPipe } from 'nestjs-zod';
import {
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

import { UserRouteAccessService } from '../user-route-access/user-route-access.service';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { SignUpDto } from './dto/signup.dto';
import { AuthService } from '../auth/auth.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import { InviteTokenPayload } from 'src/domain/auth/tokenInvite.type';
import { UserRole } from '@prisma/client';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
    private readonly userRouteAccessService: UserRouteAccessService,
    private readonly systemConfigurationService: SystemConfigurationService,
  ) {}

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
    const config =
      await this.systemConfigurationService.findByLabelKey(
        'SYSTEM_USER_CREATE',
      );

    if (config?.value == false && dto.inviteToken == null) {
      throw new Error(this.i18n.t('auth.signup.disabled'));
    }

    let invitePayload: InviteTokenPayload | null = null;
    if (dto.inviteToken) {
      invitePayload = await this.authService.validateInviteToken(
        dto.inviteToken,
      );
      if (!invitePayload) {
        throw new Error(this.i18n.t('auth.invite.invalid_token'));
      }
    }

    const user = await this.authService.register({
      email: invitePayload?.email ?? dto.email,
      password: dto.password,
      name: dto.name,
      role: (invitePayload?.role as UserRole) ?? (UserRoleConst.USER as 'USER'),
    });
    return { user };
  }

  @GetApi({
    summary: 'Lista usuários',
    description: 'Retorna uma lista paginada de usuários do sistema',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    roles: ['ADMIN'],
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
    const result = await this.userService.findAll(query);

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
    path: 'roles',
    summary: 'Lista de papéis disponíveis',
    description: 'Retorna todos os (roles) de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
  })
  getRoles() {
    return Object.values(UserRoleConst).map((role) => ({
      value: role,
      label: role,
    }));
  }

  @GetApi({
    path: 'status',
    summary: 'Lista de status disponíveis',
    description: 'Retorna todos os status de usuário disponíveis no sistema',
    status: 'OK',
    authenticated: true,
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
  })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    // Busca dados completos do usuário no banco de dados
    return await this.userService.findOne(user.id);
  }

  @GetApi({
    path: '/:id',
    summary: 'Perfil do usuário',
    description: 'Retorna os dados completos do usuário especificado pelo ID',
    authenticated: true,
  })
  async getById(@Param('id') id: string) {
    // Busca dados completos do usuário no banco de dados
    return await this.userService.findOne(id);
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
    const user = await this.userService.update(id, updateUserDto);
    return plainToInstance(UserDto, user);
  }

  @PatchApi({
    path: 'profile/:id',
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
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<UserDto> {
    // Se há arquivo de imagem, converte para Buffer e adiciona ao DTO
    if (image) {
      updateProfileDto.image = image.buffer;
    }
    const user = await this.userService.updateProfile(id, updateProfileDto);
    return plainToInstance(UserDto, user);
  }

  @PatchApi({
    path: 'password/:id',
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
  ): Promise<void> {
    await this.userService.updatePassword(
      id,
      updatePasswordDto.currentPassword,
      updatePasswordDto.newPassword,
      updatePasswordDto.confirmNewPassword,
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
  ) {
    return await this.userRouteAccessService.findAllByOne(id, query);
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
    return await this.userRouteAccessService.findAllRoutesWithUserAccess(
      id,
      query,
    );
  }

  @GetApi({
    path: ':id/get-user-image',
    summary: 'Obter imagem do usuário',
    description: `Retorna a imagem do usuário em formato binário`,
    status: 'OK',
    authenticated: true,
  })
  async getUserImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | null> {
    const imageBuffer = await this.userService.getUserImageById(id);

    if (!imageBuffer) {
      res.status(HttpStatus.NOT_FOUND);
      return null;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length.toString());

    return new StreamableFile(imageBuffer);
  }
}
