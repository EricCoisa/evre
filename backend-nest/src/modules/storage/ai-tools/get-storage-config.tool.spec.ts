import { GetStorageConfigTool } from './get-storage-config.tool';

const SECRETS = {
  SYSTEM_STORAGE_S3_ACCESS_KEY: 'AKIAREALACCESSKEY',
  SYSTEM_STORAGE_S3_SECRET_KEY: 'superSecretValue123',
};

describe('GetStorageConfigTool', () => {
  const store: Record<string, string | null> = {};
  const mockSysConfig = {
    getValueOrNull: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  };
  const mockHealth = { execute: vi.fn() };

  const tool = () =>
    new GetStorageConfigTool(mockSysConfig as never, mockHealth as never);

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(store)) delete store[k];
    mockHealth.execute.mockResolvedValue({ operational: true });
  });

  it('é somente leitura: sem approvalScope, restrita a ADMIN', () => {
    expect(tool().definition.approvalScope).toBeUndefined();
    expect(tool().definition.roles).toEqual(['ADMIN']);
  });

  it('S3: devolve os campos de conexão e a saúde', async () => {
    Object.assign(store, {
      SYSTEM_STORAGE_PROVIDER: 'S3',
      SYSTEM_STORAGE_S3_ENDPOINT: 'http://minio:9000',
      SYSTEM_STORAGE_S3_REGION: 'us-east-1',
      SYSTEM_STORAGE_S3_BUCKET: 'uploads',
      SYSTEM_STORAGE_S3_PUBLIC_URL: 'http://minio:9000/uploads',
      ...SECRETS,
    });

    const result = await tool().execute();

    expect(result).toMatchObject({
      provider: 'S3',
      bucket: 'uploads',
      region: 'us-east-1',
      health: { operational: true },
    });
  });

  it('NUNCA devolve o valor das credenciais, só a presença', async () => {
    Object.assign(store, { SYSTEM_STORAGE_PROVIDER: 'S3', ...SECRETS });

    const result = await tool().execute();
    const serialized = JSON.stringify(result);

    // O getter do SystemConfigurationService entrega o segredo DESCRIPTOGRAFADO;
    // se um dia alguém passar o valor adiante, este teste quebra.
    for (const secret of Object.values(SECRETS)) {
      expect(serialized).not.toContain(secret);
    }
    expect(result).toMatchObject({
      accessKey: 'configurado',
      secretKey: 'configurado',
    });
  });

  it('credencial ausente aparece como não configurada', async () => {
    store.SYSTEM_STORAGE_PROVIDER = 'S3';

    expect(await tool().execute()).toMatchObject({
      accessKey: 'não configurado',
      secretKey: 'não configurado',
    });
  });

  it('LOCAL: devolve dir/baseUrl e nenhum campo de credencial', async () => {
    Object.assign(store, {
      SYSTEM_STORAGE_PROVIDER: 'LOCAL',
      SYSTEM_STORAGE_LOCAL_DIR: './uploads',
      SYSTEM_STORAGE_PUBLIC_BASE_URL: 'http://localhost:3001',
    });

    const result = await tool().execute();

    expect(result).toMatchObject({ provider: 'LOCAL', dir: './uploads' });
    expect(result).not.toHaveProperty('accessKey');
    expect(result).not.toHaveProperty('secretKey');
  });

  it('sem provider gravado assume LOCAL em vez de estourar', async () => {
    expect(await tool().execute()).toMatchObject({ provider: 'LOCAL' });
  });

  it('storage inoperante ainda devolve a config, com o motivo', async () => {
    store.SYSTEM_STORAGE_PROVIDER = 'S3';
    mockHealth.execute.mockResolvedValue({
      operational: false,
      reason: 'bucket not found',
    });

    expect(await tool().execute()).toMatchObject({
      health: { operational: false, reason: 'bucket not found' },
    });
  });
});
