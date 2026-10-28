import { CreateMessagingTemplateSchema } from '../dto/messaging-template.dto';
import { checkMetaTemplateRules, metaErrors } from '../providers/meta-template-rules';
import { CreateTemplateUseCase } from './create-template.use-case';

/** Cria um template com variável reservada e link do sistema obrigatório, passando pelo DTO real (Zod). */
describe('criar template do tipo UPDATE_PROJECT (fluxo completo: DTO → use case → regras da Meta)', () => {
  const prisma = {
    messagingTemplateType: { findUnique: vi.fn() },
    messagingTemplate: { findUnique: vi.fn(), create: vi.fn() },
  };
  const useCase = new CreateTemplateUseCase(prisma as never);

  const TYPE = {
    id: 'type-1',
    key: 'UPDATE_PROJECT',
    variables: [
      { name: 'current_step', type: 'STRING', required: true },
      { name: 'next_step', type: 'STRING', required: true },
      { name: 'first_name', type: 'STRING', required: false, reserved: true },
    ],
    buttons: [
      { key: 'project_link', kind: 'URL', urlBase: 'https://evre.com.br/', required: true, sensitive: true },
    ],
  };

  const request = {
    typeId: 'type-1',
    key: 'UPDATE_PROJECT',
    language: 'pt-BR',
    category: 'UTILITY',
    header: { kind: 'TEXT', text: 'Atualização de projeto' },
    body: [
      'Olá {{ first_name }}, Temos uma atualização sobre o projeto .',
      'Etapa atual: {{ current_step }}',
      'Próximo passo: {{ next_step }}',
      'Você pode acompanhar os detalhes por aqui:',
    ].join('\n'),
    // O que a tela envia: a linha do espaço do tipo, só com o texto preenchido pelo operador.
    buttons: [
      { kind: 'URL', label: 'Acompanhar', url: 'https://evre.com.br/{{ project_link }}', slot: 'project_link' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
  });

  it('salva, com a URL do tipo e o slot preservados', async () => {
    const dto = CreateMessagingTemplateSchema.parse(request);
    await useCase.execute(dto as never);

    expect(prisma.messagingTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buttons: [
          { kind: 'URL', label: 'Acompanhar', url: 'https://evre.com.br/{{ project_link }}', slot: 'project_link' },
        ],
      }),
    });
  });

  it('o operador não consegue trocar o destino do link: a URL gravada é sempre a do tipo', async () => {
    const dto = CreateMessagingTemplateSchema.parse({
      ...request,
      buttons: [{ kind: 'URL', label: 'Acompanhar', url: 'https://outro.site/x', slot: 'project_link' }],
    });
    await useCase.execute(dto as never);
    expect(prisma.messagingTemplate.create.mock.calls[0][0].data.buttons[0].url).toBe(
      'https://evre.com.br/{{ project_link }}',
    );
  });

  it('sem o botão do tipo continua sendo recusado, com o motivo', async () => {
    const dto = CreateMessagingTemplateSchema.parse({ ...request, buttons: undefined });
    await expect(useCase.execute(dto as never)).rejects.toThrow(/obrigatórios do tipo ausentes: project_link/);
  });

  it('o template criado passa nas regras da Meta (nenhum erro; a submissão não será barrada)', () => {
    const dto = CreateMessagingTemplateSchema.parse(request);
    expect(metaErrors(checkMetaTemplateRules(dto as never))).toEqual([]);
  });
});
