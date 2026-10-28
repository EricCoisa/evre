import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EVO,
  GO_CONNECTION,
  META,
  realConnections,
  type ConnectionRow,
} from './test-utils/messaging-fixtures';

describe('MessagingConnectionService', () => {
  describe('resolve', () => {
    it('com id devolve a conexão; id desconhecido é 404', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION]);
      expect((await service.resolve('conn-go')).id).toBe('conn-go');
      await expect(service.resolve('nada')).rejects.toThrow(
        'messaging.connection_not_found',
      );
    });

    it('sem id usa a mais antiga', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION, META]);
      expect((await service.resolve()).id).toBe('conn-evo');
    });

    it('sem nenhuma conexão diz para criar uma', async () => {
      const { service } = realConnections([]);
      await expect(service.resolve()).rejects.toThrow(
        'messaging.no_connection',
      );
    });
  });

  describe('config agnóstica com segredos cifrados', () => {
    it('plainConfig decifra só os campos secretos do provider', () => {
      const { service } = realConnections([EVO]);
      expect(service.plainConfig(EVO as never)).toEqual({
        baseUrl: 'http://evolution:8080',
        token: 'tok', // estava como `enc:tok`
        instance: 'inst',
      });
    });

    it('segredo que não é texto cifrado (legado em claro) passa como está, sem erro', () => {
      const { service } = realConnections([]);
      const legacy = {
        ...EVO,
        config: { baseUrl: 'http://x', token: 'em-claro', instance: 'i' },
      };
      expect(service.plainConfig(legacy as never).token).toBe('em-claro');
    });

    it('encode cifra os segredos e descarta o que está vazio', () => {
      const { service } = realConnections([]);
      expect(
        service.encode('META', {
          phoneNumberId: ' 123 ',
          accessToken: 'tok',
          appSecret: '',
          graphVersion: 'v21.0',
        }),
      ).toEqual({
        phoneNumberId: '123',
        accessToken: 'enc:tok',
        graphVersion: 'v21.0',
      });
    });

    it('cada provider declara os próprios segredos', () => {
      const { service } = realConnections([]);
      expect(service.secretFields('EVOLUTION_API')).toEqual([
        'token',
        'webhookSecret',
      ]);
      expect(service.secretFields('EVOLUTION_GO')).toEqual([
        'token',
        'instanceToken',
      ]);
      expect(service.secretFields('META')).toEqual([
        'accessToken',
        'appSecret',
        'verifyToken',
      ]);
    });

    // O que a API devolve nunca contém o segredo: nem cifrado.
    it('view não expõe segredo — só se está preenchido', () => {
      const { service } = realConnections([EVO]);
      const view = service.view({ ...EVO, phone: '5534998956461' } as never);

      expect(view.config).toEqual({
        baseUrl: 'http://evolution:8080',
        instance: 'inst',
      });
      expect(view.secrets).toEqual({ token: true, webhookSecret: false });
      expect(JSON.stringify(view)).not.toMatch(/enc:|"tok"/);
      expect(view.phone).toBe('5534998956461');
    });

    it('resolve: sem id usa a padrão; sem padrão, a mais antiga; com id, a pedida', async () => {
      const { service } = realConnections([EVO, { ...GO_CONNECTION, isDefault: true }]);
      expect((await service.resolve()).id).toBe('conn-go');
      expect((await service.resolve('conn-evo')).id).toBe('conn-evo');

      const { service: noDefault } = realConnections([EVO, GO_CONNECTION]);
      expect((await noDefault.resolve()).id).toBe('conn-evo');
    });

    it('setDefault troca a padrão: só uma fica marcada', async () => {
      const { service, prisma } = realConnections([
        { ...EVO, isDefault: true },
        GO_CONNECTION,
      ]);
      await service.setDefault('conn-go');
      expect(
        prisma.store.filter((row) => row.isDefault).map((row) => row.id),
      ).toEqual(['conn-go']);
    });

    it('a primeira conexão criada já nasce padrão; a segunda não', async () => {
      const { service, prisma } = realConnections([]);
      const first = await service.create('EVOLUTION_API', {}, null);
      const second = await service.create('META', {}, null);
      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(false);
      expect(prisma.store).toHaveLength(2);
    });

    it('use() monta o provider; config inválida estoura dizendo o campo', () => {
      const { service } = realConnections([EVO]);
      expect(service.use(EVO as never).send).toBeTypeOf('function');
      expect(() =>
        service.use({ ...EVO, config: { baseUrl: 'x' } } as never),
      ).toThrow(
        /Configuração de mensageria inválida.*(token|instance|baseUrl)/,
      );
    });
  });

  describe('número da conexão', () => {
    const uniqueViolation = (target: unknown = ['phone']) =>
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { target },
      });

    it('bindPhone fixa o número', async () => {
      const { service, prisma } = realConnections([EVO]);
      await service.bindPhone('conn-evo', '5534998956461');
      expect(prisma.messagingConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-evo' },
        data: { phone: '5534998956461' },
      });
    });

    it('o mesmo número em outra conexão vira 409, não 500', async () => {
      const { service, prisma } = realConnections([EVO]);
      prisma.messagingConnection.update.mockRejectedValue(uniqueViolation());
      await expect(
        service.bindPhone('conn-evo', '5534998956461'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('criar com número já usado também é 409', async () => {
      const { service, prisma } = realConnections([]);
      prisma.messagingConnection.create.mockRejectedValue(uniqueViolation());
      await expect(service.create('META', {}, '5534998956461')).rejects.toThrow(
        'messaging.connection_phone_in_use',
      );
    });

    it('violação de OUTRO índice único não é relatada como "número em uso"', async () => {
      const { service, prisma } = realConnections([EVO]);
      const other = uniqueViolation('messaging_connections_outro_idx');
      prisma.messagingConnection.update.mockRejectedValue(other);
      await expect(service.bindPhone('conn-evo', '5534')).rejects.toBe(other);
    });

    it('outros erros do banco seguem como estão', async () => {
      const { service, prisma } = realConnections([EVO]);
      prisma.messagingConnection.update.mockRejectedValue(
        new Error('conexão caiu'),
      );
      await expect(service.bindPhone('conn-evo', '5534')).rejects.toThrow(
        'conexão caiu',
      );
    });
  });

  describe('primeira conexão nasce padrão', () => {
    const defaultRace = () =>
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { target: 'messaging_connections_single_default' },
      });

    it('sem nenhuma conexão em uso, nasce padrão', async () => {
      const { service, prisma } = realConnections([]);
      prisma.messagingConnection.create.mockResolvedValue({ id: 'novo' } as never);
      await service.create('META', {}, null);
      expect(prisma.messagingConnection.create).toHaveBeenCalledWith({
        data: { provider: 'META', config: {}, phone: null, isDefault: true },
      });
    });

    // Duas criações simultâneas leem "zero conexões": o índice parcial deixa uma só ser padrão.
    it('perdeu a corrida pelo padrão: relê e cria como não-padrão, sem erro', async () => {
      const { service, prisma } = realConnections([]);
      prisma.messagingConnection.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      prisma.messagingConnection.create
        .mockRejectedValueOnce(defaultRace())
        .mockResolvedValueOnce({ id: 'novo' } as never);

      await expect(service.create('EVOLUTION_GO', {}, null)).resolves.toEqual({
        id: 'novo',
      });
      expect(prisma.messagingConnection.create).toHaveBeenLastCalledWith({
        data: { provider: 'EVOLUTION_GO', config: {}, phone: null, isDefault: false },
      });
    });

    it('a corrida pelo padrão não vira "número em uso" nem repete para sempre', async () => {
      const { service, prisma } = realConnections([]);
      const race = defaultRace();
      prisma.messagingConnection.count.mockResolvedValue(0);
      prisma.messagingConnection.create.mockRejectedValue(race);
      await expect(service.create('EVOLUTION_GO', {}, '5534')).rejects.toBe(race);
      expect(prisma.messagingConnection.create).toHaveBeenCalledTimes(2);
    });

    it('violação de unicidade sem target/constraint identificável segue como está', async () => {
      const { service, prisma } = realConnections([]);
      const unidentified = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
        meta: {},
      });
      prisma.messagingConnection.create.mockRejectedValue(unidentified);

      await expect(service.create('META', {}, null)).rejects.toBe(unidentified);
    });
  });

  describe('updateConfig', () => {
    it('grava a nova config da conexão', async () => {
      const { service, prisma } = realConnections([EVO]);
      await service.updateConfig('conn-evo', { baseUrl: 'http://novo:8080' });
      expect(prisma.messagingConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-evo' },
        data: { config: { baseUrl: 'http://novo:8080' } },
      });
    });
  });

  describe('getActive / conexão arquivada', () => {
    const archived: ConnectionRow = {
      ...EVO,
      archivedAt: new Date(),
      isDefault: false,
    } as ConnectionRow;

    it('getActive devolve a conexão em uso', async () => {
      const { service } = realConnections([EVO]);
      expect((await service.getActive('conn-evo')).id).toBe('conn-evo');
    });

    it('getActive recusa a arquivada com 400, mas get segue lendo (histórico)', async () => {
      const { service } = realConnections([archived]);
      await expect(service.getActive('conn-evo')).rejects.toThrow(
        'messaging.connection_archived',
      );
      expect((await service.get('conn-evo')).id).toBe('conn-evo');
    });

    it('setDefault recusa a arquivada antes de tocar no banco', async () => {
      const { service, prisma } = realConnections([archived]);
      await expect(service.setDefault('conn-evo')).rejects.toThrow(
        'messaging.connection_archived',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  it('findByProvider acha a conexão do provider (limite de uma por provider)', async () => {
    const { service } = realConnections([EVO, GO_CONNECTION]);
    expect((await service.findByProvider('EVOLUTION_GO'))?.id).toBe('conn-go');
    expect(await service.findByProvider('META')).toBeNull();
  });

  /** Arquivar é a única forma de trocar provider ou número numa conexão em uso. */
  describe('arquivar conexão', () => {
    it('mantém o número vinculado e tira de uso, sem apagar a linha', async () => {
      const paired = { ...EVO, phone: '5534998956461' };
      const { service, prisma } = realConnections([paired, GO_CONNECTION]);

      const archived = await service.archive('conn-evo');

      expect(archived.archivedAt).toBeInstanceOf(Date);
      // Número preservado para possibilitar restauração posterior
      expect(archived.phone).toBe('5534998956461');
      expect(prisma.store).toHaveLength(2);
    });

    it('sai de list e de findByProvider, mas get continua achando (histórico)', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION]);
      await service.archive('conn-evo');

      expect((await service.list()).map((row) => row.id)).toEqual(['conn-go']);
      expect(await service.findByProvider('EVOLUTION_API')).toBeNull();
      expect((await service.get('conn-evo')).id).toBe('conn-evo');
    });

    it('list({ archived: true }) lista apenas as arquivadas', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION]);
      await service.archive('conn-evo');

      const archived = await service.list({ archived: true });
      expect(archived.map((r) => r.id)).toEqual(['conn-evo']);
    });

    it('unarchive reativa a conexão arquivada', async () => {
      const { service } = realConnections([EVO]);
      await service.archive('conn-evo');
      expect((await service.list())).toHaveLength(0);

      const restored = await service.unarchive('conn-evo');
      expect(restored.archivedAt).toBeNull();
      expect(restored.isDefault).toBe(true);
      expect((await service.list())).toHaveLength(1);
    });

    it('arquivar a padrão promove a mais antiga das que sobram', async () => {
      const { service, prisma } = realConnections([
        { ...EVO, isDefault: true },
        GO_CONNECTION,
        META,
      ]);

      await service.archive('conn-evo');

      expect(
        prisma.store.filter((row) => row.isDefault).map((row) => row.id),
      ).toEqual(['conn-go']);
    });

    /** Sem padrão viva, o envio sem `connectionId` ficaria sem alvo. */
    it('arquivar a padrão sendo a última não deixa ninguém padrão', async () => {
      const { service, prisma } = realConnections([{ ...EVO, isDefault: true }]);

      await service.archive('conn-evo');

      expect(prisma.store.filter((row) => row.isDefault)).toEqual([]);
    });

    it('arquivar a não-padrão não mexe em quem é padrão', async () => {
      const { service, prisma } = realConnections([
        { ...EVO, isDefault: true },
        GO_CONNECTION,
      ]);

      await service.archive('conn-go');

      expect(
        prisma.store.filter((row) => row.isDefault).map((row) => row.id),
      ).toEqual(['conn-evo']);
    });

    it('arquivar de novo é no-op, não erro', async () => {
      const { service } = realConnections([EVO]);
      const first = await service.archive('conn-evo');
      const again = await service.archive('conn-evo');
      expect(again.archivedAt).toEqual(first.archivedAt);
    });

    it('arquivada não envia: resolve pelo id recusa', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION]);
      await service.archive('conn-evo');

      await expect(service.resolve('conn-evo')).rejects.toThrow(
        'messaging.connection_archived',
      );
    });

    it('arquivada não é escolhida como padrão implícita', async () => {
      const { service } = realConnections([EVO, GO_CONNECTION]);
      await service.archive('conn-evo');
      expect((await service.resolve()).id).toBe('conn-go');
    });

    /** Conexão arquivada não deve contar no count() de criação, senão nasceria sem padrão promovível. */
    it('depois de arquivar tudo, a conexão nova nasce padrão', async () => {
      const { service } = realConnections([{ ...EVO, isDefault: true }]);
      await service.archive('conn-evo');

      const nova = await service.create('EVOLUTION_GO', {}, null);

      expect(nova.isDefault).toBe(true);
    });

    it('criar nova com número de conexão arquivada lança orientando a restaurar', async () => {
      const { service } = realConnections([{ ...EVO, phone: '5534998956461' }]);
      await service.archive('conn-evo');

      await expect(
        service.create('META', {}, '5534998956461'),
      ).rejects.toThrow('messaging.connection_phone_archived');
    });
  });

  it('list ordena da mais antiga para a mais nova', async () => {
    const rows: ConnectionRow[] = [EVO, GO_CONNECTION];
    const { service, prisma } = realConnections(rows);
    await service.list();
    expect(prisma.messagingConnection.findMany).toHaveBeenCalled();
  });
});
