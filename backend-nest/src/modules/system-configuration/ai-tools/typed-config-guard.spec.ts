import { CreateSystemConfigurationTool } from './create-system-configuration.tool';
import { UpdateSystemConfigurationTool } from './update-system-configuration.tool';
import { DeleteSystemConfigurationTool } from './delete-system-configuration.tool';

const ctx = { userId: 'u1', roleName: 'ADMIN', approvedScopes: [] };

/** Confere que a tool genérica recusa escrever nas chaves que só os use-cases típados devem validar. */
describe('tools genéricas de system-configuration: chaves de provider típado', () => {
  const mockSysConfig = { findOne: vi.fn() };
  const mockCreate = { execute: vi.fn() };
  const mockUpdate = { execute: vi.fn() };
  const mockRemove = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.execute.mockResolvedValue({ id: 'c1', secret: false });
    mockUpdate.execute.mockResolvedValue({ id: 'c1', secret: false });
    mockRemove.execute.mockResolvedValue({ id: 'c1' });
  });

  describe('create (labelKey vem no input)', () => {
    const tool = () => new CreateSystemConfigurationTool(mockCreate as never);

    it.each([
      ['SYSTEM_STORAGE_S3_BUCKET', 'save_storage_config'],
      ['SYSTEM_EMAIL_SMTP_PASS', 'save_email_config'],
      ['SYSTEM_CAPTCHA_SECRET_KEY', 'save_captcha_config'],
    ])('recusa %s apontando %s', async (labelKey, expected) => {
      await expect(
        tool().execute({ labelKey, value: 'x' } as never, ctx),
      ).rejects.toThrow(expected);
      expect(mockCreate.execute).not.toHaveBeenCalled();
    });

    it('deixa passar chave genérica', async () => {
      await tool().execute(
        { labelKey: 'SYSTEM_SOMETHING_ELSE', value: 'x' } as never,
        ctx,
      );
      expect(mockCreate.execute).toHaveBeenCalled();
    });

    it('deixa passar SYSTEM_CAPTCHA_ENABLED — o liga/desliga não tem substituto', async () => {
      await tool().execute(
        { labelKey: 'SYSTEM_CAPTCHA_ENABLED', value: 'false' } as never,
        ctx,
      );
      expect(mockCreate.execute).toHaveBeenCalled();
    });
  });

  describe('update (resolve a labelKey pelo id)', () => {
    const tool = () =>
      new UpdateSystemConfigurationTool(
        mockUpdate as never,
        mockSysConfig as never,
      );
    const id = '11111111-1111-1111-1111-111111111111';

    it('recusa quando o id aponta para chave de provider típado', async () => {
      mockSysConfig.findOne.mockResolvedValue({
        labelKey: 'SYSTEM_STORAGE_S3_SECRET_KEY',
        value: 'segredoDescriptografado',
      });

      await expect(
        tool().execute({ id, value: 'novo' } as never, ctx),
      ).rejects.toThrow('save_storage_config');
      expect(mockUpdate.execute).not.toHaveBeenCalled();
    });

    it('a recusa não vaza o valor que o findOne devolve descriptografado', async () => {
      mockSysConfig.findOne.mockResolvedValue({
        labelKey: 'SYSTEM_EMAIL_SMTP_PASS',
        value: 'senhaEmTextoClaro',
      });

      await expect(
        tool().execute({ id, value: 'novo' } as never, ctx),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining('senhaEmTextoClaro'),
        }) as Error,
      );
    });

    it('deixa passar chave genérica', async () => {
      mockSysConfig.findOne.mockResolvedValue({
        labelKey: 'SYSTEM_AGENT_OWN_KEY',
        value: 'false',
      });

      await tool().execute({ id, value: 'true' } as never, ctx);
      expect(mockUpdate.execute).toHaveBeenCalled();
    });
  });

  describe('delete (resolve a labelKey pelo id)', () => {
    const tool = () =>
      new DeleteSystemConfigurationTool(
        mockRemove as never,
        mockSysConfig as never,
      );
    const id = '22222222-2222-2222-2222-222222222222';

    it('recusa apagar chave de provider típado', async () => {
      mockSysConfig.findOne.mockResolvedValue({
        labelKey: 'SYSTEM_CAPTCHA_SITE_KEY',
        value: 'x',
      });

      await expect(tool().execute({ id }, ctx)).rejects.toThrow(
        'save_captcha_config',
      );
      expect(mockRemove.execute).not.toHaveBeenCalled();
    });

    it('deixa passar chave genérica', async () => {
      mockSysConfig.findOne.mockResolvedValue({
        labelKey: 'ALGUMA_OUTRA',
        value: 'x',
      });

      await tool().execute({ id }, ctx);
      expect(mockRemove.execute).toHaveBeenCalledWith('u1', id);
    });
  });
});
