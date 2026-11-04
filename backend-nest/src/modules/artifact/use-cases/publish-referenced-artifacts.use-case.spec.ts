import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PublishReferencedArtifactsUseCase } from './publish-referenced-artifacts.use-case';

const mockTx = {
  artifact: { findUnique: vi.fn(), update: vi.fn() },
};
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };

describe('PublishReferencedArtifactsUseCase', () => {
  let useCase: PublishReferencedArtifactsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublishReferencedArtifactsUseCase,
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(PublishReferencedArtifactsUseCase);

    vi.clearAllMocks();
  });

  it('layout sem bloco iframe passa direto, sem tocar o prisma', async () => {
    const layout = { blocks: [{ id: 'a', type: 'text' }] };

    const result = await useCase.execute(layout, mockTx as never);

    expect(result).toEqual(layout);
    expect(mockTx.artifact.findUnique).not.toHaveBeenCalled();
  });

  it('nunca muta o layout original (clona antes de trocar o id)', async () => {
    const layout = {
      blocks: [{ id: 'a', type: 'iframe', props: { artifactId: 'artifact-1' } }],
    };
    mockTx.artifact.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        where.id === 'artifact-1'
          ? Promise.resolve({
              id: 'artifact-1',
              archivedAt: null,
              published: false,
              publicToken: null,
            })
          : Promise.resolve(null),
    );

    await useCase.execute(layout, mockTx as never);

    expect(layout.blocks[0].props.artifactId).toBe('artifact-1');
  });

  it('lança quando o artefato referenciado não existe', async () => {
    mockTx.artifact.findUnique.mockResolvedValue(null);
    const layout = {
      blocks: [{ id: 'a', type: 'iframe', props: { artifactId: 'missing' } }],
    };

    await expect(useCase.execute(layout, mockTx as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lança quando o artefato referenciado está arquivado', async () => {
    mockTx.artifact.findUnique.mockResolvedValue({
      id: 'artifact-1',
      archivedAt: new Date(),
      published: true,
      publicToken: 'abc',
    });
    const layout = {
      blocks: [{ id: 'a', type: 'iframe', props: { artifactId: 'artifact-1' } }],
    };

    await expect(useCase.execute(layout, mockTx as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('liga published e gera um token novo quando o artefato ainda não tinha um', async () => {
    mockTx.artifact.findUnique
      .mockResolvedValueOnce({
        id: 'artifact-1',
        archivedAt: null,
        published: false,
        publicToken: null,
      })
      .mockResolvedValueOnce(null); // checagem de unicidade do token sorteado
    const layout = {
      blocks: [{ id: 'a', type: 'iframe', props: { artifactId: 'artifact-1' } }],
    };

    const result = (await useCase.execute(layout, mockTx as never)) as typeof layout;

    expect(mockTx.artifact.update).toHaveBeenCalledWith({
      where: { id: 'artifact-1' },
      data: { published: true, publicToken: expect.any(String) },
    });
    expect(result.blocks[0].props.artifactId).not.toBe('artifact-1');
    expect(result.blocks[0].props.artifactId).toMatch(/^[a-zA-Z0-9]{16}$/);
  });

  it('já publicado com token existente: reusa o mesmo token, não regenera', async () => {
    mockTx.artifact.findUnique.mockResolvedValue({
      id: 'artifact-1',
      archivedAt: null,
      published: true,
      publicToken: 'ja-existia-123456',
    });
    const layout = {
      blocks: [{ id: 'a', type: 'iframe', props: { artifactId: 'artifact-1' } }],
    };

    const result = (await useCase.execute(layout, mockTx as never)) as typeof layout;

    expect(mockTx.artifact.update).not.toHaveBeenCalled();
    expect(result.blocks[0].props.artifactId).toBe('ja-existia-123456');
  });

  it('encontra bloco iframe aninhado em children de outro bloco', async () => {
    mockTx.artifact.findUnique.mockResolvedValue({
      id: 'artifact-1',
      archivedAt: null,
      published: true,
      publicToken: 'token-aninhado',
    });
    const layout = {
      blocks: [
        {
          id: 'g',
          type: 'group',
          children: [
            { id: 'a', type: 'iframe', props: { artifactId: 'artifact-1' } },
          ],
        },
      ],
    };

    const result = (await useCase.execute(layout, mockTx as never)) as {
      blocks: Array<{ children: Array<{ props: { artifactId: string } }> }>;
    };

    expect(result.blocks[0].children[0].props.artifactId).toBe(
      'token-aninhado',
    );
  });
});
