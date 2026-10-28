import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserConfigurationService } from './user-configuration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { CryptoService } from '../../common/infrastructure/crypto/crypto.service';
import type { SetUserConfigurationUseCase } from './use-cases/set-user-configuration.use-case';

const mockConvertValueByType = vi.hoisted(() => vi.fn());
vi.mock('../../common/utils/conversor.util', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../common/utils/conversor.util')>();
  mockConvertValueByType.mockImplementation(real.convertValueByType);
  return { ...real, convertValueByType: mockConvertValueByType };
});

/** Testa os três métodos do service com chamador interno (IA / BYOK); o CRUD é testado nos use-cases. */

const mockPrisma = {
  userConfigurationDefinition: { findFirst: vi.fn() },
  userConfiguration: { findFirst: vi.fn() },
};
const mockCrypto = { tryDecrypt: vi.fn((v: string) => v.replace('enc:', '')) };
const mockSetUseCase = { execute: vi.fn().mockResolvedValue({}) };

const defRow = {
  id: 'def-1',
  labelKey: 'THEME',
  valueType: 'string',
  defaultValue: 'dark',
  secret: false,
};
const secretDef = { ...defRow, id: 'def-3', labelKey: 'API_KEY', defaultValue: null, secret: true };

function makeService() {
  return new UserConfigurationService(
    mockPrisma as unknown as PrismaService,
    { t: (k: string) => k } as unknown as I18nService,
    mockCrypto as unknown as CryptoService,
    mockSetUseCase as unknown as SetUserConfigurationUseCase,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('UserConfigurationService.getDecryptedValueForUser', () => {
  it('devolve null quando a definição não existe', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(null);
    await expect(makeService().getDecryptedValueForUser('u1', 'MISSING')).resolves.toBeNull();
  });

  // Contrato importante: NÃO herda o defaultValue da definição. O default é um
  // valor global e nunca deve virar credencial de um usuário.
  it('devolve null quando o usuário não personalizou — sem cair no defaultValue', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue(null);
    await expect(makeService().getDecryptedValueForUser('u1', 'THEME')).resolves.toBeNull();
  });

  it('descriptografa quando a definição é secret', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({ value: 'enc:my-api-key' });
    await expect(makeService().getDecryptedValueForUser('u1', 'API_KEY')).resolves.toBe(
      'my-api-key',
    );
    expect(mockCrypto.tryDecrypt).toHaveBeenCalledWith('enc:my-api-key');
  });

  it('não descriptografa quando a definição não é secret', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({ value: 'light' });
    await expect(makeService().getDecryptedValueForUser('u1', 'THEME')).resolves.toBe('light');
    expect(mockCrypto.tryDecrypt).not.toHaveBeenCalled();
  });

  it('cai no valor cru quando a conversão por tipo não devolve nada', async () => {
    mockConvertValueByType.mockReturnValueOnce(undefined);
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({ value: 'light' });
    await expect(makeService().getDecryptedValueForUser('u1', 'THEME')).resolves.toBe('light');
  });
});

describe('UserConfigurationService.keepStoredWhenBlank', () => {
  it('usa o valor enviado quando não está em branco', async () => {
    await expect(makeService().keepStoredWhenBlank('u1', 'novo', 'API_KEY')).resolves.toBe('novo');
    expect(mockPrisma.userConfigurationDefinition.findFirst).not.toHaveBeenCalled();
  });

  it('mantém o que está gravado quando o campo vem vazio', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({ value: 'enc:guardada' });
    await expect(makeService().keepStoredWhenBlank('u1', '   ', 'API_KEY')).resolves.toBe(
      'guardada',
    );
  });

  it('devolve string vazia quando não há nada gravado', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue(null);
    await expect(makeService().keepStoredWhenBlank('u1', undefined, 'API_KEY')).resolves.toBe('');
  });
});

describe('UserConfigurationService.setManyByLabelKey', () => {
  it('resolve cada labelKey e delega ao use-case', async () => {
    mockPrisma.userConfigurationDefinition.findFirst
      .mockResolvedValueOnce(defRow)
      .mockResolvedValueOnce(secretDef);

    await makeService().setManyByLabelKey(
      'u1',
      [
        { labelKey: 'THEME', value: 'light' },
        { labelKey: 'API_KEY', value: 'sk-1' },
      ],
      'admin',
    );

    expect(mockSetUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mockSetUseCase.execute).toHaveBeenCalledWith(
      'u1',
      { definitionId: 'def-1', value: 'light' },
      'admin',
    );
  });

  it('lança NotFoundException quando um labelKey não existe', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(null);
    await expect(
      makeService().setManyByLabelKey('u1', [{ labelKey: 'NOPE', value: 'x' }]),
    ).rejects.toThrow(NotFoundException);
  });
});
