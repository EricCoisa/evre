import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { NotificationService } from '../../notification/notification.service';
import { CreateLeadUseCase } from './create-lead.use-case';
import { ListLeadsUseCase } from './list-leads.use-case';
import { UpdateLeadStatusUseCase } from './update-lead-status.use-case';

const row = {
  id: 'lead-1',
  name: 'João Silva',
  phone: '+5511999990000',
  email: null,
  message: 'Quero saber mais',
  status: 'NEW',
  messagingContactId: 'contact-1',
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  lead: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  messagingContact: {
    upsert: vi.fn(),
  },
};

const mockLogging = { create: vi.fn() };
const mockNotification = { notify: vi.fn() };

describe('Lead use-cases', () => {
  let create: CreateLeadUseCase;
  let list: ListLeadsUseCase;
  let updateStatus: UpdateLeadStatusUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CreateLeadUseCase,
        ListLeadsUseCase,
        UpdateLeadStatusUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggingService, useValue: mockLogging },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    create = mod.get(CreateLeadUseCase);
    list = mod.get(ListLeadsUseCase);
    updateStatus = mod.get(UpdateLeadStatusUseCase);

    vi.clearAllMocks();
    mockPrisma.messagingContact.upsert.mockResolvedValue({ id: 'contact-1' });
    mockPrisma.lead.create.mockResolvedValue(row);
    mockPrisma.lead.findMany.mockResolvedValue([row]);
    mockPrisma.lead.count.mockResolvedValue(1);
    mockPrisma.lead.findUnique.mockResolvedValue(row);
    mockPrisma.lead.update.mockResolvedValue({ ...row, status: 'VIEWED' });
  });

  it('create faz upsert do MessagingContact quando phone informado', async () => {
    await create.execute({ name: 'João', phone: '+5511999990000', message: 'Olá' });

    expect(mockPrisma.messagingContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '5511999990000' } }),
    );
    expect(mockPrisma.lead.create).toHaveBeenCalled();
  });

  it('create pula upsert de MessagingContact quando só email informado', async () => {
    await create.execute({ name: 'Maria', email: 'maria@ex.com', message: 'Olá' });

    expect(mockPrisma.messagingContact.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).toHaveBeenCalled();
  });

  it('create dispara notificação para ADMIN', async () => {
    await create.execute({ name: 'João', phone: '+5511999990000', message: 'Olá' });

    expect(mockNotification.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { roleNames: ['ADMIN'] },
        channels: { whatsapp: true },
      }),
    );
  });

  it('list devolve envelope paginado', async () => {
    const result = (await list.execute({
      page: 1,
      limit: 10,
      pagination: true,
    })) as { meta: { total: number } };

    expect(mockPrisma.lead.findMany).toHaveBeenCalled();
    expect(result.meta.total).toBe(1);
  });

  it('updateStatus lança NotFoundException quando lead não existe', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);

    await expect(
      updateStatus.execute('nao-existe', { status: 'VIEWED' }, 'user-1'),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('updateStatus grava resolvedAt/resolvedById ao resolver', async () => {
    await updateStatus.execute('lead-1', { status: 'RESOLVED' }, 'user-1');

    const updateCall = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateCall.data.resolvedById).toBe('user-1');
    expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
  });
});
