import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveAiConfigurationUseCase } from './save-configuration.use-case';
import { AiService } from '../ai.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import type { SaveAiConfigDto } from '../dto/save-ai-config.dto';

const mockAiService = {
  validateCandidate: vi.fn(),
  invalidateHealthCache: vi.fn(),
};
const mockSysConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};

const anthropicDto = {
  provider: 'ANTHROPIC',
  model: 'claude-sonnet-4-6',
  apiKey: 'sk-ant-nova',
} as SaveAiConfigDto;

const entriesOf = (call: number) =>
  mockSysConfig.setManyByLabelKey.mock.calls[call][0] as Array<{
    labelKey: string;
    value: string;
  }>;

describe('SaveAiConfigurationUseCase', () => {
  let useCase: SaveAiConfigurationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveAiConfigurationUseCase,
        { provide: AiService, useValue: mockAiService },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
      ],
    }).compile();
    useCase = mod.get(SaveAiConfigurationUseCase);
    vi.clearAllMocks();
    mockSysConfig.keepStoredWhenBlank.mockImplementation((value: string) =>
      Promise.resolve(value ?? ''),
    );
  });

  it('chave rejeitada pelo provider: 400 e nada é gravado', async () => {
    mockAiService.validateCandidate.mockResolvedValue({
      status: false,
      data: 'invalid x-api-key',
    });

    await expect(useCase.execute(anthropicDto, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('grava nas chaves do provider escolhido e derruba o cache de saúde', async () => {
    mockAiService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    await useCase.execute(anthropicDto, 'admin-1');

    const byKey = Object.fromEntries(
      entriesOf(0).map((e) => [e.labelKey, e.value]),
    );
    expect(byKey).toMatchObject({
      SYSTEM_AI_ANTHROPIC_MODEL: 'claude-sonnet-4-6',
      SYSTEM_AI_ANTHROPIC_API_KEY: 'sk-ant-nova',
    });
    expect(byKey).not.toHaveProperty('SYSTEM_AI_OPENAI_API_KEY');
    // Salvar credencial não troca o provider ativo: é isso que permite ter mais de um
    // provider configurado ao mesmo tempo (quem troca é o checkbox do /settings).
    expect(byKey).not.toHaveProperty('SYSTEM_AI_PROVIDER');
    expect(mockAiService.invalidateHealthCache).toHaveBeenCalled();
  });

  it('provider hospedado sem chave (nem nova, nem guardada): 400 antes de chamar o provider', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('');

    await expect(
      useCase.execute({ ...anthropicDto, apiKey: '' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(mockAiService.validateCandidate).not.toHaveBeenCalled();
  });

  it('OPENAI_COMPATIBLE roda sem chave (Ollama/LM Studio) e grava a baseUrl', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('');
    mockAiService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    await useCase.execute(
      {
        provider: 'OPENAI_COMPATIBLE',
        model: 'llama3',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      } as SaveAiConfigDto,
      'admin-1',
    );

    const byKey = Object.fromEntries(
      entriesOf(0).map((e) => [e.labelKey, e.value]),
    );
    expect(byKey.SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL).toBe(
      'http://localhost:11434/v1',
    );
  });
});
