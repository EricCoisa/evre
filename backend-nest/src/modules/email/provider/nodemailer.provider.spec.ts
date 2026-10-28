import { NodemailerEmailService } from './nodemailer.provider';
import type { SmtpConfigDto } from '../dto/smtp-config.dto';

const verify = vi.hoisted(() => vi.fn());

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ verify }) },
}));

// `data` é texto que chega no toast do usuário — se voltar a ser JSON,
// a tela exibe {"message":"..."} cru (bug do settings?tab=emailConfig).
describe('NodemailerEmailService.validateConfiguration', () => {
  const provider = () => new NodemailerEmailService().use({} as SmtpConfigDto);

  it('retorna a mensagem do erro em texto puro, não JSON', async () => {
    verify.mockRejectedValueOnce(
      new Error('getaddrinfo ENOTFOUND smtp.example.com'),
    );
    const res = await provider().validateConfiguration();
    expect(res).toEqual({
      status: false,
      data: 'getaddrinfo ENOTFOUND smtp.example.com',
    });
  });

  it('traduz erro de TLS em dica acionável, também em texto puro', async () => {
    verify.mockRejectedValueOnce(new Error('wrong version number'));
    const res = await provider().validateConfiguration();
    expect(res.status).toBe(false);
    expect(res.data).toContain('STARTTLS');
    expect(() => JSON.parse(res.data)).toThrow();
  });
});
