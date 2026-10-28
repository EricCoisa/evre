import { VerificationController } from './verification.controller';
import type { VerificationService } from './verification.service';

const mockVerification = { request: vi.fn(), confirm: vi.fn(), checkChannelHealth: vi.fn() };
const user = { id: 'u1' } as never;

describe('VerificationController', () => {
  let controller: VerificationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new VerificationController(
      mockVerification as unknown as VerificationService,
    );
  });

  it('request() repassa userId do token + purpose/channel/target do body', async () => {
    mockVerification.request.mockResolvedValue({ expiresAt: new Date() });

    await controller.request(user, {
      purpose: 'USER_PHONE_CONFIRMATION',
      channel: 'WHATSAPP',
      target: '+5511999998888',
    } as never);

    expect(mockVerification.request).toHaveBeenCalledWith({
      userId: 'u1',
      purpose: 'USER_PHONE_CONFIRMATION',
      channel: 'WHATSAPP',
      target: '+5511999998888',
    });
  });

  it('confirm() repassa userId do token + purpose/code do body', async () => {
    mockVerification.confirm.mockResolvedValue(undefined);

    await controller.confirm(user, {
      purpose: 'USER_EMAIL_CONFIRMATION',
      code: '123456',
    } as never);

    expect(mockVerification.confirm).toHaveBeenCalledWith({
      userId: 'u1',
      purpose: 'USER_EMAIL_CONFIRMATION',
      code: '123456',
    });
  });

  it('health() repassa o channel da query e devolve o resultado do service', async () => {
    mockVerification.checkChannelHealth.mockResolvedValue({ operational: true });

    const result = await controller.health({ channel: 'WHATSAPP' });

    expect(mockVerification.checkChannelHealth).toHaveBeenCalledWith('WHATSAPP');
    expect(result).toEqual({ operational: true });
  });
});
