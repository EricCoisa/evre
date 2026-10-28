import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  RefreshTokenUseCase,
  REFRESH_REUSE_GRACE_MS,
} from './refresh-token.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { hashSource } from 'src/common/utils/request-source.util';

const mockPrisma = {
  refreshToken: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
};

// issueRefreshToken lê o `exp` do token que acabou de assinar, então o mock precisa
// devolver algo com forma de JWT.
const jwtWithExp = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ sub: 'u1', exp })).toString('base64url')}.s`;
const NEW_TOKEN = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);

const mockJwt = { signAsync: vi.fn().mockResolvedValue(NEW_TOKEN) };
const mockConfig = { get: vi.fn().mockReturnValue('secret') };
const mockI18n = { t: vi.fn((k: string) => k) };

const activeUser = {
  id: 'u1',
  email: 'a@b.com',
  role: 'USER',
  status: 'ACTIVE',
};
const futureExpiry = new Date(Date.now() + 60_000);

const SOURCE = { ip: '203.0.113.5', userAgent: 'vitest-agent' };
const OTHER_SOURCE = { ip: '198.51.100.9', userAgent: 'attacker-agent' };

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(RefreshTokenUseCase);
    vi.clearAllMocks();
    mockJwt.signAsync.mockResolvedValue(NEW_TOKEN);
    mockPrisma.refreshToken.delete.mockResolvedValue({});
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('validateRefreshToken', () => {
    it('retorna usuário para token válido', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        expiresAt: futureExpiry,
        user: activeUser,
      });

      const result = await useCase.validateRefreshToken('valid-token');
      expect(result).toBe(activeUser);
    });

    it('lança UnauthorizedException quando token não existe', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(useCase.validateRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException e deleta token expirado', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        expiresAt: pastExpiry,
        user: activeUser,
      });

      await expect(
        useCase.validateRefreshToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt1' },
      });
    });

    it('lança UnauthorizedException e revoga a família de usuário inativo', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        familyId: 'fam1',
        expiresAt: futureExpiry,
        user: { ...activeUser, status: 'INACTIVE' },
      });

      await expect(useCase.validateRefreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1' },
      });
    });
  });

  describe('rotate — rotação com detecção de reuso', () => {
    const CURRENT = {
      id: 'rt1',
      token: 'old-rt',
      familyId: 'fam1',
      expiresAt: futureExpiry,
      replacedAt: null as Date | null,
      replacedById: null as string | null,
      sourceIpHash: hashSource(SOURCE.ip),
      sourceUaHash: hashSource(SOURCE.userAgent),
      user: { ...activeUser, roleId: 'r1', roleRecord: { name: 'ADMIN' } },
    };

    it('caminho normal: emite sucessor, marca o antigo e devolve o par novo', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ ...CURRENT });
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'rt2',
        token: NEW_TOKEN,
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await useCase.rotate('old-rt', SOURCE);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt1', replacedAt: null },
          data: expect.objectContaining({ replacedById: 'rt2' }),
        }),
      );
      expect(result.refreshToken).toBe(NEW_TOKEN);
      expect(result.accessToken).toBe(NEW_TOKEN);
      // o sucessor herda a família do token apresentado e grava a origem da requisição
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: 'fam1',
            sourceIpHash: hashSource(SOURCE.ip),
            sourceUaHash: hashSource(SOURCE.userAgent),
          }),
        }),
      );
    });

    it('perder o compare-and-swap devolve o sucessor do vencedor, não um 401', async () => {
      const winnerSuccessor = {
        id: 'rt-winner',
        token: 'winner-token',
        replacedAt: null,
        expiresAt: futureExpiry,
      };
      mockPrisma.refreshToken.findUnique
        .mockResolvedValueOnce({ ...CURRENT })
        // re-leitura dentro de resolveReuse
        .mockResolvedValueOnce({
          ...CURRENT,
          replacedAt: new Date(),
          replacedById: 'rt-winner',
        })
        .mockResolvedValueOnce(winnerSuccessor);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'rt-loser',
        token: NEW_TOKEN,
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await useCase.rotate('old-rt', SOURCE);

      expect(result.refreshToken).toBe('winner-token');
      // o sucessor perdedor é descartado para a família convergir num token só
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-loser' },
      });
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('reuso DENTRO da janela de graça devolve o sucessor já emitido', async () => {
      const successor = {
        id: 'rt2',
        token: 'successor-token',
        replacedAt: null,
        expiresAt: futureExpiry,
      };
      const replaced = {
        ...CURRENT,
        replacedAt: new Date(Date.now() - 1_000),
        replacedById: 'rt2',
      };
      mockPrisma.refreshToken.findUnique
        .mockResolvedValueOnce(replaced)
        .mockResolvedValueOnce(replaced)
        .mockResolvedValueOnce(successor);

      const result = await useCase.rotate('old-rt', SOURCE);

      expect(result.refreshToken).toBe('successor-token');
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('reuso FORA da janela de graça revoga a família inteira', async () => {
      const replaced = {
        ...CURRENT,
        replacedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 5_000),
        replacedById: 'rt2',
      };
      mockPrisma.refreshToken.findUnique
        .mockResolvedValueOnce(replaced)
        .mockResolvedValueOnce(replaced);

      await expect(useCase.rotate('old-rt', SOURCE)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1' },
      });
    });

    it('reuso DENTRO da janela de graça mas de origem diferente revoga a família (token roubado)', async () => {
      const replaced = {
        ...CURRENT,
        replacedAt: new Date(Date.now() - 1_000),
        replacedById: 'rt2',
      };
      // Só 2 chamadas: `current` em rotate() e `row` em resolveReuse() — a
      // origem diferente impede o fetch do sucessor, então não há 3ª leitura.
      mockPrisma.refreshToken.findUnique
        .mockResolvedValueOnce(replaced)
        .mockResolvedValueOnce(replaced);

      await expect(useCase.rotate('old-rt', OTHER_SOURCE)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1' },
      });
    });

    it('token desconhecido é rejeitado sem revogar nada', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(useCase.rotate('nope', SOURCE)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('token expirado é apagado e rejeitado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...CURRENT,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(useCase.rotate('old-rt', SOURCE)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt1' },
      });
    });
  });

  describe('execute', () => {
    it('gera novo accessToken para usuário existente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      const result = await useCase.execute('u1');
      expect(result).toEqual({ accessToken: NEW_TOKEN });
    });

    it('lança UnauthorizedException quando usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(useCase.execute('ghost')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
