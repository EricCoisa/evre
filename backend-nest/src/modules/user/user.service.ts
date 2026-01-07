import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import type { UserDto } from './dto/user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-user.dto';
import { UserRole, UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatus, UserStatusConst } from 'src/domain/auth/userStatus.const';
import * as bcrypt from 'bcrypt';
import { User } from 'src/domain/user/user.entity';
import { IBaseService } from 'src/domain/interface/base-service.interface';

@Injectable()
export class UserService implements Omit<
  IBaseService<User>,
  'create' | 'remove'
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<User> | User[]> {
    const { page, limit, pagination, search, filter } = query;

    // Constrói a cláusula where separando search e filter
    const where: {
      OR?: Array<{
        email?: { contains: string };
        name?: { contains: string };
      }>;
      role?: UserRole;
      status?: UserStatus;
    } = {};

    // Aplica filtro de busca global (search)
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    // Aplica filtros específicos (filter)
    if (filter?.role) {
      where.role = filter.role as UserRole;
    }

    if (filter?.status) {
      where.status = filter.status as UserStatus;
    }

    const select = {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };

    if (!pagination) {
      // Retorna todos os usuários sem paginação
      return await this.prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Com paginação
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const roleSet = Object.values(UserRoleConst);
    const statusSet = Object.values(UserStatusConst);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        role: Array.from(roleSet),
        status: Array.from(statusSet),
      },
    };
  }

  //TODO: OK
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // password: false (não incluir senha)
      },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    return user;
  }

  //TODO: OK
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Verifica se o usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    // Se o email está sendo alterado, verifica se já existe
    // if (updateUserDto.email && updateUserDto.email !== user.email) {
    //   const existingUser = await this.prisma.user.findUnique({
    //     where: { email: updateUserDto.email },
    //   });

    //   if (existingUser) {
    //     throw new ConflictException(this.i18n.t('user.email_already_exists'));
    //   }
    // }

    // Prepara os dados para atualização
    const updateData: {
      email?: string;
      name?: string | null;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    } = {};

    // if (updateUserDto.email) updateData.email = updateUserDto.email;
    // if (updateUserDto.name !== undefined) updateData.name = updateUserDto.name;
    if (updateUserDto.role) updateData.role = updateUserDto.role as UserRole;
    if (updateUserDto.status)
      updateData.status = updateUserDto.status as UserStatus;
    // Se a senha for fornecida, hash ela
    // if (updateUserDto.password) {
    //   updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    // }

    // Se o status está sendo alterado para INACTIVE ou SUSPENDED, revoga todos os tokens
    if (
      updateUserDto.status &&
      updateUserDto.status !== user.status &&
      (updateUserDto.status === UserStatusConst.INACTIVE ||
        updateUserDto.status === UserStatusConst.SUSPENDED)
    ) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
    }

    // Atualiza o usuário
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async updateProfile(id: string, data: UpdateProfileDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }
    // Se o email está sendo alterado, verifica se já existe
    // if (data.email && data.email !== user.email) {
    //   const existingUser = await this.prisma.user.findUnique({
    //     where: { email: data.email },
    //   });
    //   if (existingUser) {
    //     throw new ConflictException(this.i18n.t('user.email_already_exists'));
    //   }
    // }
    // Atualiza apenas nome e imagem

    // Validações da imagem
    if (data.image != null) {
      if (!(data.image instanceof Buffer || data.image instanceof Uint8Array)) {
        throw new BadRequestException(this.i18n.t('user.image_invalid'));
      }
      if (data.image.length === 0) {
        throw new BadRequestException(this.i18n.t('user.image_invalid'));
      }
      // Verifica se a imagem é menor que 40MB
      const maxSize = 40 * 1024 * 1024; // 40MB em bytes
      if (data.image.length > maxSize) {
        throw new BadRequestException(this.i18n.t('user.image_too_large'));
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        // email: data.email ?? user.email,
        name: data.name ?? user.name,
        image:
          data.image !== undefined
            ? data.image
              ? new Uint8Array(data.image)
              : null
            : user.image,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return updatedUser;
  }

  async updatePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }
    // Verifica se a senha atual está correta
    const passwordOk = await bcrypt.compare(currentPassword, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException(
        this.i18n.t('user.current_password_invalid'),
      );
    }
    // Verifica se a nova senha é igual à atual
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new BadRequestException(
        this.i18n.t('user.new_password_same_as_current'),
      );
    }
    // Verifica se a confirmação bate
    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException(
        this.i18n.t('user.new_passwords_do_not_match'),
      );
    }
    // Atualiza a senha
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
  }

  async getUserImageById(id: string): Promise<Buffer | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { image: true },
    });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }
    if (!user.image) return null;
    // Converte Uint8Array para Buffer se necessário
    return Buffer.isBuffer(user.image) ? user.image : Buffer.from(user.image);
  }
}
