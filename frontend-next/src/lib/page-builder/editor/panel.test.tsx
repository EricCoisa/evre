import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorPanel } from './panel';
import { EditorProvider, useEditorOrThrow } from './context';
import { EMPTY_LAYOUT } from './mutations';
import type { LayoutProfileName } from '../profiles';
import { maxChildrenFor, type PageLayout } from '../schema';
const MAX_CHILDREN = maxChildrenFor('dashboard');

/** `panel.tsx` só depende de `useEditorOrThrow` (contexto real, sem mock) e `usePageSources`
 * (mockado abaixo) — nada de dnd-kit envolvido, diferente de editor.test.tsx. */

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

const mockSources = vi.hoisted(() => ({
  current: [
    {
      key: 'users.list',
      kind: 'list',
      description: 'Lista de usuários.',
      fields: ['name', 'email'],
      params: [
        { name: 'limit', type: 'number', description: 'Quantidade de linhas.' },
        { name: 'q', type: 'string', description: 'Busca por nome.' },
      ],
    },
    {
      key: 'signups.series',
      kind: 'series',
      description: 'Série de cadastros.',
      fields: [],
      params: [],
    },
  ] as {
    key: string;
    kind: string;
    description: string;
    fields: string[];
    params: { name: string; type: string; description: string }[];
  }[],
  isLoading: false,
}));
vi.mock('@/lib/actions/pageBuilder/queries', () => ({
  usePageSources: () => ({ data: mockSources.current, isLoading: mockSources.isLoading }),
}));

beforeEach(() => {
  mockSources.isLoading = false;
});

/** Botão de teste puro: expõe `editor.select` para pré-selecionar um bloco sem passar pela
 * paleta (que só oferece tipos conhecidos) — usado no caso de layout com tipo órfão. */
function SelectBlockButton({ id }: { id: string }) {
  const editor = useEditorOrThrow();
  return <button onClick={() => editor.select(id)}>select-{id}</button>;
}

function renderPanel(options?: {
  initial?: PageLayout;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onSaveAsDefault?: () => void;
  onCancel?: () => void;
  preselect?: string;
  profile?: LayoutProfileName;
}) {
  const props = {
    pageKey: '/dashboard',
    dirty: options?.dirty ?? false,
    saving: options?.saving ?? false,
    onSave: options?.onSave ?? vi.fn(),
    onSaveAsDefault: options?.onSaveAsDefault,
    onCancel: options?.onCancel ?? vi.fn(),
  };

  const utils = render(
    <EditorProvider
      initial={options?.initial ?? EMPTY_LAYOUT}
      profile={options?.profile}
    >
      {options?.preselect ? <SelectBlockButton id={options.preselect} /> : null}
      <EditorPanel {...props} />
    </EditorProvider>,
  );

  if (options?.preselect) {
    fireEvent.click(screen.getByText(`select-${options.preselect}`));
  }

  return { ...utils, props };
}

const addButton = (type: string) =>
  screen.getByRole('button', { name: new RegExp(type.replace('.', '\\.')) });

/** O trigger do Select (Radix) tem `role="combobox"` mas nome ARIA "from author" — o texto
 * visível dentro dele não conta como accessible name. Por isso localizamos pelo `<label>`
 * vizinho em vez de `getByRole('combobox', { name })`, igual ao padrão já usado em
 * data-table.test.tsx. */
function fieldGroup(labelText: string | RegExp): HTMLElement {
  return screen.getByText(labelText, { selector: 'label' }).parentElement!;
}

function comboboxNear(labelText: string): HTMLElement {
  return within(fieldGroup(labelText)).getByRole('combobox');
}

/** Mesma limitação para `<Input>`: o `<Label>` de prop/param é irmão, não `htmlFor`. */
function inputNear(labelText: string | RegExp): HTMLInputElement {
  return fieldGroup(labelText).querySelector('input') as HTMLInputElement;
}

describe('EditorPanel — estado vazio e cabeçalho', () => {
  it('sem seleção, mostra o convite a selecionar e nenhum formulário', () => {
    renderPanel();

    expect(screen.getByText('editor.nothingSelected')).toBeInTheDocument();
    expect(screen.queryByText('editor.dataSource')).not.toBeInTheDocument();
  });

  it('cabeçalho mostra o pageKey e o X fecha como o botão Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderPanel({ onCancel });

    expect(screen.getByText('/dashboard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'editor.close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Palette', () => {
  it('rótulo muda entre "adicionar" e "adicionar ao container" conforme a seleção', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText('editor.addBlock')).toBeInTheDocument();

    await user.click(addButton('group'));

    expect(screen.getByText('editor.addToContainer')).toBeInTheDocument();
  });

  it('container fica desabilitado na paleta quando já há um container selecionado', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(addButton('group'));

    expect(addButton('group')).toBeDisabled();
    expect(addButton('text.rich')).toBeEnabled();
  });

  it(
    'atinge o teto de filhos do container e desabilita tudo com o aviso',
    async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(addButton('group'));
      // A seleção migra para o último filho, que mantém o mesmo parentId,
      // então clicar MAX_CHILDREN vezes seguidas continua inserindo no mesmo group.
      for (let i = 0; i < MAX_CHILDREN; i++) {
        await user.click(addButton('text.rich'));
      }

      expect(screen.getByText('editor.limitReached')).toBeInTheDocument();
      expect(addButton('text.rich')).toBeDisabled();
      expect(addButton('table.basic')).toBeDisabled();
    },
    15000,
  );

  // A4: proposal passou de dataSources 'none' para 'inline-only' e ganhou os 5 blocos de dado —
  // hoje o catálogo dela é o superset dos 16 tipos, então ela não tem mais um bloco "de fora"
  // para provar a exclusão; isso passa a ser testado pelo lado do dashboard, que não ganha os
  // blocos exclusivos de proposta (ex. `topic`).
  it('profile proposal oferece os blocos do profile, incluindo os 5 de dado (JSON inline)', () => {
    renderPanel({ profile: 'proposal' });

    expect(addButton('text.rich')).toBeInTheDocument();
    expect(addButton('group')).toBeInTheDocument();
    expect(addButton('table.basic')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chart\.area/ })).toBeInTheDocument();
  });

  it('profile dashboard não oferece os blocos exclusivos de proposta', () => {
    renderPanel();

    expect(addButton('table.basic')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /topic/ })).not.toBeInTheDocument();
  });
});

describe('BlockForm — tipo desconhecido', () => {
  it('bloco de tipo que o BLOCK_META não reconhece mostra o aviso em vez de quebrar', () => {
    const initial: PageLayout = {
      v: 1,
      blocks: [{ id: 'orphan', type: 'legacy.widget', span: 4, props: {} }],
    };
    renderPanel({ initial, preselect: 'orphan' });

    expect(screen.getByText('editor.unknownType:legacy.widget')).toBeInTheDocument();
  });
});

describe('BlockForm — fonte de dados', () => {
  const withTable: PageLayout = {
    v: 1,
    blocks: [{ id: 't1', type: 'table.basic', span: 4, props: { columns: [] } }],
  };

  it('lista só fontes compatíveis com o accepts do bloco', () => {
    renderPanel({ initial: withTable, preselect: 't1' });

    fireEvent.click(comboboxNear('editor.dataSource'));

    expect(screen.getByRole('option', { name: 'users.list' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'signups.series' })).not.toBeInTheDocument();
  });

  it('sem fonte escolhida, avisa que ela é obrigatória', () => {
    renderPanel({ initial: withTable, preselect: 't1' });

    expect(screen.getByText('editor.sourceRequired')).toBeInTheDocument();
  });

  it('escolher a fonte mostra a descrição e os parâmetros dela', () => {
    renderPanel({ initial: withTable, preselect: 't1' });

    fireEvent.click(comboboxNear('editor.dataSource'));
    fireEvent.click(screen.getByRole('option', { name: 'users.list' }));

    expect(screen.getByText('Lista de usuários.')).toBeInTheDocument();
    expect(screen.queryByText('editor.sourceRequired')).not.toBeInTheDocument();
    expect(screen.getByText('editor.parameters')).toBeInTheDocument();
    expect(screen.getByText('Quantidade de linhas.')).toBeInTheDocument();
    expect(screen.getByText('Busca por nome.')).toBeInTheDocument();
  });

  it('digitar num parâmetro number grava número; num parâmetro string grava texto', () => {
    const withSource: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 't1',
          type: 'table.basic',
          span: 4,
          props: { columns: [] },
          data: { source: 'users.list' },
        },
      ],
    };
    renderPanel({ initial: withSource, preselect: 't1' });

    const limitInput = inputNear('limit');
    fireEvent.change(limitInput, { target: { value: '5' } });
    expect(limitInput).toHaveValue(5);

    const qInput = inputNear('q');
    fireEvent.change(qInput, { target: { value: 'ana' } });
    expect(qInput).toHaveValue('ana');
  });

  it('esvaziar um parâmetro number não deixa resto de "0" no input', () => {
    const withSource: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 't1',
          type: 'table.basic',
          span: 4,
          props: { columns: [] },
          data: { source: 'users.list', params: { limit: 5 } },
        },
      ],
    };
    renderPanel({ initial: withSource, preselect: 't1' });

    const limitInput = inputNear('limit');
    fireEvent.change(limitInput, { target: { value: '' } });
    expect(limitInput).toHaveValue(null);
  });
});

describe('BlockForm — campos de prop', () => {
  it('prop string de texto/rótulo (label, hint, title) usa RichTextInput e prop de url usa input', () => {
    const withButton: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'btn1',
          type: 'button.action',
          span: 4,
          props: { label: 'Acessar', url: '/inicio' },
        },
      ],
    };
    renderPanel({ initial: withButton, preselect: 'btn1' });

    // `label` e `hint` agora são RichTextInput (contenteditable)
    expect(screen.getByLabelText('label')).toHaveTextContent('Acessar');

    // `url` continua sendo Input simples
    const urlInput = inputNear(/^url\*?$/);
    expect(urlInput).toHaveValue('/inicio');

    fireEvent.change(urlInput, { target: { value: '/relatorios' } });
    expect(urlInput).toHaveValue('/relatorios');
  });

  it('string[] sem fonte escolhida é texto livre separado por vírgula', () => {
    const withTable: PageLayout = {
      v: 1,
      blocks: [{ id: 't1', type: 'table.basic', span: 4, props: { columns: [] } }],
    };
    renderPanel({ initial: withTable, preselect: 't1' });

    const input = screen.getByPlaceholderText('editor.pickSourceFirst');
    fireEvent.change(input, { target: { value: 'a, b, c' } });
    expect(input).toHaveValue('a, b, c');
  });

  it('string[] com fonte escolhida vira checkboxes dos campos reais', () => {
    const withSource: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 't1',
          type: 'table.basic',
          span: 4,
          props: { columns: ['name'] },
          data: { source: 'users.list' },
        },
      ],
    };
    renderPanel({ initial: withSource, preselect: 't1' });

    const nameBox = screen.getByRole('checkbox', { name: 'name' });
    const emailBox = screen.getByRole('checkbox', { name: 'email' });
    expect(nameBox).toBeChecked();
    expect(emailBox).not.toBeChecked();

    fireEvent.click(emailBox);
    expect(emailBox).toBeChecked();

    fireEvent.click(nameBox);
    expect(nameBox).not.toBeChecked();
  });

  it('text.rich permite escolher fonte de dados opcional e oferece o botão de inserir variável {{var}} no RichTextInput', () => {
    const withText: PageLayout = {
      v: 1,
      blocks: [
        {
          id: 'txt1',
          type: 'text.rich',
          span: 6,
          props: { content: 'Bom dia, temos ' },
        },
      ],
    };
    renderPanel({ initial: withText, preselect: 'txt1' });

    // Sem fonte selecionada, não exige fonte com erro (mostra dica opcional)
    expect(screen.queryByText('editor.sourceRequired')).not.toBeInTheDocument();
    expect(screen.getByText('editor.optionalSourceHint')).toBeInTheDocument();

    // Seleciona a fonte users.list
    fireEvent.click(comboboxNear('editor.dataSource'));
    fireEvent.click(screen.getByRole('option', { name: 'users.list' }));

    // O botão de inserir variável aparece na barra do RichTextInput
    const varButton = screen.getByRole('button', { name: 'editor.insertVariable' });
    expect(varButton).toBeInTheDocument();
  });
});

describe('BlockForm — largura (span)', () => {
  it('alterar o toggle de largura reflete no bloco', async () => {
    const user = userEvent.setup();
    const withAlert: PageLayout = {
      v: 1,
      blocks: [{ id: 's1', type: 'text.rich', span: 12, props: { content: 'Texto' } }],
    };
    renderPanel({ initial: withAlert, preselect: 's1' });

    const fifty = screen.getByRole('button', { name: '50%' });
    await user.click(fifty);

    expect(screen.getByText('6 / 12 colunas')).toBeInTheDocument();
  });
});

describe('ClassNamePicker', () => {
  const withGroup: PageLayout = {
    v: 1,
    blocks: [{ id: 'g1', type: 'group', span: 4, props: {} }],
  };

  it('sem classes, não mostra nenhum chip', () => {
    renderPanel({ initial: withGroup, preselect: 'g1' });

    expect(screen.queryByText('text-center')).not.toBeInTheDocument();
  });

  it('adiciona um chip pelo select e some da lista de opções', () => {
    renderPanel({ initial: withGroup, preselect: 'g1' });

    fireEvent.click(comboboxNear('editor.style'));
    fireEvent.click(screen.getByRole('option', { name: 'text-center' }));

    expect(screen.getByText('text-center')).toBeInTheDocument();

    fireEvent.click(comboboxNear('editor.style'));
    expect(screen.queryByRole('option', { name: 'text-center' })).not.toBeInTheDocument();
  });

  it('remover o chip devolve a classe para as opções', () => {
    renderPanel({ initial: withGroup, preselect: 'g1' });

    fireEvent.click(comboboxNear('editor.style'));
    fireEvent.click(screen.getByRole('option', { name: 'text-center' }));
    const chip = screen.getByText('text-center').closest('span')!;

    fireEvent.click(within(chip).getByRole('button', { name: 'editor.removeClass:text-center' }));

    expect(screen.queryByText('text-center')).not.toBeInTheDocument();
    fireEvent.click(comboboxNear('editor.style'));
    expect(screen.getByRole('option', { name: 'text-center' })).toBeInTheDocument();
  });
});

describe('Rodapé — salvar/cancelar/padrão', () => {
  it('salvar desabilitado sem alteração; chama onSave quando habilitado', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderPanel({ dirty: true, onSave });

    const save = screen.getByRole('button', { name: 'editor.save' });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('salvando mostra "editor.saving" e desabilita cancelar', () => {
    renderPanel({ dirty: true, saving: true });

    expect(screen.getByRole('button', { name: 'editor.saving' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.cancel' })).toBeDisabled();
  });

  it('cancelar aciona onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderPanel({ onCancel });

    await user.click(screen.getByRole('button', { name: 'editor.cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('sem onSaveAsDefault, não oferece "salvar como padrão"', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', { name: 'editor.saveAsDefault' }),
    ).not.toBeInTheDocument();
  });

  it('com onSaveAsDefault, mostra o botão e a dica, e aciona ao clicar', async () => {
    const user = userEvent.setup();
    const onSaveAsDefault = vi.fn();
    renderPanel({ onSaveAsDefault });

    expect(screen.getByText('editor.saveAsDefaultHint')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'editor.saveAsDefault' }));
    expect(onSaveAsDefault).toHaveBeenCalledTimes(1);
  });
});
