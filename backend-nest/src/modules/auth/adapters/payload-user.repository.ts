/** Acessa a tabela payload.users, gerenciada pelo Payload CMS, via raw SQL. */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface PayloadUserRow {
  id: number;
  updatedAt: Date;
  createdAt: Date;
  email: string;
  resetPasswordToken: string | null;
  resetPasswordExpiration: Date | null;
  salt: string | null;
  hash: string | null;
  loginAttempts: number | null;
  lockUntil: Date | null;
}

export interface CreatePayloadUserData {
  email: string;
  salt?: string | null;
  hash?: string | null;
  loginAttempts?: number | null;
  lockUntil?: Date | null;
}

const SELECT_FIELDS = Prisma.sql`
  id,
  updated_at AS "updatedAt",
  created_at AS "createdAt",
  email,
  reset_password_token AS "resetPasswordToken",
  reset_password_expiration AS "resetPasswordExpiration",
  salt,
  hash,
  login_attempts AS "loginAttempts",
  lock_until AS "lockUntil"
`;

@Injectable()
export class PayloadUserRepository {
  private readonly logger = new Logger(PayloadUserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Verifica se a tabela payload.users existe no banco de dados. */
  async tableExists(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'payload' AND table_name = 'users'
        ) as "exists"`;
      return result[0]?.exists ?? false;
    } catch {
      return false;
    }
  }

  async findByEmail(email: string): Promise<PayloadUserRow | null> {
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      SELECT ${SELECT_FIELDS}
      FROM payload.users
      WHERE email = ${email}
      LIMIT 1`;
    return results[0] ?? null;
  }

  async findById(id: number): Promise<PayloadUserRow | null> {
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      SELECT ${SELECT_FIELDS}
      FROM payload.users
      WHERE id = ${id}
      LIMIT 1`;
    return results[0] ?? null;
  }

  async findMany(options?: {
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<PayloadUserRow[]> {
    const skip = options?.skip ?? 0;
    const take = options?.take ?? 100;
    const search = options?.search;

    if (search) {
      const pattern = `%${search}%`;
      return this.prisma.$queryRaw<PayloadUserRow[]>`
        SELECT ${SELECT_FIELDS}
        FROM payload.users
        WHERE email ILIKE ${pattern}
        ORDER BY created_at DESC
        LIMIT ${take} OFFSET ${skip}`;
    }

    return this.prisma.$queryRaw<PayloadUserRow[]>`
      SELECT ${SELECT_FIELDS}
      FROM payload.users
      ORDER BY created_at DESC
      LIMIT ${take} OFFSET ${skip}`;
  }

  async count(search?: string): Promise<number> {
    if (search) {
      const pattern = `%${search}%`;
      const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM payload.users
        WHERE email ILIKE ${pattern}`;
      return Number(result[0]?.count ?? 0);
    }

    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count FROM payload.users`;
    return Number(result[0]?.count ?? 0);
  }

  async create(data: CreatePayloadUserData): Promise<PayloadUserRow> {
    const now = new Date();
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      INSERT INTO payload.users
        (email, salt, hash, login_attempts, lock_until, created_at, updated_at)
      VALUES (
        ${data.email},
        ${data.salt ?? null},
        ${data.hash ?? null},
        ${data.loginAttempts ?? 0},
        ${data.lockUntil ?? null},
        ${now}, ${now}
      )
      RETURNING ${SELECT_FIELDS}`;
    return results[0];
  }

  /** Atualiza um PayloadUser pelo ID usando fragmentos SQL dinâmicos. */
  async updateById(
    id: number,
    data: Partial<Omit<PayloadUserRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<PayloadUserRow> {
    const sets = this.buildSetFragments(data);
    if (sets.length === 0) {
      return (await this.findById(id))!;
    }
    const setClause = Prisma.join(sets, ', ');
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      UPDATE payload.users
      SET ${setClause}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING ${SELECT_FIELDS}`;
    return results[0];
  }

  /** Atualiza um PayloadUser pelo email usando fragmentos SQL dinâmicos. */
  async updateByEmail(
    email: string,
    data: Partial<
      Omit<PayloadUserRow, 'id' | 'email' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<PayloadUserRow> {
    const sets = this.buildSetFragments(data);
    if (sets.length === 0) {
      return (await this.findByEmail(email))!;
    }
    const setClause = Prisma.join(sets, ', ');
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      UPDATE payload.users
      SET ${setClause}, updated_at = NOW()
      WHERE email = ${email}
      RETURNING ${SELECT_FIELDS}`;
    return results[0];
  }

  async delete(id: number): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM payload.users WHERE id = ${id}`;
  }

  async upsertByEmail(data: CreatePayloadUserData): Promise<PayloadUserRow> {
    const now = new Date();
    const results = await this.prisma.$queryRaw<PayloadUserRow[]>`
      INSERT INTO payload.users
        (email, salt, hash, login_attempts, lock_until, created_at, updated_at)
      VALUES (
        ${data.email},
        ${data.salt ?? null},
        ${data.hash ?? null},
        ${data.loginAttempts ?? 0},
        ${data.lockUntil ?? null},
        ${now}, ${now}
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING ${SELECT_FIELDS}`;

    // ON CONFLICT DO NOTHING não retorna a row existente
    if (results.length === 0) {
      return (await this.findByEmail(data.email))!;
    }
    return results[0];
  }

  /** Constrói fragmentos SQL para o SET clause a partir de um objeto de dados parcial. */
  private buildSetFragments(data: Record<string, unknown>): Prisma.Sql[] {
    const columnMap: Record<string, string> = {
      email: 'email',
      salt: 'salt',
      hash: 'hash',
      loginAttempts: 'login_attempts',
      lockUntil: 'lock_until',
      resetPasswordToken: 'reset_password_token',
      resetPasswordExpiration: 'reset_password_expiration',
    };

    const fragments: Prisma.Sql[] = [];
    for (const [key, value] of Object.entries(data)) {
      const column = columnMap[key];
      if (!column) continue;
      // Usa Prisma.sql para garantir parametrização segura
      fragments.push(
        Prisma.sql`${Prisma.raw(column)} = ${value === undefined ? null : value}`,
      );
    }
    return fragments;
  }
}
