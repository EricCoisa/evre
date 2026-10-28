import { CheckChannelHealthUseCase } from './check-channel-health.use-case';
import type { CapabilityRegistry } from '../../capability/capability.registry';
import type { MessagingTemplateService } from '../../messaging/messaging-template.service';
import type { I18nService } from 'nestjs-i18n';

const mockCapabilities = { resolve: vi.fn() };
const mockTemplates = { isUsable: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

describe('CheckChannelHealthUseCase', () => {
  const useCase = new CheckChannelHealthUseCase(
    mockCapabilities as unknown as CapabilityRegistry,
    mockTemplates as unknown as MessagingTemplateService,
    mockI18n as unknown as I18nService,
  );

  beforeEach(() => vi.clearAllMocks());

  it('EMAIL: operacional quando capability EMAIL está operacional', async () => {
    mockCapabilities.resolve.mockResolvedValue({ operational: true });

    await expect(useCase.execute('EMAIL')).resolves.toEqual({ operational: true });
    expect(mockCapabilities.resolve).toHaveBeenCalledWith('EMAIL', 'ADMIN');
  });

  it('EMAIL: repassa o reason da capability EMAIL quando indisponível', async () => {
    mockCapabilities.resolve.mockResolvedValue({
      operational: false,
      reason: 'invalid key',
    });

    await expect(useCase.execute('EMAIL')).resolves.toEqual({
      operational: false,
      reason: 'invalid key',
    });
  });

  it('WHATSAPP: indisponível quando a capability MESSAGING está inoperante (ex: sessão desconectada) — nem consulta o template', async () => {
    mockCapabilities.resolve.mockResolvedValue({
      operational: false,
      reason: 'A sessão do WhatsApp está desconectada. O aparelho precisa ser pareado.',
    });

    const result = await useCase.execute('WHATSAPP');

    expect(result.operational).toBe(false);
    expect(result.reason).toBe(
      'A sessão do WhatsApp está desconectada. O aparelho precisa ser pareado.',
    );
    expect(mockTemplates.isUsable).not.toHaveBeenCalled();
    expect(mockCapabilities.resolve).toHaveBeenCalledWith('MESSAGING', 'ADMIN');
  });

  it('WHATSAPP: indisponível quando o template único de verificação não existe', async () => {
    mockCapabilities.resolve.mockResolvedValue({ operational: true });
    mockTemplates.isUsable.mockResolvedValue(false);

    const result = await useCase.execute('WHATSAPP');

    expect(result.operational).toBe(false);
    expect(result.reason).toBe('verification.template_unavailable');
    expect(mockTemplates.isUsable).toHaveBeenCalledWith('VERIFICATION_CODE');
  });

  it('WHATSAPP: operacional quando capability MESSAGING operacional e o template existe', async () => {
    mockCapabilities.resolve.mockResolvedValue({ operational: true });
    mockTemplates.isUsable.mockResolvedValue(true);

    await expect(useCase.execute('WHATSAPP')).resolves.toEqual({ operational: true });
  });

  it('AUTHENTICATOR: não implementado', async () => {
    const result = await useCase.execute('AUTHENTICATOR');
    expect(result.operational).toBe(false);
  });
});
