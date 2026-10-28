import { ListTemplateVariablesUseCase } from './list-template-variables.use-case';

describe('ListTemplateVariablesUseCase', () => {
  it('expõe name/type/labelKey/allowUse/dummy/sensitive/callerProvided, sem resolve nem fallback', () => {
    const result = new ListTemplateVariablesUseCase().execute();

    expect(result).toEqual([
      { name: 'first_name', type: 'STRING', labelKey: 'variable.first_name', allowUse: true, dummy: 'Ana', sensitive: false, callerProvided: false },
      { name: 'full_name', type: 'STRING', labelKey: 'variable.full_name', allowUse: true, dummy: 'Ana Souza', sensitive: false, callerProvided: false },
    ]);
  });
});
