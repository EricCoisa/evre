import { ListTemplateButtonsUseCase } from './list-template-buttons.use-case';
import { ButtonHandlerRegistry } from '../button-handler.registry';

describe('ListTemplateButtonsUseCase', () => {
  it('lista os reservados liberáveis e os handlers registrados (type nulo = qualquer tipo)', () => {
    const registry = new ButtonHandlerRegistry();
    registry.register({ button: 'opt_out' }, vi.fn());
    registry.register({ type: 'ORDER', button: 'details' }, vi.fn());

    const info = new ListTemplateButtonsUseCase(registry).execute();

    expect(info.reserved).toEqual([
      expect.objectContaining({ key: 'opt_out', kind: 'QUICK_REPLY', allowUse: true }),
    ]);
    expect(info.handlers).toEqual([
      { type: null, button: 'opt_out' },
      { type: 'ORDER', button: 'details' },
    ]);
  });
});
