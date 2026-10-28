import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UpdatePasswordUseCase } from './update-password.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { NotificationService } from 'src/modules/notification/notification.service';

const mockPrisma = { user: { findFirst: vi.fn(), update: vi.fn() } };
const mockI18n = { t: vi.fn((k: string) => k) };
const mockCrypto = { verifyPassword: vi.fn(), generatePasswordHash: vi.fn() };
const mockNotifications = { notify: vi.fn() };

const user = {
  id: 'u1',
  email: 'a@b.com',
  hash: 'h',
  salt: 's',
  deletedAt: null,
};

describe('UpdatePasswordUseCase', () => {
  let useCase: UpdatePasswordUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UpdatePasswordUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();
    useCase = mod.get(UpdatePasswordUseCase);
    vi.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({});
    mockCrypto.generatePasswordHash.mockResolvedValue({
      hash: 'new-h',
      salt: 'new-s',
    });
  });

  it('atualiza senha com sucesso', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    // 1st call: verify current password = true; 2nd call: isSame check = false
    mockCrypto.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      useCase.execute('u1', 'current', 'NewPass1!', 'NewPass1!'),
    ).resolves.toBeUndefined();
    expect(mockPrisma.user.update).toHaveBeenCalled();
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'USER_PASSWORD_CHANGED',
        recipients: { userIds: ['u1'] },
        // titleKey/messageKey precisam ir junto — sem eles a notificação in-app nunca re-resolve
        // no idioma de quem lê, e um i18n.t() que falhe no envio fica preso no title pra sempre.
        titleKey: 'user.password_changed_title',
        messageKey: 'user.password_changed_message',
      }),
    );
  });

  it('lança NotFoundException se usuário não encontrado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('u1', 'c', 'n', 'n')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança UnauthorizedException se senha atual inválida', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockCrypto.verifyPassword.mockResolvedValueOnce(false);

    await expect(
      useCase.execute('u1', 'wrong', 'NewPass1!', 'NewPass1!'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lança BadRequestException se nova senha igual à atual', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    // current ok, isSame = true
    mockCrypto.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      useCase.execute('u1', 'current', 'SamePass!', 'SamePass!'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lança BadRequestException se confirmação não coincide', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockCrypto.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      useCase.execute('u1', 'current', 'NewPass1!', 'DiffPass!'),
    ).rejects.toThrow(BadRequestException);
  });
});
