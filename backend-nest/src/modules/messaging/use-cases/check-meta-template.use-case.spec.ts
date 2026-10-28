import { CheckMetaTemplateUseCase } from './check-meta-template.use-case';
import { CheckMetaTemplateSchema } from '../dto/messaging-template-submission.dto';

describe('CheckMetaTemplateUseCase', () => {
  const useCase = new CheckMetaTemplateUseCase();

  it('devolve os problemas do rascunho, com código, severidade e campo', () => {
    const { issues } = useCase.execute({
      category: 'UTILITY',
      body: '{{ nome }}, seu pedido saiu hoje de manhã',
      footer: 'Pedido {{ id }}',
    } as never);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BODY_STARTS_WITH_VARIABLE', severity: 'error', field: 'body' }),
        expect.objectContaining({ code: 'FOOTER_HAS_VARIABLE', severity: 'error', field: 'footer' }),
      ]),
    );
  });

  it('rascunho vazio não quebra', () => {
    expect(useCase.execute({ category: 'MARKETING', body: '' } as never).issues).toEqual([]);
  });

  it('o schema aceita o rascunho parcial do editor (header/footer/buttons nulos)', () => {
    expect(
      CheckMetaTemplateSchema.safeParse({ category: 'UTILITY', body: 'x', header: null, footer: null, buttons: null })
        .success,
    ).toBe(true);
    expect(CheckMetaTemplateSchema.safeParse({ category: 'OUTRA', body: 'x' }).success).toBe(false);
  });
});
