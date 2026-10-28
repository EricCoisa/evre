import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveUserAiConfigurationUseCase } from './save-user-configuration.use-case';
import { AiService } from '../ai.service';
import { UserConfigurationService } from 'src/modules/user-configuration/user-configuration.service';
import type { SaveAiConfigDto } from '../dto/save-ai-config.dto';

const mockAiService = {
  validateCandidate: vi.fn(),
  invalidateHealthCache: vi.fn(),
};
const mockUserConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};

const openaiDto = {
  provider: 'OPENAI',
  model: 'gpt-4o',
  apiKey: 'sk-do-usuario',
} as SaveAiConfigDto;

const writtenKeys = () =>
  Object.fromEntries(
    (
      mockUserConfig.setManyByLabelKey.mock.calls[0][1] as Array<{
        labelKey: string;
        value: string;
      }>
    ).map((e) => [e.labelKey, e.value]),
  );

describe('SaveUserAiConfigurationUseCase', () => {
  let useCase: SaveUserAiConfigurationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveUserAiConfigurationUseCase,
        { provide: AiService, useValue: mockAiService },
        { provide: UserConfigurationService, useValue: mockUserConfig },
      ],
    }).compile();
    useCase = mod.get(SaveUserAiConfigurationUseCase);
    vi.clearAllMocks();
    mockUserConfig.keepStoredWhenBlank.mockImplementation(
      (_userId: string, value: string) => Promise.resolve(value ?? ''),
    );
    mockAiService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });
  });

  it('grava só as chaves do provider escolhido e não troca o provider ativo', async () => {
    await useCase.execute('user-1', openaiDto);

    const byKey = writtenKeys();
    expect(byKey).toMatchObject({
      USERCONFIG_AGENT_OPENAI_MODEL: 'gpt-4o',
      USERCONFIG_AGENT_OPENAI_API_KEY: 'sk-do-usuario',
    });
    // É isso que permite o usuário guardar credencial de mais de um provider: salvar a
    // da OpenAI não pode apagar a da Anthropic nem trocar qual está ativo.
    expect(byKey).not.toHaveProperty('USERCONFIG_AGENT_ANTHROPIC_API_KEY');
    expect(byKey).not.toHaveProperty('USERCONFIG_AGENT_PROVIDER');
    expect(mockAiService.invalidateHealthCache).toHaveBeenCalled();
  });

  it('chave em branco reaproveita a gravada do mesmo provider', async () => {
    mockUserConfig.keepStoredWhenBlank.mockResolvedValue('sk-ja-guardada');

    await useCase.execute('user-1', { ...openaiDto, apiKey: '' });

    expect(mockUserConfig.keepStoredWhenBlank).toHaveBeenCalledWith(
      'user-1',
      '',
      'USERCONFIG_AGENT_OPENAI_API_KEY',
    );
  });

  it('chave rejeitada pelo provider: 400 e nada é gravado', async () => {
    mockAiService.validateCandidate.mockResolvedValue({
      status: false,
      data: 'invalid api key',
    });

    await expect(useCase.execute('user-1', openaiDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockUserConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('OPENAI_COMPATIBLE roda sem chave e grava a baseUrl do provider', async () => {
    mockUserConfig.keepStoredWhenBlank.mockResolvedValue('');

    await useCase.execute('user-1', {
      provider: 'OPENAI_COMPATIBLE',
      model: 'llama3',
      apiKey: '',
      baseUrl: 'https://api.groq.com/openai/v1',
    } as SaveAiConfigDto);

    expect(writtenKeys().USERCONFIG_AGENT_OPENAI_COMPATIBLE_BASE_URL).toBe(
      'https://api.groq.com/openai/v1',
    );
  });

  it('OPENAI_COMPATIBLE recusa baseUrl http (não-https) antes de chamar o provider', async () => {
    await expect(
      useCase.execute('user-1', {
        provider: 'OPENAI_COMPATIBLE',
        model: 'llama3',
        apiKey: '',
        baseUrl: 'http://api.example.com/v1',
      } as SaveAiConfigDto),
    ).rejects.toThrow(BadRequestException);
    expect(mockAiService.validateCandidate).not.toHaveBeenCalled();
  });

  it.each([
    'https://localhost:11434/v1',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.5/v1',
  ])(
    'OPENAI_COMPATIBLE recusa baseUrl apontando para host privado/interno (%s) — guarda de SSRF',
    async (baseUrl) => {
      await expect(
        useCase.execute('user-1', {
          provider: 'OPENAI_COMPATIBLE',
          model: 'llama3',
          apiKey: '',
          baseUrl,
        } as SaveAiConfigDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockAiService.validateCandidate).not.toHaveBeenCalled();
    },
  );

  it('provider hospedado sem chave (nem nova, nem guardada): 400 antes de chamar o provider', async () => {
    mockUserConfig.keepStoredWhenBlank.mockResolvedValue('');

    await expect(
      useCase.execute('user-1', { ...openaiDto, apiKey: '' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockAiService.validateCandidate).not.toHaveBeenCalled();
  });
});
